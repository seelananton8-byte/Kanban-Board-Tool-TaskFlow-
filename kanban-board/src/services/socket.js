import { io } from "socket.io-client";
import { getToken, refreshSession, setSocketId } from "./api";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: (cb) => cb({ token: getToken() }), // fresh token on every (re)connect
    });
    socket.on("connect", () => setSocketId(socket.id));
    socket.on("connect_error", async (err) => {
      if (err.message === "unauthorized") {
        try {
          await refreshSession();
          socket.connect();
        } catch {
          /* session expired: AuthContext will send user to login */
        }
      }
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  setSocketId(null);
}
