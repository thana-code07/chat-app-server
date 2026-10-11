import { verifyAccessToken } from "../middleware/auth.js";

export function readSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return null;
}

export async function authenticateSocket(socket, next) {
  try {
    const session = await verifyAccessToken(readSocketToken(socket));
    if (!session) {
      next(new Error("Authentication required"));
      return;
    }

    socket.data.userId = session.userId;
    socket.data.expiresAt = session.expiresAt;
    socket.data.jti = session.jti;
    next();
  } catch (err) {
    next(err);
  }
}
