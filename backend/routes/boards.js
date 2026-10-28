import express from "express";
import Board from "../models/Board.js";
import List from "../models/List.js";
import Card from "../models/Card.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { boardAccess, requireRole } from "../middleware/boardAccess.js";
import { broadcast } from "../utils/realtime.js";
import listRoutes from "./lists.js";
import cardRoutes from "./cards.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const boards = await Board.find({ "members.user": req.user.id }).sort({ updatedAt: -1 });
  res.json({ success: true, boards });
});

router.post("/", async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: "Title required" });

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
  if (!req.body.title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
  req.board.title = req.body.title;
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

// Invite by email (user must already be registered).
router.post("/:boardId/members", boardAccess, requireRole("owner", "admin"), async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
  if (!user) return res.status(404).json({ success: false, message: "No user with that email" });
  if (req.board.members.some((m) => m.user.equals(user._id))) {
    return res.status(409).json({ success: false, message: "Already a member" });
  }
  req.board.members.push({ user: user._id, role: req.body.role === "admin" ? "admin" : "member" });
  await req.board.save();
  broadcast(req, req.board.id, "member:added", { user: { _id: user.id, name: user.name, email: user.email } });
  res.status(201).json({ success: true, board: req.board });
});

// Remove a member (owner/admin) or leave the board (any member, for themselves).
router.delete("/:boardId/members/:userId", boardAccess, async (req, res) => {
  const { userId } = req.params;
  const target = req.board.members.find((m) => m.user.equals(userId));
  if (!target) return res.status(404).json({ success: false, message: "Not a member of this board" });
  if (target.role === "owner") return res.status(400).json({ success: false, message: "The owner cannot be removed" });

  const isSelf = userId === req.user.id;
  const canRemove = isSelf || req.role === "owner" || (req.role === "admin" && target.role === "member");
  if (!canRemove) return res.status(403).json({ success: false, message: "Insufficient permissions" });

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