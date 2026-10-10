import mongoose from "mongoose";

export const MESSAGE_STATUSES = ["sent", "delivered", "read"];

const messageSchema = new mongoose.Schema(
  {
    chatroomId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: "sent",
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  { timestamps: false },
);

messageSchema.index({ chatroomId: 1, created_at: -1 });

messageSchema.methods.toPublic = function toPublic() {
  return {
    chatroomId: this.chatroomId.toString(),
    messageId: this.messageId,
    sender: this.sender.toString(),
    receiver: this.receiver.toString(),
    message: this.message,
    status: this.status,
    created_at: this.created_at,
  };
};

export const Message = mongoose.model("Message", messageSchema);
