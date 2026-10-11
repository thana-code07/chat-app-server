import {
  listConversations,
  listThreadMessages,
  openConversation,
} from "../services/conversationService.js";
import { readPage } from "../validation/directory.js";
import { readObjectId } from "../validation/message.js";

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

export async function list(req, res) {
  try {
    const conversations = await listConversations(req.userId);
    return res.json({ conversations });
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
    return res.json(await openConversation({ userId: req.userId, otherUserId }));
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
  const page = readPage(req.query);
  if (page.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: page.error },
    });
  }

  try {
    return res.json(await listThreadMessages({ userId: req.userId, otherUserId, ...page }));
  } catch (err) {
    return sendServiceError(err, res);
  }
}
