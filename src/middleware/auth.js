import jwt from "jsonwebtoken";

export function verifyAccessToken(token) {
  if (typeof token !== "string" || !token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload?.typ !== "access" || typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : 0,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const session = header?.startsWith("Bearer ")
    ? verifyAccessToken(header.slice("Bearer ".length))
    : null;
  if (!session) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  req.userId = session.userId;
  next();
}
