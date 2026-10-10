import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import userRouter from "./src/routes/user.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters");
}

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use("/api/users", userRouter);

app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Invalid JSON" },
    });
  }

  console.error(err?.message || "Unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
});

await connectDB();

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
