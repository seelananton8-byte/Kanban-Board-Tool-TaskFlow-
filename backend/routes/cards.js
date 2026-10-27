import express from "express";
import List from "../models/List.js";
import Card from "../models/Card.js";
import { computePosition, nextPosition } from "../utils/position.js";
import { broadcast } from "../utils/realtime.js";

const router = express.Router({ mergeParams: true });
const EDITABLE = ["title", "description", "labels", "dueDate", "assignees"];

const listInBoard = (listId, boardId) => List.findOne({ _id: listId, board: boardId });

router.post("/", async (req, res) => {
  const { listId, title, description, labels, dueDate } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
  if (!(await listInBoard(listId, req.board._id))) {
    return res.status(400).json({ success: false, message: "List not in this board" });
  }
  const card = await Card.create({
    board: req.board._id,
    list: listId,
    title,
    description,
    labels,
    dueDate,
    position: await nextPosition(Card, { list: listId }),
  });
  broadcast(req, req.board.id, "card:created", { card });
  res.status(201).json({ success: true, card });
});

router.patch("/:cardId", async (req, res) => {
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => EDITABLE.includes(k)));

  if (updates.assignees) {
    const memberIds = req.board.members.map((m) => String(m.user));
    if (!updates.assignees.every((id) => memberIds.includes(String(id)))) {
      return res.status(400).json({ success: false, message: "Assignees must be board members" });
    }
  }
  const card = await Card.findOneAndUpdate({ _id: req.params.cardId, board: req.board._id }, updates, {
    new: true,
    runValidators: true,
  });
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  broadcast(req, req.board.id, "card:updated", { card });
  res.json({ success: true, card });
});

// Drag & drop: body { listId, index } -> persists list + position (same list or another list).
router.patch("/:cardId/move", async (req, res) => {
  const { listId, index } = req.body;
  const card = await Card.findOne({ _id: req.params.cardId, board: req.board._id });
  if (!card) return res.status(404).json({ success: false, message: "Card not found" });
  if (!(await listInBoard(listId, req.board._id))) {
    return res.status(400).json({ success: false, message: "List not in this board" });
  }
  card.list = listId;
  card.position = await computePosition(Card, { list: listId }, index, card._id);
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
