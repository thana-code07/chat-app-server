import { createServer } from "node:http";
import { Server } from "socket.io";
import { authenticateSocket } from "./auth.js";
import { registerSocketHandlers } from "./handlers.js";
import { setIO } from "./realtime.js";

export function createSocketServer(app, { allowedOrigins } = {}) {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins?.length ? allowedOrigins : true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    maxHttpBufferSize: 64 * 1024,
  });

  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    registerSocketHandlers(socket).catch((err) => {
      console.error(err?.message || "Socket connection failed");
      socket.disconnect(true);
    });
  });
  setIO(io);
  return httpServer;
}
