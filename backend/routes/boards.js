import express from "express";
import Board from "../models/Board.js";
import List from "../models/List.js";
import Card from "../models/Card.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { boardAccess, requireRole } from "../middleware/boardAccess.js";
import { broadcast } from "../utils/realtime.js";
import { isEmail, str } from "../utils/validate.js";
import { origins } from "../utils/origins.js";
import { inviteMail } from "../utils/mailer.js";
import listRoutes from "./lists.js";
import cardRoutes from "./cards.js";

const router = express.Router();
router.use(requireAuth);
const fail = (res, status, message) => res.status(status).json({ success: false, message });

router.get("/", async (req, res) => {
  const boards = await Board.find({ "members.user": req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, boards });
});

router.post("/", async (req, res) => {
  const title = str(req.body.title, 80);
  if (!title) return fail(res, 400, "Title is required (max 80 characters)");

  const board = await Board.create({
    title,
    owner: req.user.id,
    members: [{ user: req.user.id, role: "owner" }],
  });
  await List.insertMany(
    ["To Do", "In Progress", "Done"].map((t, i) => ({ board: board._id, title: t, position: (i + 1) * 1024 }))
  );
  res.status(201).json({ success: true, board });
});

router.get("/:boardId", boardAccess, async (req, res) => {
  const [board, lists, cards] = await Promise.all([
    Board.findById(req.board._id).populate("members.user", "name email"),
    List.find({ board: req.board._id }).sort({ position: 1 }),
    Card.find({ board: req.board._id }).sort({ position: 1 }),
  ]);
  res.json({ success: true, board, lists, cards, role: req.role });
});

router.patch("/:boardId", boardAccess, requireRole("owner", "admin"), async (req, res) => {
  const title = str(req.body.title, 80);
  if (!title) return fail(res, 400, "Title is required (max 80 characters)");
  req.board.title = title;
  await req.board.save();
  broadcast(req, req.board.id, "board:updated", { title: req.board.title });
  res.json({ success: true, board: req.board });
});

router.delete("/:boardId", boardAccess, requireRole("owner"), async (req, res) => {
  await Promise.all([
    Card.deleteMany({ board: req.board._id }),
    List.deleteMany({ board: req.board._id }),
    req.board.deleteOne(),
  ]);
  broadcast(req, req.board.id, "board:deleted", { boardId: req.board.id });
  res.json({ success: true });
});

// Invite by email (user must already be registered). Invited users are always plain members;
// only the owner can promote someone to admin (see the role route below).
router.post("/:boardId/members", boardAccess, requireRole("owner", "admin"), async (req, res) => {
  if (!isEmail(req.body.email)) return fail(res, 400, "Enter a valid email address");
  const user = await User.findOne({ email: req.body.email.trim().toLowerCase() });
  if (!user) return fail(res, 404, "No user with that email");
  if (req.board.members.some((m) => m.user.equals(user._id))) return fail(res, 409, "Already a member");

  req.board.members.push({ user: user._id, role: "member" });
  await req.board.save();
  broadcast(req, req.board.id, "member:added", { user: { _id: user.id, name: user.name, email: user.email } });

  const inviter = await User.findById(req.user.id).select("name");
  inviteMail({
    to: user.email,
    inviter: inviter?.name || "Someone",
    boardTitle: req.board.title,
    url: `${origins[0]}/boards/${req.board.id}`,
  });

  res.status(201).json({ success: true, board: req.board });
});

// Owner promotes / demotes a member: body { role: "admin" | "member" }.
router.patch("/:boardId/members/:userId", boardAccess, requireRole("owner"), async (req, res) => {
  const { role } = req.body;
  if (!["admin", "member"].includes(role)) return fail(res, 400, "Role must be admin or member");
  const target = req.board.members.find((m) => m.user.equals(req.params.userId));
  if (!target) return fail(res, 404, "Not a member of this board");
  if (target.role === "owner") return fail(res, 400, "The owner's role cannot be changed");

  target.role = role;
  await req.board.save();
  broadcast(req, req.board.id, "member:updated", { userId: req.params.userId, role });
  res.json({ success: true });
});

// Remove a member (owner/admin) or leave the board (any member, for themselves).
router.delete("/:boardId/members/:userId", boardAccess, async (req, res) => {
  const { userId } = req.params;
  const target = req.board.members.find((m) => m.user.equals(userId));
  if (!target) return fail(res, 404, "Not a member of this board");
  if (target.role === "owner") return fail(res, 400, "The owner cannot be removed");

  const isSelf = userId === req.user.id;
  const canRemove = isSelf || req.role === "owner" || (req.role === "admin" && target.role === "member");
  if (!canRemove) return fail(res, 403, "Insufficient permissions");

  req.board.members = req.board.members.filter((m) => !m.user.equals(userId));
  await req.board.save();
  await Card.updateMany({ board: req.board._id }, { $pull: { assignees: userId } });

  broadcast(req, req.board.id, "member:removed", { userId });

  // stop the removed user's sockets from receiving further board events
  const io = req.app.get("io");
  if (io) {
    const sockets = await io.in(`board:${req.board.id}`).fetchSockets();
    sockets.filter((s) => s.data.userId === userId).forEach((s) => s.leave(`board:${req.board.id}`));
  }
  res.json({ success: true });
});

router.use("/:boardId/lists", boardAccess, listRoutes);
router.use("/:boardId/cards", boardAccess, cardRoutes);

export default router;