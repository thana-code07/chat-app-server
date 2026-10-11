import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { RevokedToken } from "../models/revokedToken.js";

export const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId, typ: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: "HS256",
    jwtid: randomUUID(),
  });
}

export function readAccessToken(token) {
  if (typeof token !== "string" || !token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (
      payload?.typ !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      jti: payload.jti,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export async function isAccessTokenRevoked(jti) {
  return Boolean(await RevokedToken.exists({ jti }));
}

export async function revokeAccessToken({ jti, expiresAt }) {
  await RevokedToken.updateOne(
    { jti },
    { $setOnInsert: { jti, expiresAt: new Date(expiresAt) } },
    { upsert: true },
  );
}
