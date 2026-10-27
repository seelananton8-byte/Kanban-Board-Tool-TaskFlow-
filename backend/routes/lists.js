import express from "express";
import List from "../models/List.js";
import Card from "../models/Card.js";
import { computePosition, nextPosition } from "../utils/position.js";
import { broadcast } from "../utils/realtime.js";

const router = express.Router({ mergeParams: true });

router.post("/", async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
  const list = await List.create({
    board: req.board._id,
    title: req.body.title,
    position: await nextPosition(List, { board: req.board._id }),
  });
  broadcast(req, req.board.id, "list:created", { list });
  res.status(201).json({ success: true, list });
});

router.patch("/:listId", async (req, res) => {
  const list = await List.findOneAndUpdate(
    { _id: req.params.listId, board: req.board._id },
    { title: req.body.title },
    { new: true, runValidators: true }
  );
  if (!list) return res.status(404).json({ success: false, message: "List not found" });
  broadcast(req, req.board.id, "list:updated", { list });
  res.json({ success: true, list });
});

// Reorder a column: body { index }
router.patch("/:listId/move", async (req, res) => {
  const list = await List.findOne({ _id: req.params.listId, board: req.board._id });
  if (!list) return res.status(404).json({ success: false, message: "List not found" });
  list.position = await computePosition(List, { board: req.board._id }, req.body.index, list._id);
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
