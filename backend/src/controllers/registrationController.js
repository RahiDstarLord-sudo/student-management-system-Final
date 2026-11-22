
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { writeAuditLog } = require("../utils/auditLogger");

const ACTIVATION_DAYS = 7;
const PASSWORD_ROUNDS = 12;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashActivationCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function safeCompareHash(value, storedHash) {
  const valueBuffer = Buffer.from(hashActivationCode(value), "hex");
  const storedBuffer = Buffer.from(String(storedHash || ""), "hex");

  return (
    valueBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(valueBuffer, storedBuffer)
  );
}

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

// Generate a student ID and activation code.
function createStudentActivation(req, res) {
  const studentId = `GC-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const activationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const codeHash = hashActivationCode(activationCode);

  const expiresAt = new Date(
    Date.now() + ACTIVATION_DAYS * 24 * 60 * 60 * 1000
  );

  db.query(
    `INSERT INTO students
      (student_id, name, email, course, department_id, year, status, registration_status)
     VALUES (?, NULL, NULL, NULL, NULL, '1st Year', 'Pending', 'pending')`,
    [studentId],
    (studentErr) => {
      if (studentErr) {
        console.error("Student activation creation error:", studentErr);
        return res.status(500).json({
          error: "Could not create student activation",
        });
      }

      db.query(
        `INSERT INTO student_activation_codes
          (student_id, code_hash, expires_at)
         VALUES (?, ?, ?)`,
        [studentId, codeHash, expiresAt],
        (codeErr) => {
          if (codeErr) {
            console.error("Activation code creation error:", codeErr);

            return db.query(
              "DELETE FROM students WHERE student_id = ?",
              [studentId],
              () => {
                return res.status(500).json({
                  error: "Could not create activation code",
                });
              }
            );
          }

          writeAuditLog(req, {
            action: "STUDENT_ACTIVATION_CREATED",
            entityType: "student",
            entityId: studentId,
            newValues: {
              studentId,
              expiresAt,
            },
          });

          return res.status(201).json({
            studentId,
            activationCode,
            expiresAt,
          });
        }
      );
    }
  );
}

// Verify student ID and activation code.
function verifyStudentActivation(req, res) {
  const studentId = String(req.body?.studentId || "").trim();
  const activationCode = String(
    req.body?.activationCode || ""
  ).trim().toUpperCase();

  if (!studentId || !activationCode) {
    return res.status(400).json({
      error: "Student ID and activation code are required",
    });
  }

  db.query(
    `SELECT
       a.code_hash,
       a.expires_at,
       a.used_at,
       s.registration_status
     FROM student_activation_codes a
     INNER JOIN students s ON s.student_id = a.student_id
     WHERE a.student_id = ?
     LIMIT 1`,
    [studentId],
    (err, rows) => {
      if (err) {
        console.error("Activation verification error:", err);
        return res.status(500).json({
          error: "Could not verify activation",
        });
      }

      const activation = rows[0];

      if (
        !activation ||
        activation.used_at ||
        new Date(activation.expires_at).getTime() <= Date.now() ||
        activation.registration_status !== "pending" ||
        !safeCompareHash(activationCode, activation.code_hash)
      ) {
        return res.status(400).json({
          error: "Invalid or expired activation credentials",
        });
      }

      return res.json({
        success: true,
        message: "Activation verified successfully",
        studentId,
      });
    }
  );
}

// Submit student registration.
async function submitStudentRegistration(req, res) {
  const body = req.body || {};

  const studentId = String(body.studentId || "").trim();
  const activationCode = String(
    body.activationCode || ""
  ).trim().toUpperCase();

  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
 

  const course = String(body.course || "").trim() || null;
  const year = String(body.year || "1st Year").trim();
  const departmentId =
    body.department_id || body.departmentId || null;

  const nid = String(body.nid || "").trim() || null;
  const phone = String(body.phone || "").trim() || null;

  if (!studentId || !activationCode || !name || !email) {
  return res.status(400).json({
    error: "Student ID, activation code, name and email are required",
  });
}

  if (name.length > 100 || email.length > 100) {
    return res.status(400).json({
      error: "Name or email is too long",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "Please provide a valid email address",
    });
  }

  

  if (nid && nid.length > 30) {
    return res.status(400).json({
      error: "NID must not exceed 30 characters",
    });
  }

  if (phone && phone.length > 30) {
    return res.status(400).json({
      error: "Phone number must not exceed 30 characters",
    });
  }

  const allowedYears = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  if (!allowedYears.includes(year)) {
    return res.status(400).json({
      error: "Invalid academic year",
    });
  }

  let passwordHash;

try {
  const placeholderPassword = crypto.randomBytes(32).toString("hex");
  passwordHash = await bcrypt.hash(
    placeholderPassword,
    PASSWORD_ROUNDS
  );
} catch (hashErr) {
  console.error("Registration placeholder hashing error:", hashErr);
  return res.status(500).json({
    error: "Could not process registration",
  });
}

  db.query(
    `SELECT
       a.code_hash,
       a.expires_at,
       a.used_at,
       s.registration_status
     FROM student_activation_codes a
     INNER JOIN students s ON s.student_id = a.student_id
     WHERE a.student_id = ?
     LIMIT 1`,
    [studentId],
    (activationErr, activationRows) => {
      if (activationErr) {
        console.error("Registration activation lookup error:", activationErr);
        return res.status(500).json({
          error: "Could not verify activation",
        });
      }

      const activation = activationRows[0];

      if (
        !activation ||
        activation.used_at ||
        new Date(activation.expires_at).getTime() <= Date.now() ||
        activation.registration_status !== "pending" ||
        !safeCompareHash(activationCode, activation.code_hash)
      ) {
        return res.status(400).json({
          error: "Invalid, expired or already used activation credentials",
        });
      }

      db.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
        (emailErr, emailRows) => {
          if (emailErr) {
            console.error("Registration email lookup error:", emailErr);
            return res.status(500).json({
              error: "Could not verify email",
            });
          }

          if (emailRows.length > 0) {
            return res.status(409).json({
              error: "An account with this email already exists",
            });
          }

          db.query(
            `UPDATE students
             SET name = ?, email = ?, course = ?, department_id = ?,
                 year = ?, status = 'Pending'
             WHERE student_id = ?
               AND registration_status = 'pending'`,
            [name, email, course, departmentId, year, studentId],
            (studentErr, studentResult) => {
              if (studentErr) {
                console.error("Student registration update error:", studentErr);
                return res.status(500).json({
                  error: "Could not save student registration",
                });
              }

              if (studentResult.affectedRows !== 1) {
                return res.status(409).json({
                  error: "Student registration is no longer available",
                });
              }

              db.query(
                `INSERT INTO users
                  (email, password_hash, role, student_id, status, must_change_password)
                 VALUES (?, ?, 'student', ?, 'suspended', 1)`,
                [email, passwordHash, studentId],
                (userErr) => {
                  if (userErr) {
                    console.error("Student user creation error:", userErr);

                    return res.status(500).json({
                      error: "Could not create student account",
                    });
                  }

                  db.query(
                    `INSERT INTO student_profiles
                      (student_id, nid, phone)
                     VALUES (?, ?, ?)`,
                    [studentId, nid, phone],
                    (profileErr) => {
                      if (profileErr) {
                        console.error("Student profile creation error:", profileErr);
                        return res.status(500).json({
                          error: "Registration saved but profile creation failed. Contact administration.",
                        });
                      }

                      db.query(
                        `UPDATE student_activation_codes
                         SET used_at = NOW()
                         WHERE student_id = ? AND used_at IS NULL`,
                        [studentId],
                        (codeErr, codeResult) => {
                          if (codeErr || codeResult.affectedRows !== 1) {
                            console.error(
                              "Activation consumption error:",
                              codeErr || "Activation was already used"
                            );

                            return res.status(500).json({
                              error: "Registration saved but activation could not be finalized. Contact administration.",
                            });
                          }

                          return res.status(201).json({
                            success: true,
                            message: "Registration submitted successfully. Await admin approval.",
                            studentId,
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

// Get pending student registrations.
function getPendingRegistrations(req, res) {
  const sql = `
    SELECT
      s.student_id,
      s.name,
      s.email,
      d.department_name,
      sp.nid,
      sp.phone
    FROM students s
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN student_profiles sp ON sp.student_id = s.student_id
    WHERE s.registration_status = 'pending'
      AND s.name IS NOT NULL
      AND s.email IS NOT NULL
    ORDER BY s.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Pending registrations error:", err);
      return res.status(500).json({
        error: "Could not load pending registrations",
      });
    }

    return res.json(rows);
  });
}

