import { User } from "../models/user.js";

const socketsByUser = new Map();
const onlineGeneration = new Map();

export function userRoom(userId) {
  return `user:${userId}`;
}

export function presenceRoom(userId) {
  return `presence:${userId}`;
}

function nextGeneration(userId) {
  const generation = (onlineGeneration.get(userId) ?? 0) + 1;
  onlineGeneration.set(userId, generation);
  return generation;
}

export function trackConnect(userId, socketId) {
  let sockets = socketsByUser.get(userId);
  const wasOnline = Boolean(sockets?.size);
  if (!sockets) {
    sockets = new Set();
    socketsByUser.set(userId, sockets);
  }
  sockets.add(socketId);
  return {
    becameOnline: !wasOnline,
    generation: wasOnline ? onlineGeneration.get(userId) : nextGeneration(userId),
  };
}

export function trackDisconnect(userId, socketId) {
  const sockets = socketsByUser.get(userId);
  if (!sockets?.delete(socketId)) return { wentOffline: false };
  if (sockets.size > 0) return { wentOffline: false };
  socketsByUser.delete(userId);
  return { wentOffline: true, generation: nextGeneration(userId) };
}

export function isOnline(userId) {
  return (socketsByUser.get(userId)?.size ?? 0) > 0;
}

export function isSamePresence(userId, generation) {
  return onlineGeneration.get(userId) === generation;
}

function toPresence(user) {
  const userId = user._id.toString();
  return {
    userId,
    isOnline: isOnline(userId),
    lastSeen: user.lastSeen ?? null,
  };
}

export async function presenceFor(userIds) {
  if (!userIds.length) return [];
  const users = await User.find({ _id: { $in: userIds } }).select("lastSeen");
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return userIds.filter((id) => byId.has(id)).map((id) => toPresence(byId.get(id)));
}

export async function presenceForUser(userId) {
  const user = await User.findById(userId).select("lastSeen");
  return user ? toPresence(user) : null;
}
