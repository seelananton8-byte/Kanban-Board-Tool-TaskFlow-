import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "../components/Feedback";
import { BoardSkeleton } from "../components/Skeleton";
import CardModal from "../components/CardModal";

const byPos = (a, b) => a.position - b.position;
const upsert = (arr, item) =>
  arr.some((x) => x._id === item._id) ? arr.map((x) => (x._id === item._id ? item : x)) : [...arr, item];
const initials = (name = "") => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));
const stop = (e) => e.stopPropagation(); // keep buttons from starting a drag

// Same fractional-position logic as the server, used for the optimistic update.
function newPosition(items, index) {
  const i = Math.max(0, Math.min(index, items.length));
  const prev = items[i - 1]?.position;
  const next = items[i]?.position;
  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return next - 1024;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}

function CardBody({ card, members, onDelete }) {
  const who = members.filter((m) => (card.assignees || []).includes(m._id));
  return (
    <>
      <div className="card-row">
        <div className="label-row">
          {(card.labels || []).map((l, i) => <span key={i} className={`task-tag tag-${l.color}`}>{l.text}</span>)}
        </div>
        {onDelete && (
          <button
            className="icon-button small"
            aria-label="Delete card"
            onMouseDown={stop}
            onTouchStart={stop}
            onClick={(e) => { e.stopPropagation(); onDelete(card._id); }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <h3>{card.title}</h3>
      <div className="card-meta">
        {card.dueDate ? (
          <span className={`due${new Date(card.dueDate) < startOfToday() ? " overdue" : ""}`}>
            {new Date(card.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        ) : <span />}
        <span className="avatars">
          {who.map((u) => <span key={u._id} className="avatar-chip" title={u.name}>{initials(u.name)}</span>)}
        </span>
      </div>
    </>
  );
}

function Card({ card, members, onOpen, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
    data: { type: "card" },
  });
  return (
    <article
      ref={setNodeRef}
      className="task-card"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      onClick={() => onOpen(card._id)}
      {...attributes}
      {...listeners}
    >
      <CardBody card={card} members={members} onDelete={onDelete} />
    </article>
  );
}

function Column({ list, cards, members, accent, onAddCard, onOpen, onDelete, onDeleteList }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `list:${list._id}`,
    data: { type: "list" },
  });
  const [title, setTitle] = useState("");
  return (
    <section
      className={`kanban-column accent-${accent}`}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.85 : 1 }}
    >
      <header className="column-header" {...attributes} {...listeners}>
        <div className="column-title"><h2>{list.title}</h2><span className="task-count">{cards.length}</span></div>
        <button className="icon-button small" title="Delete list" aria-label="Delete list"
          onMouseDown={stop} onTouchStart={stop} onClick={() => onDeleteList(list)}>
          <Trash2 size={14} />
        </button>
      </header>
      <SortableContext items={cards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
        <div className="task-list">
          {cards.map((c) => <Card key={c._id} card={c} members={members} onOpen={onOpen} onDelete={onDelete} />)}
        </div>
      </SortableContext>
      <form className="inline-form" onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onAddCard(list._id, title);
        setTitle("");
      }}>
        <input placeholder="+ Add card" value={title} onChange={(e) => setTitle(e.target.value)} />
      </form>
    </section>
  );
}

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, confirm, prompt } = useFeedback();
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [role, setRole] = useState("member");
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [listTitle, setListTitle] = useState("");
  const [invite, setInvite] = useState("");
  const [openId, setOpenId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [activeCard, setActiveCard] = useState(null);

  // Mouse: drag after 6px. Touch: long-press (so normal swipe still scrolls the page).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const fail = useCallback((e) => toast.error(e.response?.data?.message || "Something went wrong"), [toast]);
  const refreshBoard = useCallback(() => api.get(`/boards/${id}`).then((r) => setBoard(r.data.board)), [id]);

  const loadBoard = useCallback(
    () =>
      api.get(`/boards/${id}`).then((r) => {
        setBoard(r.data.board);
        setRole(r.data.role);
        setLists(r.data.lists);
        setCards(r.data.cards);
        setLoadError(null);
      }),
    [id]
  );

  useEffect(() => {
    setBoard(null);
    setLoadError(null);
    setShowMembers(false);
    loadBoard().catch((e) => setLoadError(e.response?.status || 500));
  }, [loadBoard]);

  // Real-time: join the board room, apply other users' changes, resync after a reconnect.
  useEffect(() => {
    const s = getSocket();
    let connectedOnce = false;
    const join = () => {
      s.emit("board:join", id);
      if (connectedOnce) loadBoard().catch(() => {}); // missed events while offline
      connectedOnce = true;
    };
    const card = ({ card }) => setCards((c) => upsert(c, card));
    const list = ({ list }) => setLists((l) => upsert(l, list));
    const handlers = {
      "card:created": card, "card:updated": card, "card:moved": card,
      "card:deleted": ({ cardId }) => setCards((c) => c.filter((x) => x._id !== cardId)),
      "list:created": list, "list:updated": list, "list:moved": list,
      "list:deleted": ({ listId }) => {
        setLists((l) => l.filter((x) => x._id !== listId));
        setCards((c) => c.filter((x) => x.list !== listId));
      },
      "board:updated": ({ title }) => setBoard((b) => b && { ...b, title }),
      "member:added": refreshBoard,
      "member:removed": ({ userId }) => {
        if (userId === user._id) {
          toast.info("You were removed from this board");
          navigate("/");
        } else refreshBoard();
      },
      "board:deleted": () => navigate("/"),
    };
    s.on("connect", join);
    Object.entries(handlers).forEach(([e, f]) => s.on(e, f));
    if (s.connected) join();
    return () => {
      s.emit("board:leave", id);
      s.off("connect", join);
      Object.entries(handlers).forEach(([e, f]) => s.off(e, f));
    };
  }, [id, navigate, refreshBoard, loadBoard, user._id, toast]);

  async function addCard(listId, title) {
    try {
      const { data } = await api.post(`/boards/${id}/cards`, { listId, title });
      setCards((c) => upsert(c, data.card));
    } catch (e) { fail(e); }
  }

  async function deleteCard(cardId) {
    const prev = cards;
    setCards((c) => c.filter((x) => x._id !== cardId));
    try {
      await api.delete(`/boards/${id}/cards/${cardId}`);
      toast.success("Card deleted");
    } catch (e) { setCards(prev); fail(e); }
  }

  async function saveCard(cardId, updates) {
    const { data } = await api.patch(`/boards/${id}/cards/${cardId}`, updates);
    setCards((c) => upsert(c, data.card));
    setOpenId(null);
    toast.success("Card saved");
  }

  async function addList(e) {
    e.preventDefault();
    if (!listTitle.trim()) return;
    try {
      const { data } = await api.post(`/boards/${id}/lists`, { title: listTitle });
      setLists((l) => upsert(l, data.list));
      setListTitle("");
    } catch (err) { fail(err); }
  }

  async function deleteList(list) {
    const ok = await confirm({
      title: "Delete this list?",
      message: `"${list.title}" and all its cards will be permanently deleted.`,
      confirmText: "Delete list",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/boards/${id}/lists/${list._id}`);
      setLists((l) => l.filter((x) => x._id !== list._id));
      setCards((c) => c.filter((x) => x.list !== list._id));
      toast.success("List deleted");
    } catch (e) { fail(e); }
  }

  async function renameBoard() {
    const title = await prompt({ title: "Rename board", label: "Board name", initial: board.title, confirmText: "Save" });
    if (!title || title === board.title) return;
    try {
      const { data } = await api.patch(`/boards/${id}`, { title });
      setBoard((b) => ({ ...b, title: data.board.title }));
      toast.success("Board renamed");
    } catch (e) { fail(e); }
  }

  async function deleteBoard() {
    const ok = await confirm({
      title: "Delete this board?",
      message: "All lists and cards on this board will be permanently deleted for everyone.",
      confirmText: "Delete board",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/boards/${id}`);
      toast.success("Board deleted");
      navigate("/");
    } catch (e) { fail(e); }
  }

  async function inviteMember(e) {
    e.preventDefault();
    try {
      await api.post(`/boards/${id}/members`, { email: invite });
      toast.success(`${invite} added to the board`);
      setInvite("");
      refreshBoard();
    } catch (err) { fail(err); }
  }

  async function removeMember(u) {
    const self = u._id === user._id;
    const ok = await confirm({
      title: self ? "Leave this board?" : `Remove ${u.name}?`,
      message: self ? "You will lose access to this board." : "They will lose access to this board immediately.",
      confirmText: self ? "Leave board" : "Remove member",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/boards/${id}/members/${u._id}`);
      if (self) {
        toast.success("You left the board");
        return navigate("/");
      }
      toast.success(`${u.name} removed`);
      await refreshBoard();
      setCards((c) => c.map((x) => ({ ...x, assignees: (x.assignees || []).filter((a) => a !== u._id) })));
    } catch (e) { fail(e); }
  }

  function moveList(active, over) {
    const activeId = String(active.id).slice(5);
    const overCard = cards.find((c) => c._id === over.id);
    const overId = overCard ? overCard.list : String(over.id).slice(5);
    if (activeId === overId) return;
    const sorted = [...lists].sort(byPos);
    const to = sorted.findIndex((l) => l._id === overId);
    if (to < 0) return;
    const others = sorted.filter((l) => l._id !== activeId);
    const prev = lists;
    setLists((ls) => ls.map((l) => (l._id === activeId ? { ...l, position: newPosition(others, to) } : l)));
    api.patch(`/boards/${id}/lists/${activeId}/move`, { index: to })
      .then(({ data }) => setLists((ls) => upsert(ls, data.list)))
      .catch((e) => { setLists(prev); fail(e); });
  }

  async function moveCard(active, over) {
    const card = cards.find((c) => c._id === active.id);
    if (!card) return;
    let listId, index;
    const overCard = cards.find((c) => c._id === over.id);
    if (overCard) {
      if (overCard._id === card._id) return;
      listId = overCard.list;
      index = cards.filter((c) => c.list === listId).sort(byPos).findIndex((c) => c._id === overCard._id);
    } else if (String(over.id).startsWith("list:")) {
      listId = String(over.id).slice(5);
      index = cards.filter((c) => c.list === listId && c._id !== card._id).length; // drop at end
    } else return;

    const current = cards.filter((c) => c.list === card.list).sort(byPos).findIndex((c) => c._id === card._id);
    if (listId === card.list && index === current) return;

    const others = cards.filter((c) => c.list === listId && c._id !== card._id).sort(byPos);
    const prev = cards;
    setCards((c) => c.map((x) => (x._id === card._id ? { ...x, list: listId, position: newPosition(others, index) } : x)));
    try {
      const { data } = await api.patch(`/boards/${id}/cards/${card._id}/move`, { listId, index });
      setCards((c) => upsert(c, data.card));
    } catch (e) { setCards(prev); fail(e); }
  }

  function handleDragStart({ active }) {
    if (active.data.current?.type === "card") setActiveCard(cards.find((c) => c._id === active.id) || null);
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    if (!over) return;
    if (active.data.current?.type === "list") moveList(active, over);
    else moveCard(active, over);
  }

  if (loadError) {
    return (
      <div className="board-page">
        <div className="board-scroll">
          <div className="empty">
            <h2>{loadError === 403 ? "No access to this board" : loadError === 404 ? "Board not found" : "Could not load this board"}</h2>
            <p>{loadError === 403 ? "Ask the board owner to invite you." : "It may have been deleted, or the link is wrong."}</p>
            <Link className="btn" to="/">Back to boards</Link>
          </div>
        </div>
      </div>
    );
  }
  if (!board) return <BoardSkeleton />;

  const members = board.members.map((m) => m.user).filter(Boolean);
  const sortedLists = [...lists].sort(byPos);
  const openCard = cards.find((c) => c._id === openId);

  return (
    <div className="board-page">
      <header className="board-head">
        <div>
          <h1>{board.title}</h1>
          <div className="board-sub members-wrap">
            <button className="members-btn" onClick={() => setShowMembers((s) => !s)}>
              <span className="avatars">
                {members.map((u) => <span key={u._id} className="avatar-chip" title={u.name}>{initials(u.name)}</span>)}
              </span>
              <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
            </button>
            {showMembers && (
              <div className="members-pop">
                {board.members.filter((m) => m.user).map((m) => (
                  <div key={m.user._id} className="member-row">
                    <span className="avatar-chip">{initials(m.user.name)}</span>
                    <div className="member-info"><strong>{m.user.name}</strong><small>{m.user.email}</small></div>
                    <span className="role-pill">{m.role}</span>
                    {m.role !== "owner" && (role === "owner" || (role === "admin" && m.role === "member") || m.user._id === user._id) && (
                      <button className="link-btn danger" onClick={() => removeMember(m.user)}>
                        {m.user._id === user._id ? "Leave" : "Remove"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="board-tools">
          <form className="inline-form" onSubmit={inviteMember}>
            <input type="email" placeholder="Invite by email" value={invite} onChange={(e) => setInvite(e.target.value)} required />
            <button className="btn">Invite</button>
          </form>
          {["owner", "admin"].includes(role) && <button className="link-btn" onClick={renameBoard}>Rename</button>}
          {role === "owner" && <button className="link-btn danger" onClick={deleteBoard}>Delete board</button>}
        </div>
      </header>

      <div className="board-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <SortableContext items={sortedLists.map((l) => `list:${l._id}`)} strategy={rectSortingStrategy}>
            <div className="kanban-board">
              {sortedLists.map((l, i) => (
                <Column key={l._id} list={l} members={members} accent={i % 5}
                  cards={cards.filter((c) => c.list === l._id).sort(byPos)}
                  onAddCard={addCard} onOpen={setOpenId} onDelete={deleteCard} onDeleteList={deleteList} />
              ))}
              <form className="kanban-column add-list" onSubmit={addList}>
                <input placeholder="+ Add list" value={listTitle} onChange={(e) => setListTitle(e.target.value)} />
              </form>
            </div>
          </SortableContext>
          <DragOverlay>
            {activeCard ? (
              <article className="task-card is-overlay">
                <CardBody card={activeCard} members={members} />
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      {openCard && <CardModal key={openCard._id} card={openCard} members={members} onSave={saveCard} onClose={() => setOpenId(null)} />}
    </div>
  );
}