import jwt from "jsonwebtoken";
import crypto from "crypto";

export const signAccess = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });

export const signRefresh = (user) =>
  jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
