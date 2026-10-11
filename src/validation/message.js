import mongoose from "mongoose";
import { MESSAGE_STATUSES } from "../models/message.js";

export const MESSAGE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
export const UPDATABLE_STATUSES = MESSAGE_STATUSES.filter((status) => status !== "sent");

export function readMessageCursor(value) {
  if (value === undefined || value === "") return { before: null };
  if (typeof value !== "string") return { error: "before must be a message cursor" };
  const split = value.lastIndexOf("|");
  if (split <= 0) return { error: "before must be a message cursor" };
  const at = new Date(value.slice(0, split));
  const messageId = value.slice(split + 1);
  if (Number.isNaN(at.getTime()) || !MESSAGE_ID_RE.test(messageId)) {
    return { error: "before must be a message cursor" };
  }
  return { before: { at, messageId } };
}

export function readThreadLimit(value) {
  if (value === undefined) return { limit: 30 };
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { error: "limit must be an integer from 1 to 50" };
  }
  return { limit };
}

export function readObjectId(value) {
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) return null;
  return value;
}

export function readMessageBody(body, senderId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
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
