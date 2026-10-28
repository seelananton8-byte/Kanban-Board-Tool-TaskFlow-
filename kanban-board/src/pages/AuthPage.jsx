import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const PREVIEW = [
  { title: "To Do", col: "#4c54f0", cards: [["Wireframe dashboard", "pink", "Design"], ["Write API docs", "purple", "Docs"]] },
  { title: "In Progress", col: "#f59e0b", cards: [["Build auth flow", "blue", "Backend"], ["Live card sync", "orange", "Realtime"]] },
  { title: "Done", col: "#10b981", cards: [["Set up database", "green", "Setup"]] },
];

export default function AuthPage() {
  const { user, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Always call the latest handler without re-running the effect.
  const onGoogle = useRef();
  onGoogle.current = async ({ credential }) => {
    try {
      await googleLogin(credential);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed");
    }
  };

  // Google Sign-In button (only if VITE_GOOGLE_CLIENT_ID is set). Runs once.
  useEffect(() => {
    if (!GOOGLE_ID) return;
    const SRC = "https://accounts.google.com/gsi/client";
    const render = () => {
      const el = document.getElementById("google-btn");
      if (!el) return;
      const width = Math.min(400, Math.max(200, Math.round(el.clientWidth) || 320));
      window.google.accounts.id.initialize({ client_id: GOOGLE_ID, callback: (r) => onGoogle.current(r) });
      window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "continue_with", width });
    };
    if (window.google?.accounts?.id) {
      render();
      return;
    }
    let script = document.querySelector(`script[src="${SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script.removeEventListener("load", render);
  }, []);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isLogin = mode === "login";
  const switchMode = (m) => {
    setMode(m);
    setError("");
  };

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="au-shell">
      <aside className="au-brand">
        <div className="brand"><span className="brand-mark" />TaskFlow</div>

        <div className="au-copy">
          <h2>Plan the work.<br />Move it forward together.</h2>
          <p>Boards, lists and cards that update live for everyone on your team.</p>
        </div>

        <div className="au-window" aria-hidden="true">
          <div className="au-window-bar">
            <span /><span /><span />
            <em>Web Development</em>
            <b className="au-live"><i />Live</b>
          </div>
          <div className="au-preview">
            {PREVIEW.map((c) => (
              <div key={c.title} className="au-col" style={{ "--col": c.col }}>
                <strong>{c.title}</strong>
                {c.cards.map(([t, color, tag]) => (
                  <div key={t} className="au-card">
                    <span className={`task-tag tag-${color}`}>{tag}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <p className="au-foot">Built with React, Express, MongoDB and Socket.io</p>
      </aside>

      <main className="au-main">
        <div className="au-card-wrap">
          <div className="au-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={isLogin} onClick={() => switchMode("login")}>Log in</button>
            <button type="button" role="tab" aria-selected={!isLogin} onClick={() => switchMode("register")}>Sign up</button>
          </div>

          <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="au-sub">{isLogin ? "Log in to continue to your boards." : "Start planning with your team in minutes."}</p>

          <form onSubmit={submit}>
            {!isLogin && (
              <div className="au-field">
                <label htmlFor="name">Full name</label>
                <div className="au-input">
                  <User size={16} className="au-ico" />
                  <input id="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={set("name")} required />
                </div>
              </div>
            )}
            <div className="au-field">
              <label htmlFor="email">Email</label>
              <div className="au-input">
                <Mail size={16} className="au-ico" />
                <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
              </div>
            </div>
            <div className="au-field">
              <label htmlFor="password">Password</label>
              <div className="au-input">
                <Lock size={16} className="au-ico" />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder={isLogin ? "Your password" : "At least 8 characters"}
                  value={form.password}
                  onChange={set("password")}
                  required
                />
                <button type="button" className="icon-button au-eye" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="btn au-submit" type="submit" disabled={busy}>
              {busy ? "Please wait..." : isLogin ? "Log in" : "Create account"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          {GOOGLE_ID && (
            <>
              <div className="au-divider"><span>or continue with</span></div>
              <div id="google-btn" />
            </>
          )}

          <p className="au-secure"><Lock size={12} /> Secured with JWT authentication</p>
        </div>
      </main>
    </div>
  );
}