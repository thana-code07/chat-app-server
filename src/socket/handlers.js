import { updateLastSeen } from "../services/userService.js";
import { sendMessage, updateMessageStatus } from "../services/messageService.js";
import {
  MESSAGE_ID_RE,
  UPDATABLE_STATUSES,
  readMessageBody,
  readObjectId,
} from "../validation/message.js";
import {
  isOnline,
  isSamePresence,
  presenceFor,
  presenceForUser,
  presenceRoom,
  trackConnect,
  trackDisconnect,
  userRoom,
} from "./presence.js";
import { emitPresence, publishMessageStatus, publishNewMessage } from "./realtime.js";

const SEND_WINDOW_MS = 10_000;
const SEND_MAX = 20;
const WATCH_WINDOW_MS = 10_000;
const WATCH_MAX = 10;
const WATCH_LIMIT = 50;
const sendHits = new Map();
const watchHits = new Map();

function allow(bucket, userId, windowMs, max) {
  const now = Date.now();
  const recent = (bucket.get(userId) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= max) {
    bucket.set(userId, recent);
    return false;
  }
  recent.push(now);
  bucket.set(userId, recent);
  return true;
}

function clearLimits(userId) {
  sendHits.delete(userId);
  watchHits.delete(userId);
}

function ackError(ack, code, message) {
  if (typeof ack !== "function") return;
  ack({ error: { code, message } });
}

function ackOk(ack, body) {
  if (typeof ack !== "function") return;
  ack(body);
}

function ackFromError(ack, err) {
  if (err?.status) {
    ackError(ack, err.code, err.message);
    return;
  }
  console.error(err?.message || "Socket handler failed");
  ackError(ack, "INTERNAL_ERROR", "Something went wrong");
}

function expireSocket(socket, ack) {
  ackError(ack, "UNAUTHORIZED", "Authentication required");
  if (socket.data.closing) return;
  socket.data.closing = true;
  socket.emit("auth:expired");
  setTimeout(() => socket.disconnect(true), 100);
}

function ensureSession(socket, ack) {
  if (socket.data.expiresAt > Date.now()) return true;
  expireSocket(socket, ack);
  return false;
}

function readWatchIds(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.userIds)) {
    return null;
  }
  if (payload.userIds.length > WATCH_LIMIT) return null;

  const ids = [];
  const seen = new Set();
  for (const value of payload.userIds) {
    const id = readObjectId(value);
    if (!id) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function publishOnline(userId, generation) {
  presenceForUser(userId)
    .then((presence) => {
      if (!presence || !isSamePresence(userId, generation)) return;
      emitPresence({ ...presence, isOnline: true });
    })
    .catch((err) => {
      console.error(err?.message || "Failed to publish online presence");
    });
}

function publishOffline(userId, generation) {
  updateLastSeen(userId)
    .then((user) => {
      if (!isSamePresence(userId, generation) || isOnline(userId)) return;
      emitPresence({ userId, isOnline: false, lastSeen: user.lastSeen });
    })
    .catch((err) => {
      console.error(err?.message || "Failed to update last seen");
      if (!isSamePresence(userId, generation) || isOnline(userId)) return;
      emitPresence({ userId, isOnline: false, lastSeen: new Date() });
    });
}

async function onWatch(socket, payload, ack) {
  try {
    if (!ensureSession(socket, ack)) return;
    const userId = socket.data.userId;
    if (!allow(watchHits, userId, WATCH_WINDOW_MS, WATCH_MAX)) {
      ackError(ack, "RATE_LIMITED", "Too many attempts. Try again later.");
      return;
    }

    const userIds = readWatchIds(payload);
    if (!userIds) {
      ackError(ack, "VALIDATION_ERROR", "userIds must be an array of up to 50 user ids");
      return;
    }

    for (const room of socket.data.presenceRooms ?? []) socket.leave(room);
    const rooms = userIds.map((id) => presenceRoom(id));
    socket.data.presenceRooms = rooms;
    if (rooms.length) await socket.join(rooms);

    ackOk(ack, { users: await presenceFor(userIds) });
  } catch (err) {
    ackFromError(ack, err);
  }
}

async function onSend(socket, payload, ack) {
  try {
    if (!ensureSession(socket, ack)) return;
    const userId = socket.data.userId;
    const parsed = readMessageBody(payload, userId);
    if (parsed.error) {
      ackError(ack, "VALIDATION_ERROR", parsed.error);
      return;
    }
    if (!allow(sendHits, userId, SEND_WINDOW_MS, SEND_MAX)) {
      ackError(ack, "RATE_LIMITED", "Too many messages. Try again later.");
      return;
    }

    const result = await sendMessage({ ...parsed, sender: userId });
    const message = await publishNewMessage(result, { exceptSocketId: socket.id });
    ackOk(ack, { message });
  } catch (err) {
    ackFromError(ack, err);
  }
}

async function onStatus(socket, payload, ack) {
  try {
    if (!ensureSession(socket, ack)) return;
    const userId = socket.data.userId;
    const messageId = typeof payload?.messageId === "string" ? payload.messageId.trim() : "";
    const status = payload?.status;
    if (!MESSAGE_ID_RE.test(messageId)) {
      ackError(ack, "VALIDATION_ERROR", "messageId is invalid");
      return;
    }
    if (!UPDATABLE_STATUSES.includes(status)) {
      ackError(ack, "VALIDATION_ERROR", "status must be delivered or read");
      return;
    }
    if (!allow(sendHits, userId, SEND_WINDOW_MS, SEND_MAX)) {
      ackError(ack, "RATE_LIMITED", "Too many messages. Try again later.");
      return;
    }

    const message = await updateMessageStatus({ userId, messageId, status });
    publishMessageStatus(message, { exceptSocketId: socket.id });
    ackOk(ack, { message });
  } catch (err) {
    ackFromError(ack, err);
  }
}

export async function registerSocketHandlers(socket) {
  const userId = socket.data.userId;
  await socket.join(userRoom(userId));

  const { becameOnline, generation } = trackConnect(userId, socket.id);
  if (becameOnline) publishOnline(userId, generation);

  socket.on("presence:watch", (payload, ack) => {
    onWatch(socket, payload, ack);
  });
  socket.on("message:send", (payload, ack) => {
    onSend(socket, payload, ack);
  });
  socket.on("message:status", (payload, ack) => {
    onStatus(socket, payload, ack);
  });
  socket.on("disconnect", () => {
    const result = trackDisconnect(userId, socket.id);
    if (!result.wentOffline) return;
    clearLimits(userId);
    publishOffline(userId, result.generation);
  });

  socket.emit("session:ready", { userId });
}
