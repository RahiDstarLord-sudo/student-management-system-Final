
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

  const courseIds = Array.isArray(body.courseIds)
    ? [
        ...new Set(
          body.courseIds
            .map(Number)
            .filter((id) => Number.isInteger(id) && id > 0)
        ),
      ]
    : [];

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
    courseIds,
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
            t.designation, t.status, tc.course_id,
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

function saveTeacherAssignments(teacherId, courseIds, callback) {
  db.query(
    "SELECT id FROM courses WHERE id IN (?)",
    [courseIds.length ? courseIds : [0]],
    (checkErr, rows) => {
      if (checkErr) {
        return callback(checkErr);
      }

      if (rows.length !== courseIds.length) {
        return callback(
          new Error("One or more selected courses were not found")
        );
      }

      db.query(
        "DELETE FROM teacher_courses WHERE teacher_id = ?",
        [teacherId],
        (deleteErr) => {
          if (deleteErr) {
            return callback(deleteErr);
          }

          if (!courseIds.length) {
            return callback(null);
          }

          const values = courseIds.map((courseId) => [
            teacherId,
            courseId,
          ]);

          db.query(
            "INSERT INTO teacher_courses (teacher_id, course_id) VALUES ?",
            [values],
            callback
          );
        }
      );
    }
  );
}

function getTeachers(req, res) {
  sendTeacherList(res);
}

async function createTeacher(req, res) {
  const teacher = getTeacherPayload(req.body || {});

  if (teacher.error) {
    return res.status(400).json({
      error: teacher.error,
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    // 1. Create login account.
    const [userResult] = await connection.query(
      `INSERT INTO users
        (email, password_hash, role, status, must_change_password)
       VALUES (?, ?, 'teacher', ?, 1)`,
      [
        teacher.email,
        passwordHash,
        teacher.status === "Active" ? "active" : "suspended",
      ]
    );

    // 2. Create teacher record linked to the login account.
    const [teacherResult] = await connection.query(
      `INSERT INTO teachers
        (teacher_id, user_id, name, email, phone, department, designation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teacher.teacherId,
        userResult.insertId,
        teacher.name,
        teacher.email,
        teacher.phone || null,
        teacher.department,
        teacher.designation,
        teacher.status,
      ]
    );

    // 3. Assign selected courses.
    if (teacher.courseIds.length) {
      const [courseRows] = await connection.query(
        "SELECT id FROM courses WHERE id IN (?)",
        [teacher.courseIds]
      );

      if (courseRows.length !== teacher.courseIds.length) {
        const courseError = new Error(
          "One or more selected courses were not found"
        );

        courseError.isValidation = true;
        throw courseError;
      }

      const values = teacher.courseIds.map((courseId) => [
        teacherResult.insertId,
        courseId,
      ]);

      await connection.query(
        "INSERT INTO teacher_courses (teacher_id, course_id) VALUES ?",
        [values]
      );
    }

    await connection.commit();

    writeAuditLog(req, {
      action: "TEACHER_CREATED",
      entityType: "teacher",
      entityId: teacherResult.insertId,
      newValues: {
        teacherId: teacher.teacherId,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        department: teacher.department,
        designation: teacher.designation,
        status: teacher.status,
        courseIds: teacher.courseIds,
      },
    });

return res.status(201).json({
  success: true,
  teacherId: teacher.teacherId,
  loginId: teacher.teacherId,
  email: teacher.email,
  temporaryPassword,
  message: "Teacher account created. Share the login ID and temporary password securely.",
});
  } catch (err) {
    await connection.rollback();

    if (err.isValidation) {
      return res.status(400).json({
        error: err.message,
      });
    }

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Teacher ID or email already exists",
      });
    }

    console.error(err);

    return res.status(500).json({
      error: "Could not add teacher",
    });
  } finally {
    connection.release();
  }
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

          saveTeacherAssignments(
            Number(req.params.id),
            teacher.courseIds,
            (assignmentErr) => {
              if (assignmentErr) {
                console.error(assignmentErr);

                return res.status(400).json({
                  error:
                    assignmentErr.message ||
                    "Could not update course assignments",
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
                  courseIds: teacher.courseIds,
                },
              });

              return sendTeacherList(res);
            }
          );
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

function assignCourseToTeacher(req, res) {
  const teacherId = Number(req.params.id);

  const {
    course_id,
    academic_year_id,
    semester_id,
    section,
    status,
  } = req.body || {};

  const courseId = Number(course_id);
  const academicYearId = academic_year_id
    ? Number(academic_year_id)
    : null;
  const semesterId = semester_id ? Number(semester_id) : null;
  const normalizedSection = section
    ? String(section).trim().slice(0, 30)
    : null;
  const normalizedStatus = status === "Inactive" ? "Inactive" : "Active";

  if (
    !Number.isInteger(teacherId) ||
    teacherId <= 0 ||
    !Number.isInteger(courseId) ||
    courseId <= 0
  ) {
    return res.status(400).json({
      error: "Valid teacher id and course_id are required",
    });
  }

  db.query(
    "SELECT id FROM teachers WHERE id = ?",
    [teacherId],
    (tErr, tRows) => {
      if (tErr) {
        console.error(tErr);

        return res.status(500).json({
          error: "Database error",
        });
      }

      if (!tRows.length) {
        return res.status(404).json({
          error: "Teacher not found",
        });
      }

      db.query(
        "SELECT id FROM courses WHERE id = ?",
        [courseId],
        (cErr, cRows) => {
          if (cErr) {
            console.error(cErr);

            return res.status(500).json({
              error: "Database error",
            });
          }

          if (!cRows.length) {
            return res.status(404).json({
              error: "Course not found",
            });
          }

          db.query(
            `INSERT INTO teacher_courses
              (teacher_id, course_id, academic_year_id, semester_id, section, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              teacherId,
              courseId,
              academicYearId,
              semesterId,
              normalizedSection,
              normalizedStatus,
            ],
            (insErr, result) => {
              if (insErr) {
                console.error(insErr);

                if (insErr.code === "ER_NO_REFERENCED_ROW_2") {
                  return res.status(400).json({
                    error: "Invalid academic_year_id or semester_id",
                  });
                }

                return res.status(500).json({
                  error: "Could not assign course to teacher",
                });
              }

              writeAuditLog(req, {
                action: "TEACHER_COURSE_ASSIGNED",
                entityType: "teacher_course_assignment",
                entityId: result.insertId,
                newValues: {
                  teacherId,
                  courseId,
                  academicYearId,
                  semesterId,
                  section: normalizedSection,
                  status: normalizedStatus,
                },
              });

              return res.status(201).json({
                success: true,
                id: result.insertId,
                teacher_id: teacherId,
                course_id: courseId,
                academic_year_id: academicYearId,
                semester_id: semesterId,
                section: normalizedSection,
                status: normalizedStatus,
              });
            }
          );
        }
      );
    }
  );
}

