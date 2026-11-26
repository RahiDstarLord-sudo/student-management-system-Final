const configuredBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const API_BASE = configuredBase.replace(/\/$/, "");
export const API_ORIGIN = API_BASE.replace(/\/api$/i, "");
