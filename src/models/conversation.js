import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chatroomId: { type: mongoose.Schema.Types.ObjectId, required: true },
    lastMessageId: { type: String, required: true },
    lastMessage: { type: String, required: true },
    lastMessageAt: { type: Date, required: true },
    lastStatus: { type: String, required: true },
    lastSender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    unreadCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: false },
);

conversationSchema.index({ userId: 1, partnerId: 1 }, { unique: true });
conversationSchema.index({ userId: 1, lastMessageAt: -1, partnerId: -1 });
conversationSchema.index({ lastMessageId: 1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
