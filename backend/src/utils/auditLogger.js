
const db = require("../config/db");

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "session_token",
  "session_token_hash",
  "authorization",
  "secret",
  "jwt_secret",
]);

function sanitize(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value !== "object") {
    return value;
  }

  const cleaned = {};

  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = sanitize(item);
    }
  }

  return cleaned;
}

function writeAuditLog(req, {
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
}) {
  if (!req || !req.user || !req.user.id) {
    console.error("Audit log skipped: authenticated actor not found.");
    return;
  }

  if (
    typeof action !== "string" ||
    !action.trim() ||
    typeof entityType !== "string" ||
    !entityType.trim()
  ) {
    console.error("Audit log skipped: action and entityType are required.");
    return;
  }

  const actorUserId = req.user.id;
  const ipAddress = req.ip || req.socket?.remoteAddress || null;

  let safeOldValues;
  let safeNewValues;

  try {
    safeOldValues = oldValues === null ? null : JSON.stringify(sanitize(oldValues));
    safeNewValues = newValues === null ? null : JSON.stringify(sanitize(newValues));
  } catch (err) {
    console.error("Audit log serialization error:", err.message);
    return;
  }

  db.query(
    `INSERT INTO audit_logs
      (actor_user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      action.trim().slice(0, 100),
      entityType.trim().slice(0, 100),
      entityId === null || entityId === undefined ? null : String(entityId).slice(0, 100),
      safeOldValues,
      safeNewValues,
      ipAddress,
    ],
    (err) => {
      if (err) {
        console.error("Failed to write audit log:", err.message);
      }
    }
  );
}

module.exports = { writeAuditLog };

