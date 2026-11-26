const configuredBase =
  import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export const API_BASE = configuredBase.replace(/\/$/, "");
export const API_ORIGIN = new URL(API_BASE).origin;