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
import { origins } from "./utils/origins.js";

const isProd = process.env.NODE_ENV === "production";

for (const key of ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  if (!process.env[key]) {
    console.error(`${key} is missing in .env`);
    process.exit(1);
  }
}
for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  if (process.env[key].length < 32) {
    const msg = `${key} should be at least 32 characters`;
    if (isProd) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`Warning: ${msg}`);
  }
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  process.exit(1);
}

const app = express();
if (isProd) app.set("trust proxy", 1); // behind Render/Heroku-style proxies (needed for rate limiting)
app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300 }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), authRoutes);
app.use("/api/boards", boardRoutes);
app.get("/api/health", (_req, res) => res.json({ success: true, message: "TaskFlow API is running!" }));

app.use((_req, res) => res.status(404).json({ success: false, message: "Not found" }));

// Express 5 forwards async errors here automatically.
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON" });
  if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid id" });
  if (err.name === "ValidationError") return res.status(400).json({ success: false, message: err.message });
  console.error(err);
  res.status(500).json({ success: false, message: "Server error" });
});

const server = http.createServer(app);
app.set("io", initSocket(server));

const PORT = process.env.PORT || 5000;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
}
server.listen(PORT, () => console.log(`TaskFlow API + Socket.io on port ${PORT}`));