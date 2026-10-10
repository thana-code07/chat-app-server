import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error("MONGO_URL is not set");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB || "chatapp",
  });
}
