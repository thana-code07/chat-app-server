import bcrypt from "bcryptjs";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/refreshToken.js";
import {
  ACCESS_TTL_SECONDS,
  hashRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from "./tokenService.js";

const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function issueSession(user) {
  return {
    accessToken: signAccessToken(user.id),
    refreshToken: await issueRefreshToken(user.id),
    expiresIn: ACCESS_TTL_SECONDS,
    user: user.toPublic(),
  };
}

export async function registerUser({ username, password }) {
  try {
    const user = await User.create({
      username,
      password,
      lastSeen: new Date(),
    });
    return issueSession(user);
  } catch (err) {
    if (err?.code === 11000) {
      throw httpError(409, "USERNAME_TAKEN", "Username is already taken");
    }
    throw err;
  }
}

export async function loginUser({ username, password }) {
  const user = await User.findOne({ username: username.toLowerCase() }).select("+password");
  const matches = await bcrypt.compare(password, user?.password ?? dummyHash);
  if (!user || !matches) {
    throw httpError(401, "INVALID_CREDENTIALS", "Invalid username or password");
  }

  const lastSeen = new Date();
  await User.updateOne({ _id: user._id }, { lastSeen });
  user.lastSeen = lastSeen;
  return issueSession(user);
}

export async function refreshSession(refreshToken) {
  const existing = await RefreshToken.findOneAndDelete({
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: { $gt: new Date() },
  });
  if (!existing) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  }

  const user = await User.findById(existing.user);
  if (!user) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  }

  return issueSession(user);
}

export async function logoutSession(refreshToken) {
  await revokeRefreshToken(refreshToken);
}

export async function logoutAllSessions(userId) {
  await RefreshToken.deleteMany({ user: userId });
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return user.toPublic();
}

export async function updateLastSeen(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { lastSeen: new Date() },
    { returnDocument: "after" },
  );
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return user.toPublic();
}
