import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

const FeedbackContext = createContext(null);
export const useFeedback = () => useContext(FeedbackContext);

let nextId = 0;

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, message) => {
      const id = ++nextId;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const ask = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({ value: opts.initial ?? "", ...opts });
      }),
    []
  );
  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  const api = useMemo(
    () => ({
      toast: {
        success: (m) => push("success", m),
        error: (m) => push("error", m),
        info: (m) => push("info", m),
      },
      confirm: (opts) => ask({ ...opts, kind: "confirm" }), // resolves true / false
      prompt: (opts) => ask({ ...opts, kind: "prompt" }), // resolves string / null
    }),
    [push, ask]
  );

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => e.key === "Escape" && close(dialog.kind === "prompt" ? null : false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <p>{t.message}</p>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="dlg-overlay" onClick={() => close(dialog.kind === "prompt" ? null : false)}>
          <form
            className="dlg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlg-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              close(dialog.kind === "prompt" ? dialog.value.trim() || null : true);
            }}
          >
            <h2 id="dlg-title">{dialog.title}</h2>
            {dialog.message && <p>{dialog.message}</p>}
            {dialog.kind === "prompt" && (
              <label className="dlg-field">
                {dialog.label}
                <input autoFocus value={dialog.value} onChange={(e) => setDialog((d) => ({ ...d, value: e.target.value }))} />
              </label>
            )}
            <div className="dlg-actions">
              <button type="button" className="btn ghost" onClick={() => close(dialog.kind === "prompt" ? null : false)}>Cancel</button>
              <button type="submit" autoFocus={dialog.kind === "confirm"} className={`btn${dialog.danger ? " danger" : ""}`}>
                {dialog.confirmText || "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}