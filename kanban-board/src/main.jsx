import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import BoardsPage from "./pages/BoardsPage";
import BoardPage from "./pages/BoardPage";
import "./index.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page">Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route element={<Protected><AppShell /></Protected>}>
            <Route path="/" element={<BoardsPage />} />
            <Route path="/boards/:id" element={<BoardPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
