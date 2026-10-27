import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, LogOut } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const ACCENTS = ["#4C54F0", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9"];
const initials = (n = "") => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [boards, setBoards] = useState([]);

  useEffect(() => {
    api.get("/boards").then((r) => setBoards(r.data.boards)).catch(() => {});
  }, [pathname]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" />TaskFlow</div>
        <nav className="side-boards">
          <NavLink to="/" end className="side-link"><LayoutGrid size={16} />All boards</NavLink>
          <p className="side-title">Your boards</p>
          {boards.map((b, i) => (
            <NavLink key={b._id} to={`/boards/${b._id}`} className="side-link">
              <span className="board-dot" style={{ background: ACCENTS[i % 5] }} />
              <span className="side-name">{b.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <span className="avatar-chip lg">{initials(user.name)}</span>
          <div className="side-who"><strong>{user.name}</strong><small>{user.email}</small></div>
          <button className="icon-button" title="Log out" aria-label="Log out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>
      <div className="content"><Outlet /></div>
    </div>
  );
}
