import mongoose from "mongoose";
import { Revocation } from "../models/revocation.js";
import { User } from "../models/user.js";
import { ACCESS_TTL_SECONDS } from "./tokenService.js";

const memory = new Map();
const clearJti = new Set();
const activeUsers = new Set();

function expiresAtMs(expiresAt) {
  return expiresAt instanceof Date ? expiresAt.getTime() : expiresAt;
}

export function resetRevocationState() {
  memory.clear();
  clearJti.clear();
  activeUsers.clear();
}

export function rememberRevocation(key, expiresAt) {
  const at = expiresAtMs(expiresAt);
  if (at <= Date.now()) {
    memory.delete(key);
    return;
  }
  memory.set(key, at);
  if (key.startsWith("jti:")) clearJti.delete(key.slice(4));
  if (key.startsWith("user:")) activeUsers.delete(key.slice(5));
}

export function blockedInMemory(session) {
  const now = Date.now();
  for (const key of [`jti:${session.jti}`, `user:${session.userId}`]) {
    const exp = memory.get(key);
    if (exp == null) continue;
    if (exp <= now) {
      memory.delete(key);
      continue;
    }
    return true;
  }
  return false;
}

export async function revokeSession(session) {
  const expiresAt = new Date(session.expiresAt);
  rememberRevocation(`jti:${session.jti}`, expiresAt);
  await Revocation.updateOne({ key: `jti:${session.jti}` }, { $set: { expiresAt } }, { upsert: true });
}

export function forgetUser(userId) {
  rememberRevocation(`user:${userId}`, Date.now() + ACCESS_TTL_SECONDS * 1000);
}

export async function isSessionBlocked(session) {
  if (blockedInMemory(session)) return true;

  if (!clearJti.has(session.jti)) {
    const revoked = await Revocation.findOne({
      key: `jti:${session.jti}`,
      expiresAt: { $gt: new Date() },
    }).select("expiresAt");
    if (revoked) {
      rememberRevocation(`jti:${session.jti}`, revoked.expiresAt);
      return true;
    }
    clearJti.add(session.jti);
  }

  if (!activeUsers.has(session.userId)) {
    const exists =
      mongoose.isValidObjectId(session.userId) && (await User.exists({ _id: session.userId }));
    if (!exists) {
      forgetUser(session.userId);
      return true;
    }
    activeUsers.add(session.userId);
  }
  return false;
}
