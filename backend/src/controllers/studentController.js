const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const VALID_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const VALID_STATUSES = ["Active", "Inactive"];

function getInitials(name) {
  const clean = String(name || "").trim();
  return clean ? clean.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "?";
}

async function getAllStudents(req, res) {
  try {
    const [rows] = await db.promise().query(
      "SELECT s.student_id, s.name, s.email, s.course, s.course_id, s.year, s.status, " +
      "s.department_id, d.department_name, c.course_name AS assigned_course_name, " +
      "u.id AS account_id, u.status AS account_status " +
      "FROM students s " +
      "LEFT JOIN departments d ON d.id = s.department_id " +
      "LEFT JOIN courses c ON c.id = s.course_id " +
      "LEFT JOIN users u ON u.student_id = s.student_id AND u.role = 'student' " +
      "WHERE s.registration_status = 'approved' ORDER BY s.id DESC"
    );

    return res.json(rows.map((row) => ({
      id: row.student_id,
      name: row.name,
      email: row.email,
      course: row.assigned_course_name || row.course,
      courseId: row.course_id,
      year: row.year,
      status: row.status,
      departmentId: row.department_id,
      department: row.department_name,
      accountLinked: Boolean(row.account_id),
      accountStatus: row.account_status || "Not linked",
      initials: getInitials(row.name),
    })));
  } catch (err) {
    console.error("Student list error:", err);
    return res.status(500).json({ error: "Could not load students" });
  }
}

async function updateStudent(req, res) {
  const studentId = String(req.params.id || "").trim();
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const year = String(req.body?.year || "").trim();
  const status = String(req.body?.status || "").trim();
  const departmentId = req.body?.departmentId ? Number(req.body.departmentId) : null;
  const courseId = req.body?.courseId ? Number(req.body.courseId) : null;

  if (!studentId || !name || !email || !VALID_YEARS.includes(year) || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Provide a valid name, email, year and account status" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length > 100 || email.length > 100) {
    return res.status(400).json({ error: "Student information is invalid or exceeds the allowed length" });
  }

  if ((departmentId === null) !== (courseId === null) ||
      (departmentId !== null && (!Number.isInteger(departmentId) || departmentId < 1)) ||
      (courseId !== null && (!Number.isInteger(courseId) || courseId < 1))) {
    return res.status(400).json({ error: "Select both a valid department and course" });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [found] = await connection.query(
      "SELECT student_id, name, email, course, course_id, department_id, year, status, registration_status FROM students WHERE student_id = ? FOR UPDATE",
      [studentId]
    );

    if (!found.length || found[0].registration_status !== "approved") {
      await connection.rollback();
      return res.status(404).json({ error: "Approved student record not found" });
    }

    const oldStudent = found[0];

    const [duplicate] = await connection.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND student_id <> ? LIMIT 1",
      [email, studentId]
    );

    if (duplicate.length) {
      await connection.rollback();
      return res.status(409).json({ error: "Email address is already used by another account" });
    }

    let finalDepartmentId = oldStudent.department_id;
    let finalCourseId = oldStudent.course_id;
    let finalCourse = oldStudent.course;

    if (departmentId !== null && courseId !== null) {
      const [departments] = await connection.query(
        "SELECT id FROM departments WHERE id = ? AND status = 'Active' LIMIT 1",
        [departmentId]
      );

      if (!departments.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Selected department is unavailable" });
      }

      const [courses] = await connection.query(
        "SELECT id, course_name FROM courses WHERE id = ? AND department_id = ? LIMIT 1",
        [courseId, departmentId]
      );

      if (!courses.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Selected course does not belong to this department" });
      }

      finalDepartmentId = departmentId;
      finalCourseId = courseId;
      finalCourse = courses[0].course_name;
    }

    await connection.query(
      "UPDATE students SET name = ?, email = ?, course = ?, department_id = ?, course_id = ?, year = ?, status = ? WHERE student_id = ?",
      [name, email, finalCourse, finalDepartmentId, finalCourseId, year, status, studentId]
    );

    await connection.query(
      "UPDATE users SET email = ?, status = ? WHERE student_id = ? AND role = 'student'",
      [email, status === "Active" ? "active" : "suspended", studentId]
    );

    if (status !== "Active") {
      await connection.query(
        "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id IN (SELECT id FROM users WHERE student_id = ?) AND revoked_at IS NULL",
        [studentId]
      );
    }

    const [departmentRows] = finalDepartmentId
      ? await connection.query("SELECT department_name FROM departments WHERE id = ?", [finalDepartmentId])
      : [[]];

    await connection.commit();

    writeAuditLog(req, {
      action: "STUDENT_UPDATED",
      entityType: "student",
      entityId: studentId,
      oldValues: oldStudent,
      newValues: {
        name, email, course: finalCourse,
        departmentId: finalDepartmentId, courseId: finalCourseId, year, status
      }
    });

    return res.json({
      id: studentId,
      name,
      email,
      course: finalCourse,
      courseId: finalCourseId,
      departmentId: finalDepartmentId,
      department: departmentRows[0]?.department_name || null,
      year,
      status,
      accountLinked: true,
      accountStatus: status === "Active" ? "active" : "suspended",
      initials: getInitials(name)
    });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email address is already in use" });
    }
    console.error("Student update error:", err);
    return res.status(500).json({ error: "Could not update student" });
  } finally {
    if (connection) connection.release();
  }
}

