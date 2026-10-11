import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS, DEMO_GREETING } from "../demoAccounts.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import { pairChatroomId } from "./chatroom.js";
import { recordNewMessage } from "./conversationService.js";
import { sendMessage } from "./messageService.js";

async function upsertDemoUser(account) {
  const username = account.username.toLowerCase();
  let user = await User.findOne({ username }).select("+password");
  if (!user) {
    return User.create({
      username,
      email: account.email,
      password: account.password,
      lastSeen: new Date(),
    });
  }

  const matches = await bcrypt.compare(account.password, user.password);
  if (!matches) user.password = account.password;
  if (!user.email) user.email = account.email;
  if (user.isModified()) await user.save();
  return user;
}

async function ensureGreeting(alex, sam) {
  const result = await sendMessage({
    messageId: DEMO_GREETING.messageId,
    sender: alex.id,
    receiver: sam.id,
    message: DEMO_GREETING.message,
    chatroomId: pairChatroomId(alex.id, sam.id),
  });
  if (result.created) return;

  const existing = await Message.findOne({ messageId: DEMO_GREETING.messageId });
  if (existing) await recordNewMessage(existing);
}

export async function seedDemoAccounts() {
  const users = [];
  for (const account of DEMO_ACCOUNTS) {
    users.push(await upsertDemoUser(account));
  }
  await ensureGreeting(users[0], users[1]);
}
