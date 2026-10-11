import { verifyAccessToken } from "../middleware/auth.js";

function readToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  // chat_plugin 1.0.0 connects with the apiUrl only and never sets handshake auth.
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken) return queryToken;
  if (Array.isArray(queryToken) && typeof queryToken[0] === "string" && queryToken[0]) {
    return queryToken[0];
  }
  return null;
}

export async function authenticateSocket(socket, next) {
  try {
    const session = await verifyAccessToken(readToken(socket));
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
