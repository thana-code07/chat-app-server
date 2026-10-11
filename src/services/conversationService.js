import mongoose from "mongoose";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { isOnline } from "../socket/presence.js";
import { pairChatroomId } from "./chatroom.js";

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

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

export async function listConversations(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  const me = new mongoose.Types.ObjectId(userId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ sender: me }, { receiver: me }] } },
    { $sort: { created_at: -1 } },
    {
      $addFields: {
        partner: { $cond: [{ $eq: ["$sender", me] }, "$receiver", "$sender"] },
      },
    },
    {
      $group: {
        _id: "$partner",
        message: { $first: "$message" },
        created_at: { $first: "$created_at" },
        status: { $first: "$status" },
        sender: { $first: "$sender" },
      },
    },
    { $sort: { created_at: -1 } },
    { $limit: 50 },
  ]);

  const partners = await User.find({ _id: { $in: rows.map((row) => row._id) } }).select("username");
  const names = new Map(partners.map((user) => [user._id.toString(), user.username]));

  return rows
    .filter((row) => names.has(row._id.toString()))
    .map((row) => {
      const partnerId = row._id.toString();
      return {
        chatroomId: pairChatroomId(userId, partnerId),
        user: { id: partnerId, username: names.get(partnerId) },
        isOnline: isOnline(partnerId),
        lastMessage: {
          message: row.message,
          created_at: row.created_at,
          status: row.status,
          sender: row.sender.toString(),
        },
      };
    });
}

export async function openConversation({ userId, otherUserId }) {
  const other = await requireOtherUser(userId, otherUserId);
  return {
    chatroomId: pairChatroomId(userId, otherUserId),
    user: publicUser(other),
    isOnline: isOnline(otherUserId),
  };
}

export async function listThreadMessages({ userId, otherUserId, page, pageSize }) {
  await requireOtherUser(userId, otherUserId);
  const filter = {
    $or: [
      { sender: userId, receiver: otherUserId },
      { sender: otherUserId, receiver: userId },
    ],
  };
  const [totalItems, messages] = await Promise.all([
    Message.countDocuments(filter),
    Message.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    data: messages.map((message) => message.toPublic()),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    },
  };
}
