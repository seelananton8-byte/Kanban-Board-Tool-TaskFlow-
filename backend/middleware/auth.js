import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Missing access token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired access token" });
  }
}
