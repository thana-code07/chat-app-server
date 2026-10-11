import mongoose from "mongoose";

const revokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken = mongoose.model("RevokedToken", revokedTokenSchema);
