import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccess, signRefresh, sha256 } from "../utils/tokens.js";
import { isEmail, str } from "../utils/validate.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const isProd = process.env.NODE_ENV === "production";

// Deployed frontend and backend are on different domains, so the cookie must be SameSite=None + Secure.
const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const clearOptions = { path: cookieOptions.path, sameSite: cookieOptions.sameSite, secure: cookieOptions.secure };

const fail = (res, status, message) => res.status(status).json({ success: false, message });

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
  const name = str(req.body.name, 60);
  const email = isEmail(req.body.email) ? req.body.email.trim().toLowerCase() : null;
  const { password } = req.body;

  if (!name) return fail(res, 400, "Name is required (max 60 characters)");
  if (!email) return fail(res, 400, "Enter a valid email address");
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return fail(res, 400, "Password must be 8 to 72 characters");
  }
  if (await User.exists({ email })) return fail(res, 409, "Email already registered");

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json(await startSession(res, user));
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email) || typeof password !== "string" || password.length > 72) {
    return fail(res, 401, "Invalid email or password");
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  const ok = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return fail(res, 401, "Invalid email or password");
  res.json(await startSession(res, user));
});

// Third-party: Google Sign-In. Frontend sends the Google ID token (credential).
router.post("/google", async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return fail(res, 501, "Google login is not configured");
  const { credential } = req.body;
  if (typeof credential !== "string") return fail(res, 400, "Missing credential");

  let p;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    p = ticket.getPayload();
  } catch {
    return fail(res, 401, "Invalid Google token");
  }
  if (!p?.email || !p.email_verified) return fail(res, 401, "Google email not verified");

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
  if (!token) return fail(res, 401, "No refresh token");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return fail(res, 401, "Invalid refresh token");
  }

  const user = await User.findById(payload.sub).select("+refreshTokens");
  if (!user) return fail(res, 401, "User not found");

  const hashed = sha256(token);
  if (!user.refreshTokens.includes(hashed)) {
    // Token already used or stolen: kill every session for this user.
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
    res.clearCookie("refreshToken", clearOptions);
    return fail(res, 401, "Refresh token reuse detected");
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
  res.clearCookie("refreshToken", clearOptions);
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return fail(res, 404, "User not found");
  res.json({ success: true, user });
});

export default router;