const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = 10;
const SEND_WINDOW_MS = 10_000;
const SEND_MAX = 20;

const buckets = new Map();

function prune(bucket, key, windowMs, now) {
  const id = `${bucket}:${key}`;
  const recent = (buckets.get(id) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length) buckets.set(id, recent);
  else buckets.delete(id);
  return recent;
}

export function resetLimits() {
  buckets.clear();
}

export function windowSize(bucket, key) {
  return buckets.get(`${bucket}:${key}`)?.length ?? 0;
}

export function allowHit(bucket, key, windowMs, max, now = Date.now()) {
  const recent = prune(bucket, key, windowMs, now);
  if (recent.length >= max) return false;
  recent.push(now);
  buckets.set(`${bucket}:${key}`, recent);
  return true;
}

function tooMany(res, message) {
  return res.status(429).json({
    error: { code: "RATE_LIMITED", message },
  });
}

export function rateLimitAuth(req, res, next) {
  const ip = req.ip || "unknown";
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const keys = [`ip:${ip}`];
  if (username) keys.push(`name:${username}`);
  const now = Date.now();
  const blocked = keys.some((key) => {
    prune("auth", key, AUTH_WINDOW_MS, now);
    return windowSize("auth", key) >= AUTH_MAX;
  });
  if (blocked) return tooMany(res, "Too many attempts. Try again later.");
  for (const key of keys) allowHit("auth", key, AUTH_WINDOW_MS, AUTH_MAX, now);
  next();
}

export function rateLimitMessages(req, res, next) {
  if (allowHit("send", req.userId, SEND_WINDOW_MS, SEND_MAX)) return next();
  return tooMany(res, "Too many messages. Try again later.");
}
