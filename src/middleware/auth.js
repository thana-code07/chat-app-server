import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (payload?.typ !== "access" || typeof payload.sub !== "string") {
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
