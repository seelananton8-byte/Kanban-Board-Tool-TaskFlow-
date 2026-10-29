import express from "express";
import List from "../models/List.js";
import Card from "../models/Card.js";
import { computePosition, nextPosition } from "../utils/position.js";
import { broadcast } from "../utils/realtime.js";
import { str } from "../utils/validate.js";

const router = express.Router({ mergeParams: true });
const bad = (res, message) => res.status(400).json({ success: false, message });

router.post("/", async (req, res) => {
  const title = str(req.body.title, 80);
  if (!title) return bad(res, "Title is required (max 80 characters)");
  const list = await List.create({
    board: req.board._id,
    title,
    position: await nextPosition(List, { board: req.board._id }),
  });
  broadcast(req, req.board.id, "list:created", { list });
  res.status(201).json({ success: true, list });
});

router.patch("/:listId", async (req, res) => {
  const title = str(req.body.title, 80);
  if (!title) return bad(res, "Title is required (max 80 characters)");
  const list = await List.findOneAndUpdate(
    { _id: req.params.listId, board: req.board._id },
    { title },
    { new: true, runValidators: true }
  );
  if (!list) return res.status(404).json({ success: false, message: "List not found" });
  broadcast(req, req.board.id, "list:updated", { list });
  res.json({ success: true, list });
});

// Reorder a column: body { index }
router.patch("/:listId/move", async (req, res) => {
  if (!Number.isFinite(Number(req.body.index))) return bad(res, "index must be a number");
  const list = await List.findOne({ _id: req.params.listId, board: req.board._id });
  if (!list) return res.status(404).json({ success: false, message: "List not found" });
  list.position = await computePosition(List, { board: req.board._id }, Number(req.body.index), list._id);
  await list.save();
  broadcast(req, req.board.id, "list:moved", { list });
  res.json({ success: true, list });
});

router.delete("/:listId", async (req, res) => {
  const list = await List.findOneAndDelete({ _id: req.params.listId, board: req.board._id });
  if (!list) return res.status(404).json({ success: false, message: "List not found" });
  await Card.deleteMany({ list: list._id });
  broadcast(req, req.board.id, "list:deleted", { listId: list.id });
  res.json({ success: true });
});

export default router;