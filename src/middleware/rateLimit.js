const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

export function rateLimitAuth(req, res, next) {
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
