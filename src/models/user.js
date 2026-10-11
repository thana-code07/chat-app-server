import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    conversationsSeeded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email ?? null,
    lastSeen: this.lastSeen,
  };
};

export const User = mongoose.model("User", userSchema);
