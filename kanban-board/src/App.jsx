
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import BoardsPage from "./pages/BoardsPage";
import BoardPage from "./pages/BoardPage";

function Protected({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="page">Loading...</p>;
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<BoardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
