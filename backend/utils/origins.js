// CLIENT_URL can hold several origins, comma separated (e.g. local + deployed frontend).
export const origins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);