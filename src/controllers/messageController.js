import {
  getMessage as getMessageById,
  listMessages,
  sendMessage,
  updateMessageStatus,
} from "../services/messageService.js";
import { publishMessageStatus, publishNewMessage } from "../socket/realtime.js";
import {
  MESSAGE_ID_RE,
  UPDATABLE_STATUSES,
  readMessageBody,
  readObjectId,
} from "../validation/message.js";

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

function readListQuery(query) {
  const chatroomId = readObjectId(query?.chatroomId);
  if (!chatroomId) return { error: "chatroomId must be a valid id" };

  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    return { error: "page must be an integer from 1 to 100" };
  }
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
    const message = await publishNewMessage(result);
    return res.status(result.created ? 201 : 200).json({ message });
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
    const message = await updateMessageStatus({ userId: req.userId, messageId, status });
    publishMessageStatus(message);
    return res.json({ message });
  } catch (err) {
    return sendServiceError(err, res);
  }
}
