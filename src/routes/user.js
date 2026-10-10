import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

const dummyHash = bcrypt.hashSync("not-a-real-password", 12);

function rateLimitAuth(req, res, next) {
  const now = Date.now();
  const key = req.ip || "unknown";
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    return res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
    });
  }
  recent.push(now);
  attempts.set(key, recent);
  next();
}

function validateCredentials(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  const { username, password } = body;
  if (typeof username !== "string" || !USERNAME_RE.test(username.trim())) {
    return "Username must be 3-32 characters and use only letters, numbers, and underscores";
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return "Password must be 8-72 characters";
  }
  return null;
}

function publicAuth(user) {
  return {
    token: signToken(user.id),
    user: user.toPublic(),
  };
}

router.post("/register", rateLimitAuth, async (req, res) => {
  const message = validateCredentials(req.body);
  if (message) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message },
    });
  }

  try {
    const user = await User.create({
      username: req.body.username.trim(),
      password: req.body.password,
      lastSeen: new Date(),
    });
    return res.status(201).json(publicAuth(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        error: { code: "USERNAME_TAKEN", message: "Username is already taken" },
      });
    }
    throw err;
  }
});

router.post("/login", rateLimitAuth, async (req, res) => {
  const message = validateCredentials(req.body);
  if (message) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message },
    });
  }

  const user = await User.findOne({ username: req.body.username.trim().toLowerCase() }).select(
    "+password",
  );
  const matches = await bcrypt.compare(req.body.password, user?.password ?? dummyHash);
  if (!user || !matches) {
    return res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
    });
  }

  const lastSeen = new Date();
  await User.updateOne({ _id: user._id }, { lastSeen });
  user.lastSeen = lastSeen;

  return res.json(publicAuth(user));
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
  return res.json({ user: user.toPublic() });
});

router.patch("/last-seen", requireAuth, async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { lastSeen: new Date() },
    { new: true },
  );
  if (!user) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
  return res.json({ user: user.toPublic() });
});

export default router;
