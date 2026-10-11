import mongoose from "mongoose";
import { Conversation } from "../models/conversation.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { httpError } from "../httpError.js";
import { pairChatroomId } from "./chatroom.js";

const CONVERSATION_LIMIT = 50;
const seeding = new Map();

function publicUser(user) {
  return { id: user._id.toString(), username: user.username };
}

async function requireOtherUser(userId, otherUserId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  if (!mongoose.isValidObjectId(otherUserId) || otherUserId === userId) {
    throw httpError(422, "VALIDATION_ERROR", "userId must be another user");
  }
  const other = await User.findById(otherUserId).select("username");
  if (!other) {
    throw httpError(404, "USER_NOT_FOUND", "User not found");
  }
  return other;
}

async function rebuildConversations(userId) {
  const me = new mongoose.Types.ObjectId(userId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: me }, { receiver: me }] } },
    { $sort: { created_at: -1, messageId: -1 } },
    {
      $addFields: {
        partner: { $cond: [{ $eq: ["$sender", me] }, "$receiver", "$sender"] },
      },
    },
    {
      $group: {
        _id: "$partner",
        messageId: { $first: "$messageId" },
        message: { $first: "$message" },
        created_at: { $first: "$created_at" },
        status: { $first: "$status" },
        sender: { $first: "$sender" },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$receiver", me] }, { $ne: ["$status", "read"] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const partners = await User.find({ _id: { $in: rows.map((row) => row._id) } }).select("_id");
  const live = new Set(partners.map((user) => user._id.toString()));
  const docs = rows
    .filter((row) => live.has(row._id.toString()))
    .map((row) => ({
      userId: me,
      partnerId: row._id,
      chatroomId: pairChatroomId(userId, row._id.toString()),
      lastMessageId: row.messageId,
      lastMessage: row.message,
      lastMessageAt: row.created_at,
      lastStatus: row.status,
      lastSender: row.sender,
      unreadCount: row.unreadCount,
    }));

  if (docs.length) {
    await Conversation.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { userId: doc.userId, partnerId: doc.partnerId },
          update: { $set: doc },
          upsert: true,
        },
      })),
    );
  }
  await Conversation.deleteMany({
    userId: me,
    partnerId: { $nin: docs.map((doc) => doc.partnerId) },
  });
}

async function wasAlreadySeeded(userId) {
  const user = await User.findById(userId).select("conversationsSeeded");
  if (!user) return null;
  if (user.conversationsSeeded) return true;

  let pending = seeding.get(String(userId));
  if (!pending) {
    pending = rebuildConversations(userId)
      .then(() => User.updateOne({ _id: userId }, { $set: { conversationsSeeded: true } }))
      .finally(() => seeding.delete(String(userId)));
    seeding.set(String(userId), pending);
  }
  await pending;
  return false;
}

function inboxSet(message) {
  return {
    chatroomId: message.chatroomId,
    lastMessageId: message.messageId,
    lastMessage: message.message,
    lastMessageAt: message.created_at,
    lastStatus: message.status,
    lastSender: message.sender,
  };
}

async function touchInbox(ownerId, partnerId, message, incrementUnread) {
  const existing = await Conversation.findOne({ userId: ownerId, partnerId }).select(
    "lastMessageId lastMessageAt",
  );
  if (existing?.lastMessageId === message.messageId) return;
  if (existing && existing.lastMessageAt > message.created_at) return;

  const update = { $set: inboxSet(message) };
  if (incrementUnread) update.$inc = { unreadCount: 1 };
  else update.$setOnInsert = { unreadCount: 0 };
  await Conversation.updateOne({ userId: ownerId, partnerId }, update, { upsert: true });
}

export async function recordNewMessage(message) {
  const sender = message.sender.toString();
  const receiver = message.receiver.toString();
  await wasAlreadySeeded(sender);
  await wasAlreadySeeded(receiver);
  await touchInbox(sender, receiver, message, false);
  await touchInbox(receiver, sender, message, true);
}

export async function recordStatuses(messages) {
  if (!messages.length) return;
  const status = messages[0].status;
  const ids = [...new Set(messages.map((message) => message.messageId))];
  await Conversation.updateMany({ lastMessageId: { $in: ids } }, { $set: { lastStatus: status } });
}

export async function recordConversationRead(userId, otherUserId) {
  const seeded = await wasAlreadySeeded(userId);
  if (seeded === null) return;
  await Conversation.updateOne({ userId, partnerId: otherUserId }, { $set: { unreadCount: 0 } });
}

function toListItem(row, username) {
  return {
    chatroomId: row.chatroomId.toString(),
    user: { id: row.partnerId.toString(), username },
    unreadCount: row.unreadCount,
    lastMessage: {
      message: row.lastMessage,
      created_at: row.lastMessageAt,
      status: row.lastStatus,
      sender: row.lastSender.toString(),
    },
  };
}

export async function listConversations(userId, before) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  await wasAlreadySeeded(userId);
  const filter = { userId };
  if (before) {
    filter.$or = [
      { lastMessageAt: { $lt: before.at } },
      { lastMessageAt: before.at, partnerId: { $lt: before.partnerId } },
    ];
  }
  const rows = await Conversation.find(filter)
    .sort({ lastMessageAt: -1, partnerId: -1 })
    .limit(CONVERSATION_LIMIT + 1);
  const hasMore = rows.length > CONVERSATION_LIMIT;
  const page = hasMore ? rows.slice(0, CONVERSATION_LIMIT) : rows;
  const partners = await User.find({ _id: { $in: page.map((row) => row.partnerId) } }).select("username");
  const names = new Map(partners.map((user) => [user._id.toString(), user.username]));
  const conversations = page
    .filter((row) => names.has(row.partnerId.toString()))
    .map((row) => toListItem(row, names.get(row.partnerId.toString())));
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? `${new Date(last.lastMessageAt).toISOString()}|${last.partnerId.toString()}` : null;
  return { conversations, nextCursor };
}

export async function openConversation({ userId, otherUserId }) {
  const other = await requireOtherUser(userId, otherUserId);
  return {
    chatroomId: pairChatroomId(userId, otherUserId),
    user: publicUser(other),
  };
}

export async function listThreadMessages({ userId, otherUserId, before, limit }) {
  await requireOtherUser(userId, otherUserId);
  const chatroomId = pairChatroomId(userId, otherUserId);
  const filter = { chatroomId };
  if (before) {
    filter.$or = [
      { created_at: { $lt: before.at } },
      { created_at: before.at, messageId: { $lt: before.messageId } },
    ];
  }
  const messages = await Message.find(filter)
    .sort({ created_at: -1, messageId: -1 })
    .limit(limit + 1);
  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const oldest = page[page.length - 1];
  return {
    data: page.map((message) => message.toPublic()),
    nextCursor:
      hasMore && oldest ? `${new Date(oldest.created_at).toISOString()}|${oldest.messageId}` : null,
  };
}
