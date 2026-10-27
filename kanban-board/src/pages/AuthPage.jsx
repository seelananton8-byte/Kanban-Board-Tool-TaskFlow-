import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
console.log("Google client id loaded:", Boolean(GOOGLE_ID));

export default function AuthPage() {
  const { user, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

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
      window.google.accounts.id.initialize({ client_id: GOOGLE_ID, callback: (r) => onGoogle.current(r) });
      window.google.accounts.id.renderButton(document.getElementById("google-btn"), {
        theme: "outline", size: "large", text: "continue_with", width: 380,
      });
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

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="brand"><span className="brand-mark" />TaskFlow</div>
        <h2>Plan the work.<br />Move it forward together.</h2>
        <p>Boards, lists and cards that update live for everyone on your team.</p>
      </aside>
      <main className="auth-card">
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <form onSubmit={submit}>
          {mode === "register" && <input placeholder="Name" value={form.name} onChange={set("name")} required />}
          <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
          <input type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required />
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit">{mode === "login" ? "Log in" : "Create account"}</button>
        </form>
        {GOOGLE_ID && <div id="google-btn" />}
        <button className="link-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
        </button>
      </main>
    </div>
  );
}
