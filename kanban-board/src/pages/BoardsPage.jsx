import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const ACCENTS = ["#4C54F0", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9"];

export default function BoardsPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/boards").then((r) => setBoards(r.data.boards)).finally(() => setLoaded(true));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data } = await api.post("/boards", { title });
    navigate(`/boards/${data.board._id}`);
  }

  return (
    <div className="board-page">
      <header className="board-head">
        <div>
          <h1>Boards</h1>
          <div className="board-sub">Open a board or start a new one.</div>
        </div>
        <form className="inline-form" onSubmit={create}>
          <input placeholder="New board name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn">Create board</button>
        </form>
      </header>
      <div className="board-scroll">
        {loaded && boards.length === 0 ? (
          <div className="empty">
            <h2>No boards yet</h2>
            <p>Create your first board to start planning. It comes with To Do, In Progress and Done lists.</p>
          </div>
        ) : (
          <div className="board-grid">
            {boards.map((b, i) => (
              <Link key={b._id} to={`/boards/${b._id}`} className="board-tile" style={{ "--col": ACCENTS[i % 5] }}>
                <strong>{b.title}</strong>
                <span>{b.members.length} {b.members.length === 1 ? "member" : "members"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
