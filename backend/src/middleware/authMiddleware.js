
require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Resolve current identity and account state from database.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ error: "Please log in" });
  }

  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({
      error: "Session expired. Please log in again",
    });
  }

  if (!payload || !Number.isInteger(Number(payload.id))) {
    return res.status(401).json({
      error: "Invalid session. Please log in again",
    });
  }

  const sql = `
    SELECT
      u.id,
      u.email,
      u.role,
      u.student_id,
      u.status AS user_status,
      u.must_change_password,
      us.id AS session_id,
      s.registration_status,
      s.status AS student_status,
      t.id AS teacher_record_id,
      t.teacher_id AS teacher_code,
      t.name AS teacher_name,
      t.email AS teacher_email,
      t.department AS teacher_department,
      t.designation AS teacher_designation,
      t.status AS teacher_status,
      t.registration_status AS teacher_registration_status
    FROM users u
    INNER JOIN user_sessions us
      ON us.user_id = u.id
     AND us.session_token_hash = ?
     AND us.revoked_at IS NULL
     AND us.expires_at > NOW()
    LEFT JOIN students s
      ON s.student_id = u.student_id
     AND LOWER(s.email) = LOWER(u.email)
    LEFT JOIN teachers t
      ON t.user_id = u.id
     AND LOWER(t.email) = LOWER(u.email)
    WHERE u.id = ?
    LIMIT 1
  `;

  db.query(sql, [tokenHash(token), Number(payload.id)], (err, rows) => {
    if (err) {
      console.error("Authentication identity/session check error:", err);
      return res.status(500).json({
        error: "Could not verify your session",
      });
    }

    const user = rows && rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Session is no longer valid. Please log in again",
      });
    }

    if (String(user.user_status).toLowerCase() !== "active") {
      return res.status(403).json({
        error: "Your account is suspended. Contact administration.",
      });
    }

    if (user.role === "student") {
      if (
        !user.student_id ||
        user.registration_status !== "approved" ||
        String(user.student_status || "").toLowerCase() !== "active"
      ) {
        return res.status(403).json({
          error: "Your student registration is not active or approved",
        });
      }
    }

    if (user.role === "teacher") {
      if (
        !user.teacher_record_id ||
        !user.teacher_code ||
        user.teacher_registration_status !== "approved" ||
        String(user.teacher_status || "").toLowerCase() !== "active"
      ) {
        return res.status(403).json({
          error: "Active teacher record not found or identity mismatch",
        });
      }
    }

    req.sessionId = user.session_id;
    req.sessionToken = token;

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      studentId: user.student_id || null,
      teacherId: user.teacher_record_id || null,
      teacherCode: user.teacher_code || null,
      name: user.teacher_name || null,
      teacherEmail: user.teacher_email || null,
      teacherDepartment: user.teacher_department || null,
      teacherDesignation: user.teacher_designation || null,
      mustChangePassword: Boolean(Number(user.must_change_password)),
    };

    // Students and teachers must change their temporary password first.
    // Only password change and logout are allowed until then.
    const passwordChangeRequired =
      ["student", "teacher"].includes(user.role) &&
      Number(user.must_change_password) === 1;

    if (passwordChangeRequired) {
      const allowedPasswordChange =
        req.method === "PUT" && req.path === "/change-password";

      const allowedLogout =
        req.method === "POST" && req.path === "/logout";

      if (!allowedPasswordChange && !allowedLogout) {
        return res.status(403).json({
          error: "You must change your temporary password before continuing.",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
      }
    }

    return next();
  });
}

// Operational staff access: Admin only.
function requireStaff(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

function requireTeacher(req, res, next) {
  if (
    !req.user ||
    req.user.role !== "teacher" ||
    !req.user.teacherId
  ) {
    return res.status(403).json({
      error: "Active teacher access required",
    });
  }

  req.teacher = {
    id: req.user.teacherId,
    teacher_id: req.user.teacherCode,
    name: req.user.name,
    email: req.user.teacherEmail,
    department: req.user.teacherDepartment,
    designation: req.user.teacherDesignation,
  };

  return next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    return next();
  };
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: "Please log in" });
    }

    const sql = `
      SELECT 1
      FROM roles r
      INNER JOIN role_permissions rp ON rp.role_id = r.id
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE r.role_key = ?
        AND p.permission_key = ?
      LIMIT 1
    `;

    db.query(sql, [req.user.role, permissionKey], (err, rows) => {
      if (err) {
        console.error("Permission check error:", err);
        return res.status(500).json({
          error: "Could not verify permissions",
        });
      }

      if (!rows || rows.length === 0) {
        return res.status(403).json({
          error: "Missing required permission",
        });
      }

      return next();
    });
  };
}

module.exports = {
  requireAuth,
  requireStaff,
  requireTeacher,
  requireRole,
  requirePermission,
};
