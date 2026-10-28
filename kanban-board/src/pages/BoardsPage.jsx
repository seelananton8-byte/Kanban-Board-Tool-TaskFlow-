import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../components/Feedback";
import { BoardsSkeleton } from "../components/Skeleton";

const ACCENTS = ["#4C54F0", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function BoardsPage() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/boards")
      .then((r) => setBoards(r.data.boards))
      .catch(() => toast.error("Could not load your boards"))
      .finally(() => setLoaded(true));
  }, [toast]);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const { data } = await api.post("/boards", { title });
      navigate(`/boards/${data.board._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create the board");
    }
  }

  return (
    <div className="board-page">
      <header className="board-head">
        <div>
          <p className="eyebrow">{greeting()}, {user.name.split(" ")[0]}</p>
          <h1>Your boards</h1>
          <div className="board-sub">
            {loaded ? `${boards.length} ${boards.length === 1 ? "board" : "boards"}` : "Loading boards..."}
          </div>
        </div>
        <form className="inline-form create-form" onSubmit={create}>
          <input placeholder="New board name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn"><Plus size={16} /> Create board</button>
        </form>
      </header>
      <div className="board-scroll">
        {!loaded ? (
          <BoardsSkeleton />
        ) : boards.length === 0 ? (
          <div className="empty">
            <h2>No boards yet</h2>
            <p>Create your first board to start planning. It comes with To Do, In Progress and Done lists.</p>
          </div>
        ) : (
          <div className="board-grid">
            {boards.map((b, i) => (
              <Link key={b._id} to={`/boards/${b._id}`} className="board-tile" style={{ "--col": ACCENTS[i % 5] }}>
                <span className="tile-icon">{b.title.charAt(0).toUpperCase()}</span>
                <strong>{b.title}</strong>
                <span className="tile-foot">
                  {b.members.length} {b.members.length === 1 ? "member" : "members"}
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}