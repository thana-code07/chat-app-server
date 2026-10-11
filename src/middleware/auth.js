import { isSessionBlocked } from "../services/revocationService.js";
import { readAccessToken } from "../services/tokenService.js";

export async function verifyAccessToken(token) {
  const session = readAccessToken(token);
  if (!session || session.expiresAt <= Date.now()) return null;
  if (await isSessionBlocked(session)) return null;
  return session;
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const session = header?.startsWith("Bearer ")
      ? await verifyAccessToken(header.slice("Bearer ".length))
      : null;
    if (!session) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    req.userId = session.userId;
    next();
  } catch (err) {
    next(err);
  }
}
