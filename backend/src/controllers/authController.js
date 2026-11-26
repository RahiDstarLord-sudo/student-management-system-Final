
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_HOURS = 8;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}

const MAX_FAILURES = 10;
const BLOCK_WINDOW_MINUTES = 15;

function checkLoginThrottle(identifier, ipAddress, callback) {
  db.query(
    `SELECT COUNT(*) AS failure_count
     FROM login_logs
     WHERE email = ?
       AND ip_address = ?
       AND success = 0
       AND failure_reason = 'Invalid email or password'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [identifier, ipAddress, BLOCK_WINDOW_MINUTES],
    (err, rows) => {
      if (err) {
        console.error("Login throttle check error:", err);
        return callback(err);
      }

      callback(
        null,
        Number(rows[0]?.failure_count || 0) >= MAX_FAILURES
      );
    }
  );
}

function writeLoginLog(
  req,
  { userId = null, email, success, failureReason = null }
) {
  const ipAddress = req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.get("user-agent") || null;

  db.query(
    `INSERT INTO login_logs
      (user_id, email, success, ip_address, user_agent, failure_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      String(email).slice(0, 100),
      success ? 1 : 0,
      ipAddress,
      userAgent,
      failureReason,
    ],
    (logErr) => {
      if (logErr) {
        console.error("Failed to write login_log:", logErr.message);
      }
    }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function login(req, res) {
  const { identifier, email, password } = req.body || {};

  // Backward compatibility: existing email-based clients still work.
  const loginIdentifier =
    typeof identifier === "string" ? identifier : email;

  if (
    !loginIdentifier ||
    typeof loginIdentifier !== "string" ||
    !password ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Email, Student ID or Teacher ID and password are required",
    });
  }

  const normalizedIdentifier = loginIdentifier.trim().toLowerCase();
  const normalizedCode = loginIdentifier.trim().toUpperCase();
  const ipAddress = req.ip || req.socket?.remoteAddress || null;

  if (
    !normalizedIdentifier ||
    normalizedIdentifier.length > 100 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error: "Invalid login credentials",
    });
  }

  return checkLoginThrottle(
    normalizedIdentifier,
    ipAddress,
    (throttleErr, blocked) => {
      if (throttleErr) {
        return res.status(500).json({
          error: "Could not verify login security",
        });
      }

      if (blocked) {
        writeLoginLog(req, {
          email: normalizedIdentifier,
          success: false,
          failureReason: "Too many failed attempts",
        });

        return res.status(429).json({
          error: "Too many failed attempts. Try again in 15 minutes.",
        });
      }

      const sql = `
        SELECT
          u.*,
          t.id AS teacher_record_id,
          t.teacher_id AS teacher_code,
          t.name AS teacher_name,
          t.email AS teacher_email,
          t.status AS teacher_status,
          t.registration_status AS teacher_registration_status
        FROM users u
        LEFT JOIN teachers t
          ON t.user_id = u.id
         AND LOWER(t.email) = LOWER(u.email)
        WHERE
          LOWER(u.email) = ?
          OR (
            u.role = 'student'
            AND UPPER(TRIM(u.student_id)) = ?
          )
          OR (
            u.role = 'teacher'
            AND UPPER(TRIM(t.teacher_id)) = ?
          )
        ORDER BY
          CASE
            WHEN LOWER(u.email) = ? THEN 0
            WHEN u.role = 'student'
              AND UPPER(TRIM(u.student_id)) = ? THEN 1
            ELSE 2
          END
        LIMIT 1
      `;

      db.query(
        sql,
        [
          normalizedIdentifier,
          normalizedCode,
          normalizedCode,
          normalizedIdentifier,
          normalizedCode,
        ],
        async (err, rows) => {
          if (err) {
            console.error("Login database error:", err);
            return res.status(500).json({
              error: "Database error",
            });
          }

          const user = rows[0];
          let passwordMatches = false;

          if (user) {
            try {
              passwordMatches = await bcrypt.compare(
                password,
                user.password_hash
              );
            } catch (compareErr) {
              console.error("Password verification error:", compareErr);
              return res.status(500).json({
                error: "Could not verify credentials",
              });
            }
          }

          if (!user || !passwordMatches) {
            writeLoginLog(req, {
              userId: user ? user.id : null,
              email: normalizedIdentifier,
              success: false,
              failureReason: "Invalid email or password",
            });

            return res.status(401).json({
              error: "Invalid email/ID or password",
            });
          }

          if (String(user.status).toLowerCase() !== "active") {
            writeLoginLog(req, {
              userId: user.id,
              email: normalizedIdentifier,
              success: false,
              failureReason: "Account suspended",
            });

            return res.status(403).json({
              error: "Your account is suspended. Contact administration.",
            });
          }

          const completeLogin = (teacher = null) => {
            const expiresAt = new Date(
              Date.now() + SESSION_HOURS * 60 * 60 * 1000
            );

            const token = jwt.sign(
              { id: user.id },
              JWT_SECRET,
              { expiresIn: `${SESSION_HOURS}h` }
            );

            db.query(
              `INSERT INTO user_sessions
                (user_id, session_token_hash, expires_at, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?)`,
              [
                user.id,
                hashToken(token),
                expiresAt,
                req.ip || req.socket?.remoteAddress || null,
                req.get("user-agent") || null,
              ],
              (sessionErr) => {
                if (sessionErr) {
                  console.error("Session creation error:", sessionErr);
                  return res.status(500).json({
                    error: "Could not create a secure session. Please try again.",
                  });
                }

                writeLoginLog(req, {
                  userId: user.id,
                  email: normalizedIdentifier,
                  success: true,
                  failureReason: null,
                });

                return res.json({
                  token,
                  user: {
                    email: user.email,
                    role: user.role,
                    studentId: user.student_id || null,
                    teacherId: teacher ? teacher.id : null,
                    teacherCode: teacher ? teacher.teacher_id : null,
                    name: teacher ? teacher.name : null,
                    mustChangePassword:
                      Boolean(Number(user.must_change_password)),
                  },
                });
              }
            );
          };

          // Student identity and registration validation.
          if (user.role === "student") {
            if (!user.student_id || !String(user.student_id).trim()) {
              writeLoginLog(req, {
                userId: user.id,
                email: normalizedIdentifier,
                success: false,
                failureReason: "Student account has no linked student ID",
              });

              return res.status(403).json({
                error: "Student account is not properly linked. Contact administration.",
              });
            }

            db.query(
              `SELECT student_id, email, registration_status, status
               FROM students
               WHERE student_id = ?
                 AND LOWER(email) = LOWER(?)
               LIMIT 1`,
              [user.student_id, user.email],
              (statusErr, statusRows) => {
                if (statusErr) {
                  console.error("Student identity check error:", statusErr);
                  return res.status(500).json({
                    error: "Could not verify student account",
                  });
                }

                const student = statusRows[0];

                if (
                  !student ||
                  student.student_id !== user.student_id ||
                  student.registration_status !== "approved" ||
                  String(student.status).toLowerCase() !== "active"
                ) {
                  writeLoginLog(req, {
                    userId: user.id,
                    email: normalizedIdentifier,
                    success: false,
                    failureReason:
                      "Student identity mismatch or inactive registration",
                  });

                  return res.status(403).json({
                    error: "Student account is not properly approved or linked. Contact administration.",
                  });
                }

                return completeLogin();
              }
            );

            return;
          }

          // Teacher identity and active status validation.
          if (user.role === "teacher") {
            const teacher = user.teacher_record_id
              ? {
                  id: user.teacher_record_id,
                  teacher_id: user.teacher_code,
                  name: user.teacher_name,
                  email: user.teacher_email,
                  status: user.teacher_status,
                  registration_status: user.teacher_registration_status,
                }
              : null;

            if (
              !teacher ||
              String(teacher.status).toLowerCase() !== "active" ||
              teacher.registration_status !== "approved" ||
              !teacher.teacher_id
            ) {
              writeLoginLog(req, {
                userId: user.id,
                email: normalizedIdentifier,
                success: false,
                failureReason:
                  "Teacher identity mismatch, unapproved registration or inactive profile",
              });

              return res.status(403).json({
                error: "Teacher account is inactive or not properly linked. Contact administration.",
              });
            }

            return completeLogin(teacher);
          }

          // Existing Admin login remains email + password.
          return completeLogin();
        }
      );
    }
  );
}

function logout(req, res) {
  if (!req.sessionId || !req.user) {
    return res.status(401).json({
      error: "Please log in",
    });
  }

  db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    [req.sessionId, req.user.id],
    (err) => {
      if (err) {
        console.error("Logout session revocation error:", err);
        return res.status(500).json({
          error: "Could not end this session",
        });
      }

      return res.json({
        success: true,
        message: "Logged out successfully",
      });
    }
  );
}

module.exports = { login, logout };
