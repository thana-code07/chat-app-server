import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { RefreshToken } from "../models/refreshToken.js";

export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId, typ: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: "HS256",
  });
}

export function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId) {
  const refreshToken = randomBytes(32).toString("base64url");
  await RefreshToken.create({
    user: userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return refreshToken;
}

export async function revokeRefreshToken(token) {
  const result = await RefreshToken.deleteOne({ tokenHash: hashRefreshToken(token) });
  return result.deletedCount > 0;
}
