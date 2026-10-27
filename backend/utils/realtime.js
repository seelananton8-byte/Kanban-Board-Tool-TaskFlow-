// Broadcast to everyone on the board EXCEPT the tab that made the change
// (client sends its socket id in the `x-socket-id` header).
export function broadcast(req, boardId, event, payload) {
  const io = req.app.get("io");
  if (!io) return;
  const room = io.to(`board:${boardId}`);
  const sid = req.get("x-socket-id");
  (sid ? room.except(sid) : room).emit(event, payload);
}
