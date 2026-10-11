import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error("MONGO_URL is not set");
  }

  const dbName = process.env.MONGO_DB || "chatapp";
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, { dbName });
    console.log(`MongoDB connected: ${dbName}`);
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}
