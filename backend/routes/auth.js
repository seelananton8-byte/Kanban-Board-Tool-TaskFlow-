import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccess, signRefresh, sha256 } from "../utils/tokens.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function startSession(res, user) {
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [sha256(refreshToken)], $slice: -5 } } } // max 5 devices
  );
  res.cookie("refreshToken", refreshToken, cookieOptions);
  return { success: true, accessToken, user };
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    return res.status(400).json({ success: false, message: "Name, email and password (min 8 chars) required" });
  }
  if (await User.exists({ email: email.toLowerCase() })) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(await startSession(res, user));
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() }).select("+passwordHash");
  const ok = user?.passwordHash && (await bcrypt.compare(password || "", user.passwordHash));
  if (!ok) return res.status(401).json({ success: false, message: "Invalid email or password" });
  res.json(await startSession(res, user));
});

// Third-party: Google Sign-In. Frontend sends the Google ID token (credential).
router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ success: false, message: "Missing credential" });

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  if (!p?.email_verified) return res.status(401).json({ success: false, message: "Google email not verified" });

  let user = await User.findOne({ $or: [{ googleId: p.sub }, { email: p.email.toLowerCase() }] });
  if (!user) user = await User.create({ name: p.name || p.email, email: p.email, googleId: p.sub });
  else if (!user.googleId) {
    user.googleId = p.sub;
    await user.save();
  }
  res.json(await startSession(res, user));
});

// Refresh-token rotation with reuse detection.
router.post("/refresh", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: "No refresh token" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }

  const user = await User.findById(payload.sub).select("+refreshTokens");
  if (!user) return res.status(401).json({ success: false, message: "User not found" });

  const hashed = sha256(token);
  if (!user.refreshTokens.includes(hashed)) {
    // Token already used or stolen: kill every session for this user.
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
    res.clearCookie("refreshToken", { path: "/api/auth" });
    return res.status(401).json({ success: false, message: "Refresh token reuse detected" });
  }

  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: hashed } });
  res.json(await startSession(res, user));
});

router.post("/logout", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    try {
      const { sub } = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      await User.updateOne({ _id: sub }, { $pull: { refreshTokens: sha256(token) } });
    } catch {
      /* already invalid, nothing to revoke */
    }
  }
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, user });
});

export default router;
