import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Board from "./models/Board.js";

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true },
  });

  // Socket auth: client connects with io(url, { auth: { token: accessToken } })
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ACCESS_SECRET);
      socket.userId = payload.sub;
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("board:join", async (boardId, ack) => {
      try {
        const isMember = await Board.exists({ _id: boardId, "members.user": socket.userId });
        if (!isMember) return ack?.({ ok: false });
        socket.join(`board:${boardId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on("board:leave", (boardId) => socket.leave(`board:${boardId}`));
  });

  return io;
}