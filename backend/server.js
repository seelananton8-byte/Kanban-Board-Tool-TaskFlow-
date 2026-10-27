import "dotenv/config";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/boards.js";
import { initSocket } from "./socket.js";

const REQUIRED = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`${key} is missing in .env`);
    process.exit(1);
  }
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), authRoutes);
app.use("/api/boards", boardRoutes);
app.get("/api/health", (_req, res) => res.json({ success: true, message: "TaskFlow API is running!" }));

// Express 5 forwards async errors here automatically.
app.use((err, _req, res, _next) => {
  if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid id" });
  if (err.name === "ValidationError") return res.status(400).json({ success: false, message: err.message });
  console.error(err);
  res.status(500).json({ success: false, message: "Server error" });
});

const server = http.createServer(app);
app.set("io", initSocket(server));

const PORT = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGODB_URI);
console.log("MongoDB connected");
server.listen(PORT, () => console.log(`TaskFlow API + Socket.io on port ${PORT}`));
