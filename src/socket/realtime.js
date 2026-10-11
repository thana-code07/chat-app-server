import { updateMessageStatus } from "../services/messageService.js";
import { isOnline, presenceRoom, userRoom } from "./presence.js";

let io = null;

export function setIO(server) {
  io = server;
}

export function emitToUser(userId, event, payload, exceptSocketId) {
  if (!io) return;
  const operator = exceptSocketId
    ? io.to(userRoom(userId)).except(exceptSocketId)
    : io.to(userRoom(userId));
  operator.emit(event, payload);
}

function closeSocket(socket) {
  socket.emit("auth:expired");
  setTimeout(() => socket.disconnect(true), 100);
}

export function disconnectUserToken(userId, jti) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId !== userId || socket.data.jti !== jti) continue;
    closeSocket(socket);
  }
}

export function disconnectUser(userId) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId !== userId) continue;
    closeSocket(socket);
  }
}

export function emitPresence(presence) {
  if (!io) return;
  io.to(presenceRoom(presence.userId)).emit("presence:update", presence);
}

export async function publishNewMessage(result, options = {}) {
  let message = result.message;
  if (message.status === "sent" && isOnline(message.receiver)) {
    try {
      message = await updateMessageStatus({
        userId: message.receiver,
        messageId: message.messageId,
        status: "delivered",
      });
    } catch (err) {
      console.error(err?.message || "Failed to mark message delivered");
    }
  }

  const payload = { message };
  emitToUser(message.receiver, "message:new", payload);
  emitToUser(message.sender, "message:new", payload, options.exceptSocketId);
  return message;
}

export function publishMessageStatus(message, options = {}) {
  const payload = { message };
  emitToUser(message.sender, "message:status", payload);
  emitToUser(message.receiver, "message:status", payload, options.exceptSocketId);
}
