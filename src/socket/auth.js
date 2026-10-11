import { verifyAccessToken } from "../middleware/auth.js";

function readToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return null;
}

export function authenticateSocket(socket, next) {
  const session = verifyAccessToken(readToken(socket));
  if (!session || session.expiresAt <= Date.now()) {
    next(new Error("Authentication required"));
    return;
  }

  socket.data.userId = session.userId;
  socket.data.expiresAt = session.expiresAt;
  next();
}
