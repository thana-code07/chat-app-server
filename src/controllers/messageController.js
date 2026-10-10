import mongoose from "mongoose";
import { MESSAGE_STATUSES } from "../models/message.js";
import {
  getMessage as getMessageById,
  listMessages,
  sendMessage,
  updateMessageStatus,
} from "../services/messageService.js";

const MESSAGE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const UPDATABLE_STATUSES = MESSAGE_STATUSES.filter((status) => status !== "sent");

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

function readObjectId(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) return null;
  return value;
}

function readMessageBody(body, senderId) {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object" };
  }

  const chatroomId = readObjectId(body.chatroomId);
  const receiver = readObjectId(body.receiver);
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!chatroomId) return { error: "chatroomId must be a valid id" };
  if (!MESSAGE_ID_RE.test(messageId)) {
    return { error: "messageId must be 8-64 letters, numbers, underscores, or hyphens" };
  }
  if (!receiver) return { error: "receiver must be a valid user id" };
  if (!message || message.length > 4000) {
    return { error: "message must be 1-4000 characters" };
  }
  if (receiver === senderId) return { error: "You cannot message yourself" };

  return { chatroomId, messageId, receiver, message };
}

function readListQuery(query) {
  const chatroomId = readObjectId(query?.chatroomId);
  if (!chatroomId) return { error: "chatroomId must be a valid id" };

  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) return { error: "page must be an integer of 1 or more" };
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return { error: "pageSize must be an integer from 1 to 50" };
  }

  return { chatroomId, page, pageSize };
}

export async function createMessage(req, res) {
  const parsed = readMessageBody(req.body, req.userId);
  if (parsed.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error },
    });
  }

  try {
    const result = await sendMessage({ ...parsed, sender: req.userId });
    return res.status(result.created ? 201 : 200).json({ message: result.message });
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function listChatMessages(req, res) {
  const parsed = readListQuery(req.query);
  if (parsed.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error },
    });
  }

  try {
    return res.json(await listMessages({ userId: req.userId, ...parsed }));
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function getMessage(req, res) {
  const messageId = typeof req.params.messageId === "string" ? req.params.messageId : "";
  if (!MESSAGE_ID_RE.test(messageId)) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "messageId is invalid" },
    });
  }

  try {
    return res.json({ message: await getMessageById({ userId: req.userId, messageId }) });
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function patchMessageStatus(req, res) {
  const messageId = typeof req.params.messageId === "string" ? req.params.messageId : "";
  const status = req.body?.status;
  if (!MESSAGE_ID_RE.test(messageId)) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "messageId is invalid" },
    });
  }
  if (!UPDATABLE_STATUSES.includes(status)) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "status must be delivered or read" },
    });
  }

  try {
    return res.json({
      message: await updateMessageStatus({ userId: req.userId, messageId, status }),
    });
  } catch (err) {
    return sendServiceError(err, res);
  }
}
