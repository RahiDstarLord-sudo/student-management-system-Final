
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const TEACHER_STATUSES = ["Active", "Inactive"];

function getTeacherPayload(body) {
  const teacherId = String(body.teacherId || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const department = String(body.department || "").trim();
  const designation = String(body.designation || "").trim();
  const status = String(body.status || "Active");


  if (
    !teacherId ||
    teacherId.length > 40 ||
    !name ||
    name.length > 180 ||
    !email ||
    email.length > 180 ||
    !department ||
    department.length > 120 ||
    !designation ||
    designation.length > 100 ||
    phone.length > 40 ||
    !TEACHER_STATUSES.includes(status)
  ) {
    return {
      error: "Please provide valid teacher information",
    };
  }

  return {
    teacherId,
    name,
    email,
    phone,
    department,
    designation,
    status,
  };
}

// Generate a random temporary password.
// The password itself is never written to audit logs.
function generateTemporaryPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 10; i += 1) {
    password += chars[crypto.randomInt(chars.length)];
  }

  return password;
}

function sendTeacherList(res) {
  db.query(
    `SELECT t.id, t.teacher_id, t.name, t.email, t.phone, t.department,
            t.designation, t.status, t.registration_status, tc.course_id,
            c.course_code, c.course_name
     FROM teachers t
     LEFT JOIN teacher_courses tc ON tc.teacher_id = t.id
     LEFT JOIN courses c ON c.id = tc.course_id
     ORDER BY t.name ASC, c.course_code ASC`,
    (err, rows) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          error: "Could not load teachers",
        });
      }

      const teacherMap = new Map();

      rows.forEach((row) => {
        if (!teacherMap.has(row.id)) {
          teacherMap.set(row.id, {
            id: row.id,
            teacher_id: row.teacher_id,
            name: row.name,
            email: row.email,
            phone: row.phone || "",
            department: row.department,
            designation: row.designation,
             status: row.status,
             registration_status: row.registration_status,
             courses: [],
          });
        }

        if (row.course_id) {
          teacherMap.get(row.id).courses.push({
            id: row.course_id,
            course_code: row.course_code,
            course_name: row.course_name,
          });
        }
      });

      return res.json(Array.from(teacherMap.values()));
    }
  );
}

function getTeachers(req, res) {
  sendTeacherList(res);
}


function updateTeacher(req, res) {
  const teacher = getTeacherPayload(req.body || {});

  if (teacher.error) {
    return res.status(400).json({
      error: teacher.error,
    });
  }

  db.query(
    `SELECT id, teacher_id, name, email, phone, department, designation, status
     FROM teachers
     WHERE id = ?`,
    [req.params.id],
    (findErr, foundRows) => {
      if (findErr) {
        console.error(findErr);

        return res.status(500).json({
          error: "Could not find teacher",
        });
      }

      if (!foundRows.length) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      db.query(
        `UPDATE teachers
         SET teacher_id = ?, name = ?, email = ?, phone = ?, department = ?,
             designation = ?, status = ?
         WHERE id = ?`,
        [
          teacher.teacherId,
          teacher.name,
          teacher.email,
          teacher.phone || null,
          teacher.department,
          teacher.designation,
          teacher.status,
          req.params.id,
        ],
        (updateErr) => {
          if (updateErr) {
            if (updateErr.code === "ER_DUP_ENTRY") {
              return res.status(409).json({
                error: "Teacher ID or email already exists",
              });
            }

            console.error(updateErr);

            return res.status(500).json({
              error: "Could not update teacher",
            });
          }

          writeAuditLog(req, {
            action: "TEACHER_UPDATED",
            entityType: "teacher",
            entityId: req.params.id,
            oldValues: foundRows[0],
            newValues: {
              teacherId: teacher.teacherId,
              name: teacher.name,
              email: teacher.email,
              phone: teacher.phone,
              department: teacher.department,
              designation: teacher.designation,
              status: teacher.status,
            },
          });

          return sendTeacherList(res);
        }
      );
    }
  );
}

