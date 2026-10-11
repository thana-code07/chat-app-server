import { sendServiceError } from "../httpError.js";
import {
  listConversations,
  listThreadMessages,
  openConversation,
} from "../services/conversationService.js";
import { isOnline } from "../socket/presence.js";
import { readConversationCursor } from "../validation/directory.js";
import { readMessageCursor, readObjectId, readThreadLimit } from "../validation/message.js";

export async function list(req, res) {
  const cursor = readConversationCursor(req.query.before);
  if (cursor.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: cursor.error },
    });
  }

  try {
    const page = await listConversations(req.userId, cursor.before);
    return res.json({
      conversations: page.conversations.map((conversation) => ({
        ...conversation,
        isOnline: isOnline(conversation.user.id),
      })),
      nextCursor: page.nextCursor,
    });
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function open(req, res) {
  const otherUserId = readObjectId(req.params.userId);
  if (!otherUserId) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "userId must be a valid id" },
    });
  }

  try {
    const conversation = await openConversation({ userId: req.userId, otherUserId });
    return res.json({ ...conversation, isOnline: isOnline(otherUserId) });
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function messages(req, res) {
  const otherUserId = readObjectId(req.params.userId);
  if (!otherUserId) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "userId must be a valid id" },
    });
  }
  const before = readMessageCursor(req.query.before);
  if (before.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: before.error },
    });
  }
  const limit = readThreadLimit(req.query.limit);
  if (limit.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: limit.error },
    });
  }

  try {
    return res.json(
      await listThreadMessages({
        userId: req.userId,
        otherUserId,
        before: before.before,
        limit: limit.limit,
      }),
    );
  } catch (err) {
    return sendServiceError(err, res);
  }
}