// Legacy DELETE endpoint now performs safe deactivation; it never deletes academic records.
async function deleteStudent(req, res) {
  const studentId = String(req.params.id || "").trim();
  if (!studentId) return res.status(400).json({ error: "Student ID is required" });
  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT student_id, name, status, registration_status FROM students WHERE student_id = ? FOR UPDATE", [studentId]
    );
    if (!rows.length || rows[0].registration_status !== "approved") {
      await connection.rollback();
      return res.status(404).json({ error: "Approved student record not found" });
    }
    await connection.query("UPDATE students SET status = 'Inactive' WHERE student_id = ?", [studentId]);
    await connection.query("UPDATE users SET status = 'suspended' WHERE student_id = ? AND role = 'student'", [studentId]);
    await connection.query("UPDATE user_sessions SET revoked_at = NOW() WHERE user_id IN (SELECT id FROM users WHERE student_id = ?) AND revoked_at IS NULL", [studentId]);
    await connection.commit();
    writeAuditLog(req, { action: "STUDENT_DEACTIVATED", entityType: "student", entityId: studentId, oldValues: rows[0], newValues: { status: "Inactive", accountStatus: "suspended" } });
    return res.json({ success: true, message: "Student account deactivated. Academic records were preserved." });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Student deactivation error:", err);
    return res.status(500).json({ error: "Could not deactivate student" });
  } finally {
    if (connection) connection.release();
  }
}

async function getMyProfile(req, res) {
  if (req.user.role !== "student" || !req.user.studentId) return res.status(403).json({ error: "Students only" });
  try {
    const [rows] = await db.promise().query(
      `SELECT s.student_id, s.name, s.email, s.course, s.year, s.status,
              s.department_id, d.department_name, sp.phone, sp.nid
       FROM students s
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN student_profiles sp ON sp.student_id = s.student_id
       WHERE s.student_id = ? AND s.registration_status = 'approved' LIMIT 1`,
      [req.user.studentId]
    );
    if (!rows.length) return res.status(404).json({ error: "Student record not found" });
    const row = rows[0];
    return res.json({ id: row.student_id, name: row.name, email: row.email, course: row.course, year: row.year, status: row.status, departmentId: row.department_id, department: row.department_name, phone: row.phone, nid: row.nid, initials: getInitials(row.name) });
  } catch (err) {
    console.error("Student profile error:", err);
    return res.status(500).json({ error: "Could not load student profile" });
  }
}

module.exports = { getAllStudents, updateStudent, deleteStudent, getMyProfile };
