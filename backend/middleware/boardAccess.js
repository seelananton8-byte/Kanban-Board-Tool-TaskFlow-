import Board from "../models/Board.js";

// Loads the board and checks the caller is a member. Sets req.board and req.role.
export async function boardAccess(req, res, next) {
  const board = await Board.findById(req.params.boardId);
  if (!board) return res.status(404).json({ success: false, message: "Board not found" });

  const member = board.members.find((m) => m.user.equals(req.user.id));
  if (!member) return res.status(403).json({ success: false, message: "Not a board member" });

  req.board = board;
  req.role = member.role;
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.role)
      ? next()
      : res.status(403).json({ success: false, message: "Insufficient permissions" });
