import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
let accessToken = null;
let socketId = null;
let onAuthFail = () => {};

export const setToken = (t) => (accessToken = t);
export const getToken = () => accessToken;
export const setSocketId = (id) => (socketId = id);
export const setAuthFailHandler = (fn) => (onAuthFail = fn);

const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (socketId) config.headers["x-socket-id"] = socketId; // so server skips echo to this tab
  return config;
});

// One shared refresh call (refresh tokens rotate, so parallel calls would trigger reuse detection).
let refreshing = null;
export function refreshSession() {
  refreshing ??= axios
    .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
    .then((r) => {
      accessToken = r.data.accessToken;
      return r.data;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url.includes("/auth/")) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        onAuthFail();
      }
    }
    return Promise.reject(err);
  }
);

export default api;
