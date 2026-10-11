import mongoose from "mongoose";

const revocationSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

revocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Revocation = mongoose.model("Revocation", revocationSchema);