// Approve a pending student registration.
async function approveStudentRegistration(req, res) {
  const studentId = String(req.params.studentId || "").trim();

  if (!studentId) {
    return res.status(400).json({
      error: "Student ID is required",
    });
  }

  const temporaryPassword = generateTemporaryPassword();

  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [students] = await connection.query(
      `SELECT student_id, name, email, registration_status
       FROM students
       WHERE student_id = ?
       LIMIT 1
       FOR UPDATE`,
      [studentId]
    );

    const student = students[0];

    if (!student) {
      await connection.rollback();
      return res.status(404).json({
        error: "Student registration not found",
      });
    }

    if (
      student.registration_status !== "pending" ||
      !student.name ||
      !student.email
    ) {
      await connection.rollback();
      return res.status(409).json({
        error: "Student registration is not eligible for approval",
      });
    }

    const [users] = await connection.query(
      `SELECT id
       FROM users
       WHERE student_id = ?
         AND email = ?
         AND role = 'student'
       LIMIT 1
       FOR UPDATE`,
      [studentId, student.email]
    );

    if (!users[0]) {
      await connection.rollback();
      return res.status(409).json({
        error: "Student login account is missing. Registration cannot be approved.",
      });
    }

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      PASSWORD_ROUNDS
    );

    const [studentUpdate] = await connection.query(
      `UPDATE students
       SET registration_status = 'approved',
           status = 'Active',
           approved_at = NOW(),
           approved_by = ?
       WHERE student_id = ?
         AND registration_status = 'pending'`,
      [req.user.id, studentId]
    );

    if (studentUpdate.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({
        error: "Student registration has already been processed",
      });
    }

    const [userUpdate] = await connection.query(
      `UPDATE users
       SET status = 'active',
           password_hash = ?,
           must_change_password = 1
       WHERE student_id = ?
         AND email = ?
         AND role = 'student'`,
      [passwordHash, studentId, student.email]
    );

    if (userUpdate.affectedRows !== 1) {
      throw new Error("Student account activation failed");
    }

    await connection.commit();

    writeAuditLog(req, {
      action: "STUDENT_REGISTRATION_APPROVED",
      entityType: "student",
      entityId: studentId,
      oldValues: {
        registrationStatus: "pending",
        status: "Pending",
      },
      newValues: {
        registrationStatus: "approved",
        status: "Active",
        email: student.email,
      },
    });

    return res.json({
      success: true,
      studentId,
      loginId: studentId,
      temporaryPassword,
      message: "Student registration approved successfully",
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Student approval error:", err);

    return res.status(500).json({
      error: "Could not approve student registration",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Reject a pending student registration.
function rejectStudentRegistration(req, res) {
  const studentId = String(req.params.studentId || "").trim();

  if (!studentId) {
    return res.status(400).json({
      error: "Student ID is required",
    });
  }

  db.query(
    `SELECT student_id, name, email, registration_status, status
     FROM students
     WHERE student_id = ?
     LIMIT 1`,
    [studentId],
    (selectErr, rows) => {
      if (selectErr) {
        console.error("Student rejection lookup error:", selectErr);
        return res.status(500).json({
          error: "Could not load student registration",
        });
      }

      const student = rows[0];

      if (!student) {
        return res.status(404).json({
          error: "Student registration not found",
        });
      }

      if (student.registration_status !== "pending") {
        return res.status(409).json({
          error: "Only pending registrations can be rejected",
        });
      }

      db.query(
        `UPDATE students
         SET registration_status = 'rejected',
             status = 'Inactive'
         WHERE student_id = ?
           AND registration_status = 'pending'`,
        [studentId],
        (updateErr, updateResult) => {
          if (updateErr) {
            console.error("Student rejection update error:", updateErr);
            return res.status(500).json({
              error: "Could not reject student registration",
            });
          }

          if (updateResult.affectedRows !== 1) {
            return res.status(409).json({
              error: "Student registration has already been processed",
            });
          }

          db.query(
            `UPDATE users
             SET status = 'suspended'
             WHERE student_id = ?
               AND role = 'student'`,
            [studentId],
            (userErr) => {
              if (userErr) {
                console.error("Student account suspension error:", userErr);
                return res.status(500).json({
                  error: "Registration rejected but account suspension failed",
                });
              }

              writeAuditLog(req, {
                action: "STUDENT_REGISTRATION_REJECTED",
                entityType: "student",
                entityId: studentId,
                oldValues: {
                  registrationStatus: "pending",
                  status: student.status,
                },
                newValues: {
                  registrationStatus: "rejected",
                  status: "Inactive",
                },
              });

              return res.json({
                success: true,
                message: "Student registration rejected successfully",
              });
            }
          );
        }
      );
    }
  );
}

module.exports = {
  createStudentActivation,
  verifyStudentActivation,
  submitStudentRegistration,
  getPendingRegistrations,
  approveStudentRegistration,
  rejectStudentRegistration,
};
