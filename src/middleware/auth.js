import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), process.env.JWT_SECRET);
    if (!payload?.sub || typeof payload.sub !== "string") {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }
}
