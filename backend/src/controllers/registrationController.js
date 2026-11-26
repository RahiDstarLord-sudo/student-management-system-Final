const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { writeAuditLog } = require("../utils/auditLogger");

const PASSWORD_ROUNDS = 12;
const ID_VALID_DAYS = 30;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashCode(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeCodeMatch(value, storedHash) {
  const a = Buffer.from(hashCode(value), "hex");
  const b = Buffer.from(String(storedHash || ""), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createId(type) {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return type === "student" ? `GC-${year}-${random}` : `GCT-${year}-${random}`;
}

function normalizeType(value) {
  const type = String(value || "").trim().toLowerCase();
  return ["student", "teacher"].includes(type) ? type : null;
}

function getRegistrationOptions(req, res) {
  const queries = [
    `SELECT id, department_code, department_name FROM departments WHERE status = 'Active' ORDER BY department_name`,
    `SELECT c.id, c.course_code, c.course_name, c.department_id, c.semester_id, c.credits FROM courses c INNER JOIN departments d ON d.id = c.department_id AND d.status = 'Active' INNER JOIN semesters s ON s.id = c.semester_id AND s.department_id = c.department_id AND s.status = 'Active' ORDER BY c.course_code`,
    `SELECT id, year_name, start_date, end_date FROM academic_years WHERE status = 'Active' ORDER BY start_date DESC`,
    `SELECT id, department_id, semester_number, semester_name FROM semesters WHERE status = 'Active' ORDER BY department_id, semester_number`,
  ];

  Promise.all(queries.map((sql) => db.promise().query(sql)))
    .then((results) => res.json({
      departments: results[0][0],
      courses: results[1][0],
      academicYears: results[2][0],
      semesters: results[3][0],
    }))
    .catch((err) => {
      console.error("Registration options error:", err);
      res.status(500).json({ error: "Could not load registration options" });
    });
}

async function generateRegistrationId(req, res) {
  const type = normalizeType(req.params.type);
  if (!type) return res.status(400).json({ error: "Registration type must be student or teacher" });

  const id = createId(type);
  const activationCode = crypto.randomBytes(16).toString("hex").toUpperCase();
  const codeHash = hashCode(activationCode);
  const expiresAt = new Date(Date.now() + ID_VALID_DAYS * 24 * 60 * 60 * 1000);
  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    if (type === "student") {
      await connection.query(
        `INSERT INTO students
          (student_id, name, email, course, department_id, year, status, registration_status)
         VALUES (?, NULL, NULL, NULL, NULL, '1st Year', 'Pending', 'pending')`,
        [id]
      );
      await connection.query(
        `INSERT INTO student_activation_codes (student_id, code_hash, expires_at, status, created_by)
         VALUES (?, ?, ?, 'issued', ?)`,
        [id, codeHash, expiresAt, req.user.id]
      );
    } else {
      const [existingTeacher] = await connection.query(
        "SELECT id FROM teachers WHERE teacher_id = ? LIMIT 1 FOR UPDATE", [id]
      );
      if (existingTeacher.length) {
        await connection.rollback();
        return res.status(409).json({ error: "A teacher record already uses this ID. Generate another ID." });
      }
      await connection.query(
        `INSERT INTO teacher_activation_codes
          (teacher_id, code_hash, expires_at, status, created_by)
         VALUES (?, ?, ?, 'issued', ?)`,
        [id, codeHash, expiresAt, req.user.id]
      );
    }

    await connection.commit();
    writeAuditLog(req, {
      action: `${type.toUpperCase()}_REGISTRATION_ID_GENERATED`,
      entityType: `${type}_registration_id`,
      entityId: id,
      newValues: { id, expiresAt },
    });
    return res.status(201).json({ type, id, activationCode, expiresAt, status: "issued" });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "A duplicate registration ID was detected. Please generate another ID." });
    }
    console.error("Registration ID generation error:", err);
    return res.status(500).json({ error: "Could not generate registration ID" });
  } finally {
    if (connection) connection.release();
  }
}

