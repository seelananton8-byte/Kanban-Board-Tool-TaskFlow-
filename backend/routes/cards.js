import express from "express";
import List from "../models/List.js";
import Card from "../models/Card.js";
import User from "../models/User.js";
import { computePosition, nextPosition } from "../utils/position.js";
import { broadcast } from "../utils/realtime.js";
import { str } from "../utils/validate.js";
import { origins } from "../utils/origins.js";
import { assignedMail } from "../utils/mailer.js";

const router = express.Router({ mergeParams: true });
const COLORS = ["blue", "purple", "pink", "orange", "green"];
const bad = (res, message) => res.status(400).json({ success: false, message });
const listInBoard = (listId, boardId) => List.findOne({ _id: listId, board: boardId });

// Validates and whitelists card fields. Returns { updates } or { error }.
function cleanCard(body, memberIds) {
  const u = {};
  if ("title" in body) {
    const t = str(body.title, 120);
    if (!t) return { error: "Title is required (max 120 characters)" };
    u.title = t;
  }
  if ("description" in body) {
    if (typeof body.description !== "string" || body.description.length > 2000) {
      return { error: "Description must be text up to 2000 characters" };
    }
    u.description = body.description;
  }
  if ("completed" in body) {
    if (typeof body.completed !== "boolean") return { error: "completed must be true or false" };
    u.completed = body.completed;
  }
  if ("dueDate" in body) {
    if (body.dueDate === null || body.dueDate === "") u.dueDate = null;
    else {
      const d = new Date(body.dueDate);
      if (typeof body.dueDate !== "string" || Number.isNaN(d.getTime())) return { error: "Invalid due date" };
      u.dueDate = d;
    }
  }
  if ("labels" in body) {
    if (!Array.isArray(body.labels) || body.labels.length > 10) return { error: "Up to 10 labels allowed" };
    const labels = [];
    for (const l of body.labels) {
      const text = str(l?.text, 30);
      if (!text || !COLORS.includes(l.color)) return { error: "Invalid label" };
      labels.push({ text, color: l.color });
    }
    u.labels = labels;
  }
  if ("assignees" in body) {
    if (!Array.isArray(body.assignees) || !body.assignees.every((a) => memberIds.includes(String(a)))) {
      return { error: "Assignees must be board members" };
    }
    u.assignees = body.assignees;
  }
  return { updates: u };
}

const memberIdsOf = (board) => board.members.map((m) => String(m.user));

// Email people who were newly assigned to a card (never the person who assigned them).
async function notifyAssigned(req, card, oldAssignees, newAssignees) {
  const before = oldAssignees.map(String);
  const fresh = [...new Set(newAssignees.map(String))].filter((id) => !before.includes(id) && id !== req.user.id);
  if (!fresh.length) return;
  const [people, me] = await Promise.all([
    User.find({ _id: { $in: fresh } }).select("email"),
    User.findById(req.user.id).select("name"),
  ]);
  people.forEach((p) =>
    assignedMail({
      to: p.email,
      assigner: me?.name || "Someone",
      cardTitle: card.title,
      boardTitle: req.board.title,
      url: `${origins[0]}/boards/${req.board.id}`,
    })
  );
}

router.post("/", async (req, res) => {
  const { listId } = req.body;
  if (typeof listId !== "string" || !(await listInBoard(listId, req.board._id))) {
    return bad(res, "List not in this board");
  }
  const src = {};
  for (const k of ["title", "description", "labels", "dueDate"]) if (req.body[k] !== undefined) src[k] = req.body[k];
  if (!("title" in src)) return bad(res, "Title is required");

  const { updates, error } = cleanCard(src, memberIdsOf(req.board));
  if (error) return bad(res, error);

  const card = await Card.create({
    ...updates,
    board: req.board._id,
    list: listId,
    position: await nextPosition(Card, { list: listId }),
  });
  broadcast(req, req.board.id, "card:created", { card });
  res.status(201).json({ success: true, card });
});

router.patch("/:cardId", async (req, res) => {
  const { updates, error } = cleanCard(req.body, memberIdsOf(req.board));
  if (error) return bad(res, error);

  const before = await Card.findOne({ _id: req.params.cardId, board: req.board._id }).select("assignees");
  if (!before) return res.status(404).json({ success: false, message: "Card not found" });

  const card = await Card.findOneAndUpdate({ _id: req.params.cardId, board: req.board._id }, updates, {
    new: true,
    runValidators: true,
  });
  if (updates.assignees) await notifyAssigned(req, card, before.assignees, updates.assignees);

  broadcast(req, req.board.id, "card:updated", { card });
  res.json({ success: true, card });
});

// Drag & drop: body { listId, index } -> persists list + position (same list or another list).
router.patch("/:cardId/move", async (req, res) => {
  const { listId, index } = req.body;
  if (typeof listId !== "string" || !Number.isFinite(Number(index))) return bad(res, "listId and index are required");

  const card = await Card.findOne({ _id: req.params.cardId, board: req.board._id });
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  if (!(await listInBoard(listId, req.board._id))) return bad(res, "List not in this board");

  card.list = listId;
  card.position = await computePosition(Card, { list: listId }, Number(index), card._id);
  await card.save();
  broadcast(req, req.board.id, "card:moved", { card });
  res.json({ success: true, card });
});

router.delete("/:cardId", async (req, res) => {
  const card = await Card.findOneAndDelete({ _id: req.params.cardId, board: req.board._id });
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  broadcast(req, req.board.id, "card:deleted", { cardId: card.id, listId: String(card.list) });
  res.json({ success: true });
});

export default router;