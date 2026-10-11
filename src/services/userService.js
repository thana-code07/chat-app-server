import bcrypt from "bcryptjs";
import { Conversation } from "../models/conversation.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { httpError } from "../httpError.js";
import { forgetUser, revokeSession } from "./revocationService.js";
import { ACCESS_TTL_SECONDS, signAccessToken } from "./tokenService.js";

const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

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
      throw httpError(409, "ACCOUNT_EXISTS", "An account with that username or email already exists");
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

export async function logoutUser(session) {
  await revokeSession(session);
}

export async function deleteAccount(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Authentication required");
  }
  await Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] });
  await Conversation.deleteMany({ $or: [{ userId }, { partnerId: userId }] });
  await User.deleteOne({ _id: userId });
  forgetUser(userId);
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