async function verifyRegistration(req, res) {
  const type = normalizeType(req.body?.type);
  const id = String(req.body?.id || req.body?.studentId || req.body?.teacherId || "").trim().toUpperCase();
  const code = String(req.body?.activationCode || "").trim().toUpperCase();
  if (!type || !id || !code) return res.status(400).json({ error: "Registration type, ID and activation code are required" });

  try {
    let rows;
    if (type === "student") {
      [rows] = await db.promise().query(
        `SELECT a.code_hash, a.expires_at, a.used_at, a.revoked_at, a.status,
                s.registration_status, s.name
         FROM student_activation_codes a
         INNER JOIN students s ON s.student_id = a.student_id
         WHERE a.student_id = ? LIMIT 1`, [id]
      );
    } else {
      [rows] = await db.promise().query(
        `SELECT code_hash, expires_at, used_at, status
         FROM teacher_activation_codes WHERE teacher_id = ? LIMIT 1`, [id]
      );
    }

    const record = rows[0];
    const validStatus = type === "student"
      ? record && record.status === "issued" && record.registration_status === "pending" && !record.name && !record.revoked_at
      : record && record.status === "issued";

    if (!record || !validStatus || record.used_at || new Date(record.expires_at).getTime() <= Date.now() || !safeCodeMatch(code, record.code_hash)) {
      return res.status(400).json({ error: "Invalid, expired, already used or ineligible registration ID" });
    }
    return res.json({ success: true, type, id, message: "Registration ID verified" });
  } catch (err) {
    console.error("Registration verification error:", err);
    return res.status(500).json({ error: "Could not verify registration ID" });
  }
}

