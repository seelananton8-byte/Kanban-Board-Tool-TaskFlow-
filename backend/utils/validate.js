// Returns the trimmed string if it is a non-empty string within `max` chars, else null.
export const str = (v, max = 200) =>
  typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

export const isEmail = (v) =>
  typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());