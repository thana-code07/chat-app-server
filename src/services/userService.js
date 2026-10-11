import bcrypt from "bcryptjs";
import { User } from "../models/user.js";
import { disconnectUserToken } from "../socket/realtime.js";
import { ACCESS_TTL_SECONDS, readAccessToken, signAccessToken } from "./tokenService.js";

const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function issueSession(user) {
  return {
    accessToken: signAccessToken(user.id),
    expiresIn: ACCESS_TTL_SECONDS,
    user: user.toPublic(),
  };
}

export async function registerUser({ username, email, password }) {
  try {
    const user = await User.create({
      username,
      email,
      password,
      lastSeen: new Date(),
    });
    return issueSession(user);
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0];
      if (field === "email") {
        throw httpError(409, "EMAIL_TAKEN", "Email is already registered");
      }
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

export function readLogoutToken(token) {
  const session = readAccessToken(token);
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

export function logoutUser(session) {
  disconnectUserToken(session.userId, session.jti);
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  return user.toPublic();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findUsersByName({ userId, q }) {
  if (!q) return [];
  const users = await User.find({
    _id: { $ne: userId },
    username: { $regex: `^${escapeRegex(q)}` },
  })
    .select("username")
    .sort({ username: 1 })
    .limit(20);
  return users.map((user) => ({ id: user._id.toString(), username: user.username }));
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