function updateTeacherCourseAssignment(req, res) {
  const assignmentId = Number(req.params.assignmentId);
  const { section, status } = req.body || {};

  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({
      error: "Valid assignmentId is required",
    });
  }

  const normalizedSection =
    section === undefined || section === null
      ? null
      : String(section).trim().slice(0, 30) || null;

  const normalizedStatus = status === "Inactive" ? "Inactive" : "Active";

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
        `UPDATE teacher_courses
         SET section = ?, status = ?
         WHERE id = ?`,
        [normalizedSection, normalizedStatus, assignmentId],
        (err, result) => {
          if (err) {
            console.error("Failed to update course assignment:", err);

            return res.status(500).json({
              error: "Could not update course assignment",
            });
          }

          if (!result.affectedRows) {
            return res.status(404).json({
              error: "Course assignment not found",
            });
          }

          writeAuditLog(req, {
            action: "TEACHER_COURSE_ASSIGNMENT_UPDATED",
            entityType: "teacher_course_assignment",
            entityId: assignmentId,
            oldValues: oldAssignment,
            newValues: {
              section: normalizedSection,
              status: normalizedStatus,
            },
          });

          return res.json({
            success: true,
            id: assignmentId,
            section: normalizedSection,
            status: normalizedStatus,
          });
        }
      );
    }
  );
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
        "DELETE FROM teacher_courses WHERE id = ?",
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

module.exports = {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherCourseAssignments,
  assignCourseToTeacher,
  updateTeacherCourseAssignment,
  deleteTeacherCourseAssignment,
  getMyTeacherProfile,
  getMyTeacherCourses,
  getMyTeacherStudents,
  getMyTeacherTimetable,
};