function deleteTeacher(req, res) {
  db.query(
    `SELECT id, teacher_id, name, email, phone, department, designation, status
     FROM teachers
     WHERE id = ?`,
    [req.params.id],
    (findErr, rows) => {
      if (findErr) {
        console.error(findErr);

        return res.status(500).json({
          error: "Could not find teacher",
        });
      }

      const oldTeacher = rows[0];

      if (!oldTeacher) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      db.query(
        "DELETE FROM teacher_courses WHERE teacher_id = ?",
        [req.params.id],
        (assignmentErr) => {
          if (assignmentErr) {
            console.error(assignmentErr);

            return res.status(500).json({
              error: "Could not remove teacher course assignments",
            });
          }

          db.query(
            "DELETE FROM teachers WHERE id = ?",
            [req.params.id],
            (err, result) => {
              if (err) {
                console.error(err);

                return res.status(500).json({
                  error: "Could not delete teacher",
                });
              }

              if (!result.affectedRows) {
                return res.status(404).json({
                  error: "Teacher not found",
                });
              }

              writeAuditLog(req, {
                action: "TEACHER_DELETED",
                entityType: "teacher",
                entityId: req.params.id,
                oldValues: oldTeacher,
              });

              return res.json({
                success: true,
                message: "Teacher deleted successfully",
              });
            }
          );
        }
      );
    }
  );
}

function getTeacherCourseAssignments(req, res) {
  const {
    teacher_id,
    academic_year_id,
    semester_id,
    section,
  } = req.query || {};

  let sql = `
    SELECT tc.id, tc.teacher_id, t.teacher_id AS teacher_code,
           t.name AS teacher_name, t.department AS teacher_department,
           tc.course_id, c.course_code, c.course_name, c.credits,
           tc.academic_year_id, ay.year_name AS academic_year_name,
           tc.semester_id, s.semester_number, s.semester_name,
           tc.section, tc.status, tc.created_at
    FROM teacher_courses tc
    INNER JOIN teachers t ON t.id = tc.teacher_id
    INNER JOIN courses c ON c.id = tc.course_id
    LEFT JOIN academic_years ay ON ay.id = tc.academic_year_id
    LEFT JOIN semesters s ON s.id = tc.semester_id
    WHERE 1 = 1
  `;

  const params = [];

  if (teacher_id) {
    sql += " AND tc.teacher_id = ?";
    params.push(Number(teacher_id));
  }

  if (academic_year_id) {
    sql += " AND tc.academic_year_id = ?";
    params.push(Number(academic_year_id));
  }

  if (semester_id) {
    sql += " AND tc.semester_id = ?";
    params.push(Number(semester_id));
  }

  if (section && String(section).trim()) {
    sql += " AND tc.section = ?";
    params.push(String(section).trim());
  }

  sql += " ORDER BY tc.id DESC";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Failed to fetch teacher course assignments:", err);

      return res.status(500).json({
        error: "Could not load course assignments",
      });
    }

    return res.json(rows);
  });
}