async function submitRegistration(req, res) {
  const type = normalizeType(req.body?.type);
  const id = String(req.body?.id || req.body?.studentId || req.body?.teacherId || "").trim().toUpperCase();
  const activationCode = String(req.body?.activationCode || "").trim().toUpperCase();
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const phone = String(req.body?.phone || "").trim();
  const nid = String(req.body?.nid || "").trim();
  const departmentId = Number(req.body?.departmentId || 0);
  const courseId = Number(req.body?.courseId || 0);
  const designation = String(req.body?.designation || "").trim();

  if (!type || !id || !activationCode || !name || !email || !password) {
    return res.status(400).json({ error: "All required registration fields must be completed" });
  }
  if (name.length > 100 || email.length > 100 || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Name or email is too long, or password does not meet the 8-character minimum" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (phone.length > 30 || nid.length > 30) return res.status(400).json({ error: "Phone or NID value is too long" });
  if (!Number.isInteger(departmentId) || departmentId <= 0) return res.status(400).json({ error: "Select a valid department from the available options" });
  if (type === "student" && (!Number.isInteger(courseId) || courseId <= 0)) return res.status(400).json({ error: "Select a valid course from the available options" });
  if (type === "teacher" && (!designation || designation.length > 100)) return res.status(400).json({ error: "Teacher designation is required" });

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [departmentRows] = await connection.query(
      "SELECT id, department_name FROM departments WHERE id = ? AND status = 'Active' LIMIT 1 FOR UPDATE",
      [departmentId]
    );
    if (!departmentRows.length) {
      await connection.rollback();
      return res.status(400).json({ error: "Selected department is no longer available. Choose an existing active department." });
    }

    let activation;
    if (type === "student") {
      const [rows] = await connection.query(
        `SELECT a.code_hash, a.expires_at, a.used_at, a.revoked_at, a.status,
                s.registration_status, s.name
         FROM student_activation_codes a
         INNER JOIN students s ON s.student_id = a.student_id
         WHERE a.student_id = ? FOR UPDATE`, [id]
      );
      activation = rows[0];
      if (!activation || activation.status !== "issued" || activation.registration_status !== "pending" || activation.name || activation.used_at || activation.revoked_at || new Date(activation.expires_at).getTime() <= Date.now() || !safeCodeMatch(activationCode, activation.code_hash)) {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid, expired, already used or ineligible Student ID" });
      }
    } else {
      const [rows] = await connection.query(
        "SELECT code_hash, expires_at, used_at, status FROM teacher_activation_codes WHERE teacher_id = ? FOR UPDATE",
        [id]
      );
      activation = rows[0];
      if (!activation || activation.status !== "issued" || activation.used_at || new Date(activation.expires_at).getTime() <= Date.now() || !safeCodeMatch(activationCode, activation.code_hash)) {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid, expired, already used or ineligible Teacher ID" });
      }
    }

    const [existingUsers] = await connection.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE", [email]);
    if (existingUsers.length) {
      await connection.rollback();
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    if (type === "student") {
      const [existingStudentEmail] = await connection.query(
        "SELECT student_id FROM students WHERE LOWER(email) = LOWER(?) AND student_id <> ? LIMIT 1 FOR UPDATE",
        [email, id]
      );
      if (existingStudentEmail.length) {
        await connection.rollback();
        return res.status(409).json({ error: "This email address is already linked to another student record" });
      }
    }

    let course = null;
    if (type === "student") {
      const [courseRows] = await connection.query(
        `SELECT c.id, c.course_name, c.department_id, c.semester_id
         FROM courses c
         INNER JOIN semesters s
           ON s.id = c.semester_id
          AND s.department_id = c.department_id
          AND s.status = 'Active'
         WHERE c.id = ?
         LIMIT 1
         FOR UPDATE`,
        [courseId]
      );
      course = courseRows[0];

      if (!course || Number(course.department_id) !== departmentId || !course.semester_id) {
        await connection.rollback();
        return res.status(400).json({
          error: "Selected course is unavailable or is not assigned to an active semester in the selected department"
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    if (type === "student") {
      const [studentRecordUpdate] = await connection.query(
        `UPDATE students SET name = ?, email = ?, course = ?, department_id = ?, status = 'Pending'
         WHERE student_id = ? AND registration_status = 'pending' AND name IS NULL AND email IS NULL`,
        [name, email, course.course_name, departmentId, id]
      );

      if (studentRecordUpdate.affectedRows !== 1) {
        throw new Error("Student registration record could not be updated");
      }
      await connection.query(
        "INSERT INTO users (email, password_hash, role, student_id, status) VALUES (?, ?, 'student', ?, 'suspended')",
        [email, passwordHash, id]
      );
      await connection.query(
        `INSERT INTO student_profiles (student_id, nid, phone)
         VALUES (?, ?, ?)`,
        [id, nid || null, phone || null]
      );
      const [consume] = await connection.query(
        "UPDATE student_activation_codes SET used_at = NOW(), status = 'pending' WHERE student_id = ? AND used_at IS NULL AND revoked_at IS NULL AND status = 'issued'",
        [id]
      );
      if (consume.affectedRows !== 1) throw new Error("Student registration ID could not be consumed");
    } else {
      const [teacherInsert] = await connection.query(
        `INSERT INTO teachers
          (teacher_id, user_id, name, email, phone, department, department_id, designation, status, registration_status)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'Inactive', 'pending')`,
        [id, name, email, phone || null, departmentRows[0].department_name, departmentId, designation]
      );
      const [userInsert] = await connection.query(
        "INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, 'teacher', 'suspended')",
        [email, passwordHash]
      );
      const [teacherLinkUpdate] = await connection.query(
        "UPDATE teachers SET user_id = ? WHERE id = ? AND user_id IS NULL AND registration_status = 'pending'",
        [userInsert.insertId, teacherInsert.insertId]
      );

      if (teacherLinkUpdate.affectedRows !== 1) {
        throw new Error("Teacher login account could not be linked");
      }
      const [consume] = await connection.query(
        "UPDATE teacher_activation_codes SET used_at = NOW(), status = 'pending' WHERE teacher_id = ? AND used_at IS NULL AND status = 'issued'",
        [id]
      );
      if (consume.affectedRows !== 1) throw new Error("Teacher registration ID could not be consumed");
    }

    await connection.commit();
    writeAuditLog(req, {
      action: `${type.toUpperCase()}_REGISTRATION_SUBMITTED`,
      entityType: type,
      entityId: id,
      newValues: { id, email, name, departmentId },
    });
    return res.status(201).json({ success: true, type, id, message: "Registration submitted successfully. Your account will remain unavailable until admin approval." });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This registration ID, email address or NID is already in use" });
    console.error("Registration submission error:", err);
    return res.status(500).json({ error: "Could not submit registration" });
  } finally {
    if (connection) connection.release();
  }
}

async function getPendingRegistrations(req, res) {
  try {
    const [[students], [teachers]] = await Promise.all([
      db.promise().query(
        `SELECT 'student' AS type, s.student_id AS registration_id, s.name, s.email,
                s.department_id, d.department_name, s.course, sp.phone, sp.nid,
                s.year, s.created_at, 'pending' AS registration_status
         FROM students s
         LEFT JOIN departments d ON d.id = s.department_id
         LEFT JOIN student_profiles sp ON sp.student_id = s.student_id
         WHERE s.registration_status = 'pending' AND s.name IS NOT NULL
         ORDER BY s.created_at DESC`
      ),
      db.promise().query(
        `SELECT 'teacher' AS type, t.teacher_id AS registration_id, t.name, t.email,
                t.department_id, COALESCE(d.department_name, t.department) AS department_name, NULL AS course,
                t.phone, NULL AS nid, t.designation, t.created_at, t.registration_status
         FROM teachers t
         LEFT JOIN departments d ON d.id = t.department_id
         WHERE t.registration_status = 'pending'
         ORDER BY t.created_at DESC`
      ),
    ]);
    return res.json([...students, ...teachers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) {
    console.error("Pending registration list error:", err);
    return res.status(500).json({ error: "Could not load pending registrations" });
  }
}

async function getRegistrationIds(req, res) {
  try {
    const [[students], [teachers]] = await Promise.all([
      db.promise().query(
        `SELECT 'student' AS type, s.student_id AS id, s.created_at,
          CASE WHEN a.status = 'revoked' OR a.revoked_at IS NOT NULL THEN 'revoked'
               WHEN s.registration_status = 'approved' THEN 'approved'
               WHEN s.registration_status = 'rejected' THEN 'rejected'
               WHEN s.name IS NOT NULL THEN 'pending'
               WHEN a.expires_at <= NOW() THEN 'expired'
               ELSE 'unused' END AS status
         FROM students s INNER JOIN student_activation_codes a ON a.student_id = s.student_id
         ORDER BY s.created_at DESC LIMIT 300`
      ),
      db.promise().query(
        `SELECT 'teacher' AS type, a.teacher_id AS id, a.created_at,
          CASE WHEN a.status = 'revoked' THEN 'revoked'
               WHEN a.status = 'approved' THEN 'approved'
               WHEN a.status = 'rejected' THEN 'rejected'
               WHEN a.status = 'pending' THEN 'pending'
               WHEN a.expires_at <= NOW() THEN 'expired'
               ELSE 'unused' END AS status
         FROM teacher_activation_codes a ORDER BY a.created_at DESC LIMIT 300`
      ),
    ]);
    return res.json([...students, ...teachers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) {
    console.error("Registration ID list error:", err);
    return res.status(500).json({ error: "Could not load generated registration IDs" });
  }
}

async function approveRegistration(req, res) {
  const type = normalizeType(req.params.type);
  const id = String(req.params.id || "").trim().toUpperCase();
  if (!type || !id) return res.status(400).json({ error: "Valid registration type and ID are required" });

  const body = req.body || {};
  const departmentId = Number(body.departmentId || 0);
  const courseId = Number(body.courseId || 0);
  const academicYearId = Number(body.academicYearId || 0);
  const semesterId = Number(body.semesterId || 0);
  const designation = String(body.designation || "").trim();
  const courseIds = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    if (type === "student") {
      const [rows] = await connection.query(
        `SELECT student_id, name, email, registration_status FROM students WHERE student_id = ? FOR UPDATE`, [id]
      );
      const student = rows[0];
      if (!student) { await connection.rollback(); return res.status(404).json({ error: "Student registration not found" }); }
      if (student.registration_status !== "pending" || !student.name || !student.email) { await connection.rollback(); return res.status(409).json({ error: "Student registration is not pending or complete" }); }
      if (!departmentId || !courseId || !academicYearId || !semesterId) { await connection.rollback(); return res.status(400).json({ error: "Select an active department, course, academic session and semester" }); }
      const [[departments], [courses], [users], [academicYears], [semesters]] = await Promise.all([
        connection.query("SELECT id, department_name FROM departments WHERE id = ? AND status = 'Active'", [departmentId]),
        connection.query("SELECT id, course_name, department_id, semester_id FROM courses WHERE id = ?", [courseId]),
        connection.query("SELECT id, status FROM users WHERE student_id = ? AND LOWER(email) = LOWER(?) AND role = 'student' FOR UPDATE", [id, student.email]),
        connection.query("SELECT id FROM academic_years WHERE id = ? AND status = 'Active'", [academicYearId]),
        connection.query("SELECT id, department_id, semester_number FROM semesters WHERE id = ? AND status = 'Active'", [semesterId]),
      ]);
      if (!departments.length || !courses.length || Number(courses[0].department_id) !== departmentId) { await connection.rollback(); return res.status(400).json({ error: "Selected course must belong to the selected active department" }); }
      if (!academicYears.length || !semesters.length || Number(semesters[0].department_id) !== departmentId) { await connection.rollback(); return res.status(400).json({ error: "Selected academic year or semester is invalid for this department" }); }
      if (!Number(courses[0].semester_id) || Number(courses[0].semester_id) !== semesterId) { await connection.rollback(); return res.status(400).json({ error: "Selected course is not offered in the selected semester" }); }
      if (!users.length || users[0].status !== "suspended") { await connection.rollback(); return res.status(409).json({ error: "Student login account is missing, incorrectly linked or not suspended" }); }
      const yearNumber = Math.max(1, Math.min(4, Math.ceil(Number(semesters[0].semester_number) / 2)));
      const yearSuffix = yearNumber === 1 ? "st" : yearNumber === 2 ? "nd" : yearNumber === 3 ? "rd" : "th";
      const year = `${yearNumber}${yearSuffix} Year`;
      const [studentUpdate] = await connection.query(
        `UPDATE students SET department_id = ?, course_id = ?, course = ?, year = ?, registration_status = 'approved', status = 'Active', approved_at = NOW(), approved_by = ? WHERE student_id = ? AND registration_status = 'pending'`,
        [departmentId, courseId, courses[0].course_name, year, req.user.id, id]
      );

      if (studentUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Student approval could not be applied" });
      }
      await connection.query(
        `INSERT INTO student_enrollments (student_id, academic_year_id, semester_id, enrollment_date, status)
         VALUES (?, ?, ?, CURDATE(), 'Active')
         ON DUPLICATE KEY UPDATE status = 'Active'`, [id, academicYearId, semesterId]
      );
      await connection.query(
        `INSERT INTO course_selections (student_id, course_id, academic_year_id, semester_id, selection_status)
         VALUES (?, ?, ?, ?, 'Selected')
         ON DUPLICATE KEY UPDATE selection_status = 'Selected'`, [id, courseId, academicYearId, semesterId]
      );
            const [studentUserUpdate] = await connection.query(
        "UPDATE users SET status = 'active' WHERE id = ? AND student_id = ? AND role = 'student' AND status = 'suspended'",
        [users[0].id, id]
      );

      if (studentUserUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Student login account could not be activated" });
      }
            const [studentCodeUpdate] = await connection.query(
        "UPDATE student_activation_codes SET status = 'approved' WHERE student_id = ? AND status = 'pending' AND used_at IS NOT NULL",
        [id]
      );

      if (studentCodeUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Student activation code is not in a pending approval state" });
      }
    } else {
      const [rows] = await connection.query(
        `SELECT id, teacher_id, user_id, email, registration_status FROM teachers WHERE teacher_id = ? FOR UPDATE`, [id]
      );
      const teacher = rows[0];
      if (!teacher) { await connection.rollback(); return res.status(404).json({ error: "Teacher registration not found" }); }
      if (teacher.registration_status !== "pending" || !teacher.user_id) { await connection.rollback(); return res.status(409).json({ error: "Teacher registration is not pending or linked to a login account" }); }

      const [teacherUsers] = await connection.query(
        "SELECT id, email, role, status FROM users WHERE id = ? AND LOWER(email) = LOWER(?) AND role = 'teacher' FOR UPDATE",
        [teacher.user_id, teacher.email]
      );

      if (!teacherUsers.length || teacherUsers[0].status !== "suspended") {
        await connection.rollback();
        return res.status(409).json({
          error: "Teacher login account is missing or incorrectly linked"
        });
      }
      if (!departmentId || !designation || designation.length > 100) { await connection.rollback(); return res.status(400).json({ error: "Select a valid department and designation" }); }
      const [departmentRows] = await connection.query("SELECT department_name FROM departments WHERE id = ? AND status = 'Active'", [departmentId]);
      if (!departmentRows.length) { await connection.rollback(); return res.status(400).json({ error: "Selected department is unavailable" }); }
      let courseRows = [];

      if (courseIds.length) {
        [courseRows] = await connection.query(
          `SELECT c.id, c.department_id, c.semester_id
           FROM courses c
           INNER JOIN semesters s
             ON s.id = c.semester_id
            AND s.department_id = c.department_id
            AND s.status = 'Active'
           WHERE c.id IN (?)`,
          [courseIds]
        );

        if (
          courseRows.length !== courseIds.length ||
          courseRows.some((course) =>
            Number(course.department_id) !== departmentId ||
            !Number(course.semester_id)
          )
        ) {
          await connection.rollback();
          return res.status(400).json({
            error: "All assigned courses must belong to the selected department and have a semester"
          });
        }
      }

      let teacherAcademicYearId = academicYearId;

      if (courseIds.length && !teacherAcademicYearId) {
        const [activeYears] = await connection.query(
          "SELECT id FROM academic_years WHERE status = 'Active' ORDER BY start_date DESC, id DESC LIMIT 1"
        );

        teacherAcademicYearId = Number(activeYears[0]?.id || 0);
      }

      if (courseIds.length && !teacherAcademicYearId) {
        await connection.rollback();
        return res.status(400).json({
          error: "An active academic year is required for teacher course assignments"
        });
      }

      const [teacherUpdate] = await connection.query(
        `UPDATE teachers SET department = ?, department_id = ?, designation = ?, status = 'Active', registration_status = 'approved', approved_at = NOW(), approved_by = ? WHERE teacher_id = ? AND registration_status = 'pending'`,
        [departmentRows[0].department_name, departmentId, designation, req.user.id, id]
      );

      if (teacherUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Teacher approval could not be applied" });
      }

      for (const course of courseRows) {
        await connection.query(
          `INSERT INTO teacher_courses
            (teacher_id, course_id, academic_year_id, semester_id, section, status)
           SELECT ?, ?, ?, ?, '', 'Active'
           WHERE NOT EXISTS (
             SELECT 1 FROM teacher_courses
             WHERE teacher_id = ?
               AND course_id = ?
               AND academic_year_id = ?
               AND semester_id = ?
               AND COALESCE(section, '') = ''
           )`,
          [
            teacher.id,
            course.id,
            teacherAcademicYearId,
            course.semester_id,
            teacher.id,
            course.id,
            teacherAcademicYearId,
            course.semester_id
          ]
        );
      }
            const [teacherUserUpdate] = await connection.query(
        "UPDATE users SET status = 'active' WHERE id = ? AND LOWER(email) = LOWER(?) AND role = 'teacher' AND status = 'suspended'",
        [teacher.user_id, teacher.email]
      );

      if (teacherUserUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Teacher login account could not be activated" });
      }
            const [teacherCodeUpdate] = await connection.query(
        "UPDATE teacher_activation_codes SET status = 'approved' WHERE teacher_id = ? AND status = 'pending' AND used_at IS NOT NULL",
        [id]
      );

      if (teacherCodeUpdate.affectedRows !== 1) {
        await connection.rollback();
        return res.status(409).json({ error: "Teacher activation code is not in a pending approval state" });
      }
    }

    await connection.commit();
    writeAuditLog(req, { action: `${type.toUpperCase()}_REGISTRATION_APPROVED`, entityType: type, entityId: id, newValues: { registrationStatus: "approved" } });
    return res.json({ success: true, type, id, message: `${type === "student" ? "Student" : "Teacher"} registration approved. The registrant can now sign in using the password they created.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Registration approval error:", err);
    return res.status(500).json({ error: "Could not approve registration" });
  } finally {
    if (connection) connection.release();
  }
}

async function rejectRegistration(req, res) {
  const type = normalizeType(req.params.type);
  const id = String(req.params.id || "").trim().toUpperCase();
  if (!type || !id) return res.status(400).json({ error: "Valid registration type and ID are required" });
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    if (type === "student") {
      const [rows] = await connection.query("SELECT registration_status FROM students WHERE student_id = ? FOR UPDATE", [id]);
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: "Student registration not found" }); }
      if (rows[0].registration_status !== "pending") { await connection.rollback(); return res.status(409).json({ error: "Only pending registrations can be rejected" }); }
      await connection.query("UPDATE students SET registration_status = 'rejected', status = 'Inactive' WHERE student_id = ?", [id]);
      await connection.query("UPDATE users SET status = 'suspended' WHERE student_id = ? AND role = 'student'", [id]);
      await connection.query(
        `UPDATE user_sessions us
         INNER JOIN users u ON u.id = us.user_id
         SET us.revoked_at = NOW()
         WHERE u.student_id = ? AND u.role = 'student'
           AND us.revoked_at IS NULL`,
        [id]
      );
      await connection.query("UPDATE student_activation_codes SET status = 'rejected' WHERE student_id = ?", [id]);
    } else {
      const [rows] = await connection.query("SELECT id, user_id, registration_status FROM teachers WHERE teacher_id = ? FOR UPDATE", [id]);
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: "Teacher registration not found" }); }
      if (rows[0].registration_status !== "pending") { await connection.rollback(); return res.status(409).json({ error: "Only pending registrations can be rejected" }); }
      await connection.query("UPDATE teachers SET registration_status = 'rejected', status = 'Inactive' WHERE teacher_id = ?", [id]);
      if (rows[0].user_id) {
        await connection.query("UPDATE users SET status = 'suspended' WHERE id = ? AND role = 'teacher'", [rows[0].user_id]);
        await connection.query(
          "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
          [rows[0].user_id]
        );
      }
      await connection.query("UPDATE teacher_activation_codes SET status = 'rejected' WHERE teacher_id = ?", [id]);
    }
    await connection.commit();
    writeAuditLog(req, { action: `${type.toUpperCase()}_REGISTRATION_REJECTED`, entityType: type, entityId: id });
    return res.json({ success: true, type, id, message: `${type === "student" ? "Student" : "Teacher"} registration rejected` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Registration rejection error:", err);
    return res.status(500).json({ error: "Could not reject registration" });
  } finally {
    if (connection) connection.release();
  }
}

async function revokeRegistrationId(req, res) {
  const type = normalizeType(req.params.type);
  const id = String(req.params.id || "").trim().toUpperCase();
  if (!type || !id) return res.status(400).json({ error: "Valid registration type and ID are required" });
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    if (type === "student") {
      const [rows] = await connection.query(
        `SELECT s.name, s.registration_status, a.used_at, a.revoked_at, a.status
         FROM students s INNER JOIN student_activation_codes a ON a.student_id = s.student_id
         WHERE s.student_id = ? FOR UPDATE`, [id]
      );
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: "Student registration ID not found" }); }
      if (rows[0].name || rows[0].used_at || rows[0].revoked_at || rows[0].status !== "issued" || rows[0].registration_status !== "pending") { await connection.rollback(); return res.status(409).json({ error: "Only unused student IDs can be revoked" }); }
      await connection.query("UPDATE student_activation_codes SET status = 'revoked', revoked_at = NOW() WHERE student_id = ?", [id]);
      await connection.query("UPDATE students SET registration_status = 'rejected', status = 'Inactive' WHERE student_id = ?", [id]);
    } else {
      const [rows] = await connection.query("SELECT used_at, status FROM teacher_activation_codes WHERE teacher_id = ? FOR UPDATE", [id]);
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: "Teacher registration ID not found" }); }
      if (rows[0].used_at || rows[0].status !== "issued") { await connection.rollback(); return res.status(409).json({ error: "Only unused teacher IDs can be revoked" }); }
      await connection.query("UPDATE teacher_activation_codes SET status = 'revoked', revoked_at = NOW() WHERE teacher_id = ?", [id]);
    }
    await connection.commit();
    writeAuditLog(req, { action: `${type.toUpperCase()}_REGISTRATION_ID_REVOKED`, entityType: `${type}_registration_id`, entityId: id });
    return res.json({ success: true, message: `${type === "student" ? "Student" : "Teacher"} ID revoked` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Registration ID revocation error:", err);
    return res.status(500).json({ error: "Could not revoke registration ID" });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  generateRegistrationId,
  verifyRegistration,
  submitRegistration,
  getPendingRegistrations,
  getRegistrationIds,
  approveRegistration,
  rejectRegistration,
  revokeRegistrationId,
  getRegistrationOptions,
};
