import { createContext, useContext, useEffect, useState } from "react";
import api, { refreshSession, setAuthFailHandler, setToken } from "../services/api";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthFailHandler(() => {
      setToken(null);
      setUser(null);
    });
    // Restore session from the httpOnly refresh cookie on page load.
    refreshSession()
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const start = (d) => {
    setToken(d.accessToken);
    setUser(d.user);
  };
  const login = async (email, password) => start((await api.post("/auth/login", { email, password })).data);
  const register = async (name, email, password) =>
    start((await api.post("/auth/register", { name, email, password })).data);
  const googleLogin = async (credential) => start((await api.post("/auth/google", { credential })).data);
  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>{children}</AuthContext.Provider>
  );
}