async function assignCourseToTeacher(req, res) {
  const teacherId = Number(req.params.id);
  const body = req.body || {};
  const courseId = Number(body.course_id);
  const academicYearId = body.academic_year_id === undefined || body.academic_year_id === null || body.academic_year_id === ""
    ? null : Number(body.academic_year_id);
  const semesterId = body.semester_id === undefined || body.semester_id === null || body.semester_id === ""
    ? null : Number(body.semester_id);
  const section = body.section == null ? null : String(body.section).trim().slice(0, 30) || null;
  const status = body.status === undefined ? "Active" : body.status;

  if (!Number.isInteger(teacherId) || teacherId <= 0 || !Number.isInteger(courseId) || courseId <= 0 ||
      (academicYearId !== null && (!Number.isInteger(academicYearId) || academicYearId <= 0)) ||
      (semesterId !== null && (!Number.isInteger(semesterId) || semesterId <= 0)) ||
      !["Active", "Inactive"].includes(status)) {
    return res.status(400).json({ error: "Valid teacher, course, academic year, semester, and status values are required" });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [teacherRows] = await connection.query(
      `SELECT t.id FROM teachers t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.id = ? AND LOWER(t.status) = 'active' AND LOWER(t.registration_status) = 'approved'
         AND (t.user_id IS NULL OR LOWER(u.status) = 'active')
       LIMIT 1 FOR UPDATE`,
      [teacherId]
    );
    if (!teacherRows.length) {
      await connection.rollback();
      return res.status(400).json({ error: "Only active teacher accounts can receive course assignments" });
    }

    const [courseRows] = await connection.query(
      "SELECT id, semester_id, department_id FROM courses WHERE id = ? LIMIT 1",
      [courseId]
    );
    if (!courseRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Course not found" });
    }

    if (academicYearId !== null) {
      const [yearRows] = await connection.query("SELECT id FROM academic_years WHERE id = ? AND status = 'Active' LIMIT 1", [academicYearId]);
      if (!yearRows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Select an existing active academic year" });
      }
    }

    if (semesterId !== null) {
      const [semesterRows] = await connection.query("SELECT id, department_id FROM semesters WHERE id = ? AND status = 'Active' LIMIT 1", [semesterId]);
      if (!semesterRows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Select an existing active semester" });
      }
      if (courseRows[0].semester_id && Number(courseRows[0].semester_id) !== semesterId) {
        await connection.rollback();
        return res.status(400).json({ error: "The selected semester does not match this course" });
      }
      if (courseRows[0].department_id && semesterRows[0].department_id && Number(courseRows[0].department_id) !== Number(semesterRows[0].department_id)) {
        await connection.rollback();
        return res.status(400).json({ error: "The selected semester belongs to a different department" });
      }
    }

    const [existingRows] = await connection.query(
      `SELECT id, status FROM teacher_courses
       WHERE teacher_id = ? AND course_id = ?
         AND academic_year_id <=> ? AND semester_id <=> ?
         AND COALESCE(NULLIF(TRIM(section), ''), '') = COALESCE(NULLIF(TRIM(?), ''), '')
       LIMIT 1 FOR UPDATE`,
      [teacherId, courseId, academicYearId, semesterId, section]
    );

    if (existingRows.length) {
      const existing = existingRows[0];

      if (existing.status === "Inactive" && status === "Active") {
        await connection.query(
          "UPDATE teacher_courses SET status = 'Active' WHERE id = ?",
          [existing.id]
        );
        await connection.commit();

        writeAuditLog(req, {
          action: "TEACHER_COURSE_ASSIGNMENT_REACTIVATED",
          entityType: "teacher_course_assignment",
          entityId: existing.id,
          newValues: { teacherId, courseId, academicYearId, semesterId, section, status: "Active" },
        });

        return res.json({
          success: true,
          id: existing.id,
          teacher_id: teacherId,
          course_id: courseId,
          academic_year_id: academicYearId,
          semester_id: semesterId,
          section,
          status: "Active",
          reactivated: true,
        });
      }

      await connection.rollback();
      return res.status(409).json({
        error: "An assignment record already exists for this course offering. Edit the existing record instead.",
      });
    }

    const [result] = await connection.query(
      `INSERT INTO teacher_courses
       (teacher_id, course_id, academic_year_id, semester_id, section, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacherId, courseId, academicYearId, semesterId, section, status]
    );
    await connection.commit();

    writeAuditLog(req, {
      action: "TEACHER_COURSE_ASSIGNED",
      entityType: "teacher_course_assignment",
      entityId: result.insertId,
      newValues: { teacherId, courseId, academicYearId, semesterId, section, status },
    });

    return res.status(201).json({
      success: true,
      id: result.insertId,
      teacher_id: teacherId,
      course_id: courseId,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      section,
      status,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "This teacher already has an assignment for the selected course offering" });
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ error: "One or more selected academic records do not exist" });
    }
    console.error("Could not assign course to teacher:", err);
    return res.status(500).json({ error: "Could not assign course to teacher" });
  } finally {
    if (connection) connection.release();
  }
}

async function updateTeacherCourseAssignment(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({ error: "Valid assignmentId is required" });
  }

  let connection;
  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [currentRows] = await connection.query(
      `SELECT id, teacher_id, course_id, academic_year_id, semester_id, section, status
       FROM teacher_courses WHERE id = ? LIMIT 1 FOR UPDATE`,
      [assignmentId]
    );
    if (!currentRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Course assignment not found" });
    }
    const current = currentRows[0];
    const body = req.body || {};
    const teacherId = body.teacher_id === undefined ? Number(current.teacher_id) : Number(body.teacher_id);
    const courseId = body.course_id === undefined ? Number(current.course_id) : Number(body.course_id);
    const academicYearId = body.academic_year_id === undefined ? (current.academic_year_id == null ? null : Number(current.academic_year_id)) : (body.academic_year_id === null || body.academic_year_id === "" ? null : Number(body.academic_year_id));
    const semesterId = body.semester_id === undefined ? (current.semester_id == null ? null : Number(current.semester_id)) : (body.semester_id === null || body.semester_id === "" ? null : Number(body.semester_id));
    const section = body.section === undefined ? current.section : (body.section == null ? null : String(body.section).trim().slice(0, 30) || null);
    const status = body.status === undefined ? current.status : body.status;

    if (!Number.isInteger(teacherId) || teacherId <= 0 || !Number.isInteger(courseId) || courseId <= 0 ||
        (academicYearId !== null && (!Number.isInteger(academicYearId) || academicYearId <= 0)) ||
        (semesterId !== null && (!Number.isInteger(semesterId) || semesterId <= 0)) ||
        !["Active", "Inactive"].includes(status)) {
      await connection.rollback();
      return res.status(400).json({ error: "Invalid assignment information" });
    }

    if (status === "Active") {
      const [teacherRows] = await connection.query(
        `SELECT t.id FROM teachers t LEFT JOIN users u ON u.id = t.user_id
         WHERE t.id = ? AND LOWER(t.status) = 'active' AND LOWER(t.registration_status) = 'approved'
           AND (t.user_id IS NULL OR LOWER(u.status) = 'active') LIMIT 1`,
        [teacherId]
      );
      if (!teacherRows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Only active teacher accounts can have active course assignments" });
      }
    }

    const [courseRows] = await connection.query("SELECT id, semester_id, department_id FROM courses WHERE id = ? LIMIT 1", [courseId]);
    if (!courseRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Course not found" });
    }
    if (academicYearId !== null) {
      const [rows] = await connection.query("SELECT id FROM academic_years WHERE id = ? AND status = 'Active' LIMIT 1", [academicYearId]);
      if (!rows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Select an existing active academic year" });
      }
    }
    if (semesterId !== null) {
      const [rows] = await connection.query("SELECT id, department_id FROM semesters WHERE id = ? AND status = 'Active' LIMIT 1", [semesterId]);
      if (!rows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Select an existing active semester" });
      }
      if (courseRows[0].semester_id && Number(courseRows[0].semester_id) !== semesterId) {
        await connection.rollback();
        return res.status(400).json({ error: "The selected semester does not match this course" });
      }
      if (courseRows[0].department_id && rows[0].department_id && Number(courseRows[0].department_id) !== Number(rows[0].department_id)) {
        await connection.rollback();
        return res.status(400).json({ error: "The selected semester belongs to a different department" });
      }
    }

    const [duplicates] = await connection.query(
      `SELECT id FROM teacher_courses
       WHERE id <> ? AND teacher_id = ? AND course_id = ?
         AND academic_year_id <=> ? AND semester_id <=> ?
         AND COALESCE(NULLIF(TRIM(section), ''), '') = COALESCE(NULLIF(TRIM(?), ''), '')
       LIMIT 1 FOR UPDATE`,
      [assignmentId, teacherId, courseId, academicYearId, semesterId, section]
    );

    if (duplicates.length) {
      await connection.rollback();
      return res.status(409).json({
        error: "An assignment record already exists for this course offering. Edit the existing record instead.",
      });
    }

    await connection.query(
      `UPDATE teacher_courses SET teacher_id = ?, course_id = ?, academic_year_id = ?,
       semester_id = ?, section = ?, status = ? WHERE id = ?`,
      [teacherId, courseId, academicYearId, semesterId, section, status, assignmentId]
    );
    await connection.commit();

    writeAuditLog(req, {
      action: "TEACHER_COURSE_ASSIGNMENT_UPDATED",
      entityType: "teacher_course_assignment",
      entityId: assignmentId,
      oldValues: current,
      newValues: { teacherId, courseId, academicYearId, semesterId, section, status },
    });
    return res.json({ success: true, id: assignmentId, teacher_id: teacherId, course_id: courseId, academic_year_id: academicYearId, semester_id: semesterId, section, status });
  } catch (err) {
    if (connection) await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This teacher already has an assignment for the selected course offering" });
    if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "One or more selected academic records do not exist" });
    console.error("Could not update course assignment:", err);
    return res.status(500).json({ error: "Could not update course assignment" });
  } finally {
    if (connection) connection.release();
  }
}

function deleteTeacherCourseAssignment(req, res) {
  const assignmentId = Number(req.params.assignmentId);

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({
      error: "Valid assignmentId is required",
    });
  }

  db.query(
    `SELECT id, teacher_id, course_id, academic_year_id, semester_id,
            section, status
     FROM teacher_courses
     WHERE id = ?
     LIMIT 1`,
    [assignmentId],
    (findErr, rows) => {
      if (findErr) {
        console.error("Failed to find course assignment:", findErr);

        return res.status(500).json({
          error: "Could not find course assignment",
        });
      }

      const oldAssignment = rows[0];

      if (!oldAssignment) {
        return res.status(404).json({
          error: "Course assignment not found",
        });
      }

      db.query(
        "UPDATE teacher_courses SET status = 'Inactive' WHERE id = ?",
        [assignmentId],
        (err, result) => {
          if (err) {
            console.error("Failed to delete course assignment:", err);

            return res.status(500).json({
              error: "Could not delete course assignment",
            });
          }

          if (!result.affectedRows) {
            return res.status(404).json({
              error: "Course assignment not found",
            });
          }

          writeAuditLog(req, {
            action: "TEACHER_COURSE_ASSIGNMENT_DELETED",
            entityType: "teacher_course_assignment",
            entityId: assignmentId,
            oldValues: oldAssignment,
          });

          return res.json({
            success: true,
            message: "Course assignment removed successfully",
          });
        }
      );
    }
  );
}

// Teacher self-service endpoints.
// Teacher identity comes only from requireTeacher middleware.

function getMyTeacherProfile(req, res) {
  const t = req.teacher;

  return res.json({
    id: t.id,
    teacherId: t.teacher_id,
    name: t.name,
    email: t.email,
    department: t.department,
    designation: t.designation,
  });
}

function getMyTeacherCourses(req, res) {
  db.query(
    `SELECT c.id, tc.id AS assignmentId, c.course_code, c.course_name, c.credits,
            tc.academic_year_id, tc.semester_id, tc.section
     FROM teacher_courses tc
     INNER JOIN courses c ON c.id = tc.course_id
     WHERE tc.teacher_id = ? AND tc.status = 'Active'
     ORDER BY c.course_code ASC`,
    [req.teacher.id],
    (err, rows) => {
      if (err) {
        console.error("Teacher courses error:", err);

        return res.status(500).json({
          error: "Could not load assigned courses",
        });
      }

      return res.json(rows);
    }
  );
}

function getMyTeacherStudents(req, res) {
  db.query(
    `SELECT DISTINCT
       s.student_id AS studentId,
       s.name,
       s.email,
       s.course,
       s.year,
       s.status
     FROM teacher_courses tc
     INNER JOIN course_selections cs
       ON cs.course_id = tc.course_id
      AND cs.academic_year_id = tc.academic_year_id
      AND cs.semester_id = tc.semester_id
      AND cs.selection_status = 'Selected'
     INNER JOIN student_enrollments se
       ON se.student_id = cs.student_id
      AND se.academic_year_id = cs.academic_year_id
      AND se.semester_id = cs.semester_id
      AND se.status = 'Active'
     INNER JOIN students s
       ON s.student_id = cs.student_id
     WHERE tc.teacher_id = ?
       AND tc.status = 'Active'
       AND s.status = 'Active'
     ORDER BY s.name ASC`,
    [req.teacher.id],
    (err, rows) => {
      if (err) {
        console.error("Teacher students error:", err);

        return res.status(500).json({
          error: "Could not load students for assigned courses",
        });
      }

      return res.json(rows);
    }
  );
}

function getMyTeacherTimetable(req, res) {
  db.query(
    `SELECT tt.id, tt.day_of_week, tt.start_time, tt.end_time,
            tt.room, tt.semester, tt.academic_year,
            c.course_code, c.course_name
     FROM timetable_entries tt
     LEFT JOIN courses c ON c.id = tt.course_id
     WHERE tt.teacher_id = ?
     ORDER BY FIELD(tt.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
              tt.start_time ASC`,
    [req.teacher.id],
    (err, rows) => {
      if (err) {
        console.error("Teacher timetable error:", err);

        return res.status(500).json({
          error: "Could not load your timetable",
        });
      }

      return res.json(rows);
    }
  );
}

function parseProfileData(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const PROFILE_FIELDS = ["name", "phone", "dateOfBirth", "gender", "qualification", "specialization", "experienceYears", "emergencyContactName", "emergencyContactPhone", "address", "bio"];


function getMyTeacherProfileForEdit(req, res) {
  const teacherId = req.teacher.id;
  db.query(
    `SELECT t.id, t.teacher_id, t.name, t.email, t.phone, t.department, t.designation,
            p.profile_data, r.id AS request_id, r.status AS request_status, r.admin_note
     FROM teachers t
     LEFT JOIN teacher_profiles p ON p.teacher_id = t.teacher_id
     LEFT JOIN teacher_profile_requests r ON r.teacher_id = t.id AND r.status = 'Pending'
     WHERE t.id = ? ORDER BY r.created_at DESC LIMIT 1`,
    [teacherId],
    (err, rows) => {
      if (err) {
        console.error("Teacher profile load error:", err);
        return res.status(500).json({ error: "Could not load your profile" });
      }
      const row = rows[0];
      if (!row) return res.status(404).json({ error: "Teacher profile not found" });
      const approved = parseProfileData(row.profile_data);
      const profile = {
        teacherId: row.teacher_id, name: row.name, email: row.email, phone: row.phone || "",
        department: row.department, designation: row.designation, ...approved,
      };
      return res.json({ profile, request: row.request_id ? { id: row.request_id, status: row.request_status, admin_note: row.admin_note || "" } : null });
    }
  );
}

function submitMyTeacherProfile(req, res) {
  const teacherId = req.teacher.id;
  const body = req.body || {};
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    let value = body[field] == null ? "" : String(body[field]).trim();
    const max = field === "address" ? 1000 : field === "bio" ? 2000 : 180;
    if (value.length > max) return res.status(400).json({ error: `${field} must be ${max} characters or fewer` });
    profile[field] = value;
  }
  if (!profile.name) return res.status(400).json({ error: "Full name is required" });
  if (profile.experienceYears && (!/^\d+$/.test(profile.experienceYears) || Number(profile.experienceYears) > 60)) {
    return res.status(400).json({ error: "Experience must be a whole number from 0 to 60" });
  }
  profile.experienceYears = profile.experienceYears === "" ? "" : Number(profile.experienceYears);
  if (profile.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(profile.dateOfBirth)) return res.status(400).json({ error: "Enter a valid date of birth" });
  db.query("SELECT id FROM teacher_profile_requests WHERE teacher_id = ? AND status = 'Pending' LIMIT 1", [teacherId], (findErr, rows) => {
    if (findErr) return res.status(500).json({ error: "Could not verify pending profile requests" });
    if (rows.length) return res.status(409).json({ error: "You already have a profile update awaiting approval" });
    db.query(
      "INSERT INTO teacher_profile_requests (teacher_id, submitted_data, status) VALUES (?, ?, 'Pending')",
      [teacherId, JSON.stringify(profile)],
      (insertErr, result) => {
        if (insertErr) {
          console.error("Teacher profile submission error:", insertErr);
          return res.status(500).json({ error: "Could not submit profile changes" });
        }
        return res.status(201).json({ message: "Profile changes submitted for administrator approval.", request: { id: result.insertId, status: "Pending", admin_note: "" } });
      }
    );
  });
}

function getTeacherProfileRequests(req, res) {
  db.query(
    `SELECT
       r.id,
       r.teacher_id,
       r.submitted_data,
       r.status,
       r.admin_note,
       r.created_at,
       t.teacher_id AS teacher_code,
       t.name AS current_name,
       t.email,
       t.phone,
       t.department,
       t.designation,
       p.profile_data AS current_profile_data
     FROM teacher_profile_requests r
     INNER JOIN teachers t ON t.id = r.teacher_id
     LEFT JOIN teacher_profiles p ON p.teacher_id = t.teacher_id
     WHERE r.status = 'Pending'
     ORDER BY r.created_at ASC`,
    (err, rows) => {
      if (err) {
        console.error("Teacher profile requests error:", err);

        return res.status(500).json({
          error: "Could not load teacher profile requests",
        });
      }

      return res.json(
        rows.map((row) => {
          const submitted = parseProfileData(row.submitted_data);
          const approved = parseProfileData(row.current_profile_data);

          const currentProfile = {
            teacherId: row.teacher_code,
            name: row.current_name || "",
            email: row.email || "",
            phone: row.phone || "",
            department: row.department || "",
            designation: row.designation || "",
            ...approved,
          };

          return {
            id: row.id,
            teacherId: row.teacher_code,
            currentName: row.current_name,
            email: row.email,
            currentProfile,
            submitted,
            status: row.status,
            adminNote: row.admin_note || "",
            createdAt: row.created_at,
          };
        })
      );
    }
  );
}


async function reviewTeacherProfileRequest(req, res) {
  const requestId = Number(req.params.requestId);
  const decision = String(req.body?.decision || "");
  const adminNote = String(req.body?.adminNote || "").trim().slice(0, 1000);

  if (
    !Number.isInteger(requestId) ||
    requestId < 1 ||
    !["Approved", "Rejected"].includes(decision)
  ) {
    return res.status(400).json({
      error: "Choose approve or reject for a valid request",
    });
  }

  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT *
       FROM teacher_profile_requests
       WHERE id = ? AND status = 'Pending'
       LIMIT 1
       FOR UPDATE`,
      [requestId]
    );

    const request = rows[0];

    if (!request) {
      await connection.rollback();
      return res.status(404).json({
        error: "Pending profile request not found",
      });
    }

    if (decision === "Approved") {
      const [teacherRows] = await connection.query(
        "SELECT teacher_id FROM teachers WHERE id = ? LIMIT 1",
        [request.teacher_id]
      );

    if (!teacherRows.length) {
      await connection.rollback();
      return res.status(404).json({
    error: "Teacher record not found",
  });
}

const teacherCode = teacherRows[0].teacher_id;
      const data = parseProfileData(request.submitted_data);

      if (!Object.keys(data).length || !String(data.name || "").trim()) {
        await connection.rollback();
        return res.status(400).json({
          error: "Submitted profile data is invalid",
        });
      }

      const allowed = {};

      for (const field of PROFILE_FIELDS) {
        allowed[field] = data[field] ?? "";
      }

      await connection.query(
        `INSERT INTO teacher_profiles
          (teacher_id, profile_data, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           profile_data = VALUES(profile_data),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP`,
        [
          teacherCode,
          JSON.stringify(allowed),
          req.user?.id || null,
        ]
      );

      await connection.query(
        `UPDATE teachers
         SET name = ?, phone = ?
         WHERE id = ?`,
        [
          allowed.name,
          allowed.phone || null,
          request.teacher_id,
        ]
      );
    }

    const [updateResult] = await connection.query(
      `UPDATE teacher_profile_requests
       SET status = ?,
           admin_note = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'Pending'`,
      [
        decision,
        adminNote || null,
        req.user?.id || null,
        requestId,
      ]
    );

    if (!updateResult.affectedRows) {
      await connection.rollback();
      return res.status(409).json({
        error: "This request has already been reviewed",
      });
    }

    await connection.commit();

    writeAuditLog(req, {
      action: `TEACHER_PROFILE_${decision.toUpperCase()}`,
      entityType: "teacher_profile_request",
      entityId: requestId,
      newValues: {
        teacherId: request.teacher_id,
        decision,
        adminNote,
      },
    });

    return res.json({
      success: true,
      message: `Profile request ${decision.toLowerCase()}.`,
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Profile request rollback error:", rollbackError);
      }
    }

    console.error("Teacher profile review error:", err);

    return res.status(500).json({
      error: "Could not review profile request",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getTeachers,
  updateTeacher,
  deleteTeacher,
  getTeacherCourseAssignments,
  assignCourseToTeacher,
  updateTeacherCourseAssignment,
  deleteTeacherCourseAssignment,
  getMyTeacherProfile,
  getMyTeacherProfileForEdit,
  submitMyTeacherProfile,
  getTeacherProfileRequests,
  reviewTeacherProfileRequest,
  getMyTeacherCourses,
  getMyTeacherStudents,
  getMyTeacherTimetable,
};