
// In-process rate limiter for public student registration submission.
// Allows 5 submissions per IP in each 15-minute window.

const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_KEYS = 10000;

function registrationRateLimit(req, res, next) {
  const key = String(req.ip || req.socket?.remoteAddress || "unknown");
  const now = Date.now();

  for (const [trackedKey, record] of attempts) {
    if (now - record.startedAt >= WINDOW_MS) {
      attempts.delete(trackedKey);
    }
  }

  let record = attempts.get(key);

  if (!record || now - record.startedAt >= WINDOW_MS) {
    record = { startedAt: now, count: 0 };
    attempts.set(key, record);
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - record.startedAt)) / 1000)
    );

    res.set("Retry-After", String(retryAfter));

    return res.status(429).json({
      error: "Too many registration attempts. Please try again later.",
      retryAfterSeconds: retryAfter,
    });
  }

  record.count += 1;

  if (attempts.size > MAX_TRACKED_KEYS) {
    const oldestKey = attempts.keys().next().value;
    if (oldestKey !== undefined) attempts.delete(oldestKey);
  }

  return next();
}

module.exports = { registrationRateLimit };
