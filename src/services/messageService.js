import mongoose from "mongoose";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";

const STATUS_RANK = { sent: 0, delivered: 1, read: 2 };

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function samePayload(existing, input) {
  return (
    existing.chatroomId.toString() === input.chatroomId &&
    existing.sender.toString() === input.sender &&
    existing.receiver.toString() === input.receiver &&
    existing.message === input.message
  );
}

export async function sendMessage({ chatroomId, messageId, sender, receiver, message }) {
  if (sender === receiver) {
    throw httpError(422, "VALIDATION_ERROR", "You cannot message yourself");
  }

  const [senderUser, receiverUser] = await Promise.all([
    User.exists({ _id: sender }),
    User.exists({ _id: receiver }),
  ]);
  if (!senderUser) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  if (!receiverUser) {
    throw httpError(404, "USER_NOT_FOUND", "Receiver not found");
  }

  try {
    const created = await Message.create({
      chatroomId,
      messageId,
      sender,
      receiver,
      message,
      status: "sent",
      created_at: new Date(),
    });
    return { message: created.toPublic(), created: true };
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  const existing = await Message.findOne({ messageId });
  if (!existing || !samePayload(existing, { chatroomId, sender, receiver, message })) {
    throw httpError(409, "MESSAGE_ID_TAKEN", "messageId is already in use");
  }
  return { message: existing.toPublic(), created: false };
}

export async function listMessages({ userId, chatroomId, page, pageSize }) {
  const filter = {
    chatroomId,
    $or: [{ sender: userId }, { receiver: userId }],
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

export async function getMessage({ userId, messageId }) {
  const message = await Message.findOne({
    messageId,
    $or: [{ sender: userId }, { receiver: userId }],
  });
  if (!message) {
    throw httpError(404, "MESSAGE_NOT_FOUND", "Message not found");
  }
  return message.toPublic();
}

export async function updateMessageStatus({ userId, messageId, status }) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }

  const message = await Message.findOne({ messageId });
  if (!message) {
    throw httpError(404, "MESSAGE_NOT_FOUND", "Message not found");
  }
  if (message.receiver.toString() !== userId) {
    throw httpError(403, "FORBIDDEN", "Only the receiver can update message status");
  }
  if (STATUS_RANK[status] < STATUS_RANK[message.status]) {
    throw httpError(409, "INVALID_STATUS", "Message status cannot move backwards");
  }
  if (status !== message.status) {
    message.status = status;
    await message.save();
  }
  return message.toPublic();
}
