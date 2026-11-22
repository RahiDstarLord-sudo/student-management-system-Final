const db = require("../config/db");
const { isRealDate } = require("../utils/dateUtils");
const { writeAuditLog } = require("../utils/auditLogger");

const ATTENDANCE_STATUSES = ["Present", "Absent", "Late"];

function getMyAttendance(req, res) {
  const month = String(req.query.month || "");

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Month must use YYYY-MM format" });
  }

  db.query(
    `SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date, status
     FROM attendance_records
     WHERE student_id = ? AND DATE_FORMAT(attendance_date, '%Y-%m') = ?
     ORDER BY attendance_date ASC`,
    [req.user.studentId, month],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows);
    }
  );
}

function getAttendanceByDate(req, res) {
  const date = String(req.query.date || "");

  if (!isRealDate(date)) {
    return res.status(400).json({
      error: "A valid date is required (YYYY-MM-DD)",
    });
  }

  db.query(
    `SELECT s.student_id AS studentId, s.name, s.email, s.course,
            a.status
     FROM students s
     LEFT JOIN attendance_records a
       ON a.student_id = s.student_id AND a.attendance_date = ?
     ORDER BY s.name ASC`,
    [date],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows);
    }
  );
}

function saveAttendance(req, res) {
  const { date, records } = req.body || {};

  if (!isRealDate(date) || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      error: "A valid date and attendance records are required",
    });
  }

  const seen = new Set();

  for (const record of records) {
    if (
      !record ||
      typeof record.studentId !== "string" ||
      !record.studentId.trim() ||
      !ATTENDANCE_STATUSES.includes(record.status) ||
      seen.has(record.studentId)
    ) {
      return res.status(400).json({
        error: "Each student must have one valid attendance status",
      });
    }

    seen.add(record.studentId);
  }

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) {
      console.error(connectionErr);
      return res.status(500).json({ error: "Database connection error" });
    }

    connection.query(
      "SELECT student_id FROM students WHERE student_id IN (?)",
      [Array.from(seen)],
      (checkErr, foundStudents) => {
        if (checkErr || foundStudents.length !== seen.size) {
          connection.release();

          if (checkErr) console.error(checkErr);

          return res.status(checkErr ? 500 : 400).json({
            error: checkErr
              ? "Could not validate students"
              : "One or more student records were not found",
          });
        }

        connection.beginTransaction((beginErr) => {
          if (beginErr) {
            connection.release();
            console.error(beginErr);
            return res.status(500).json({
              error: "Could not start attendance save",
            });
          }

          const saveNext = (index) => {
            if (index >= records.length) {
              return connection.commit((commitErr) => {
                if (commitErr) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error(commitErr);
                    res.status(500).json({
                      error: "Could not save attendance",
                    });
                  });
                }

                connection.release();
                res.json({ success: true, saved: records.length });
              });
            }

            const record = records[index];

            connection.query(
              `INSERT INTO attendance_records (student_id, attendance_date, status)
               SELECT student_id, ?, ? FROM students WHERE student_id = ?
               ON DUPLICATE KEY UPDATE status = VALUES(status)`,
              [date, record.status, record.studentId],
              (saveErr) => {
                if (saveErr) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error(saveErr);
                    res.status(500).json({
                      error: "Database error while saving attendance",
                    });
                  });
                }

                saveNext(index + 1);
              }
            );
          };

          saveNext(0);
        });
      }
    );
  });
}


// Teacher attendance is scoped to one active teacher-course assignment.
// Each saved attendance record is linked to an attendance_sessions row, so
// the same student can have separate attendance for different courses.

function getTeacherAttendance(req, res) {
  const date = String(req.query.date || "");
  const teacherCourseId = Number(req.query.teacherCourseId);

  if (!isRealDate(date) || !Number.isInteger(teacherCourseId) || teacherCourseId < 1) {
    return res.status(400).json({
      error: "A valid date and assigned course are required",
    });
  }

  db.query(
    `SELECT DISTINCT
            s.student_id AS studentId,
            s.name,
            s.email,
            s.course,
            s.year,
            s.status AS studentStatus,
            a.status AS attendanceStatus,
            c.id AS courseId,
            c.course_code,
            c.course_name,
            tc.id AS assignmentId,
            tc.section,
            (SELECT ses.id
               FROM attendance_sessions ses
              WHERE ses.teacher_course_id = tc.id
                AND ses.attendance_date = ?
              ORDER BY ses.id DESC LIMIT 1) AS attendanceSessionId
     FROM teacher_courses tc
     INNER JOIN courses c ON c.id = tc.course_id
     INNER JOIN course_selections cs
       ON cs.course_id = tc.course_id
      AND cs.academic_year_id = tc.academic_year_id
      AND cs.semester_id = tc.semester_id
      AND cs.selection_status = 'Selected'
     INNER JOIN student_enrollments se
       ON se.student_id = cs.student_id
      AND se.academic_year_id = tc.academic_year_id
      AND se.semester_id = tc.semester_id
      AND se.status = 'Active'
     INNER JOIN students s
       ON s.student_id = cs.student_id
      AND s.status = 'Active'
     LEFT JOIN attendance_records a
       ON a.student_id = s.student_id
      AND (
        a.attendance_session_id = (
          SELECT ses2.id
          FROM attendance_sessions ses2
          WHERE ses2.teacher_course_id = tc.id
            AND ses2.attendance_date = ?
          ORDER BY ses2.id DESC LIMIT 1
        )
        OR (
          a.attendance_session_id IS NULL
          AND a.attendance_date = ?
        )
      )
     WHERE tc.id = ?
       AND tc.teacher_id = ?
       AND tc.status = 'Active'
     ORDER BY s.name ASC`,
    [date, date, date, teacherCourseId, req.teacher.id],
    (err, rows) => {
      if (err) {
        console.error("Teacher attendance load error:", err);
        return res.status(500).json({
          error: "Could not load attendance for this assigned course",
        });
      }

      return res.json(rows);
    }
  );
}


function saveTeacherAttendance(req, res) {
  const { date, records } = req.body || {};
  const teacherCourseId = Number(req.body?.teacherCourseId);

  if (
    !isRealDate(date) ||
    !Number.isInteger(teacherCourseId) || teacherCourseId < 1 ||
    !Array.isArray(records) || records.length === 0
  ) {
    return res.status(400).json({ error: "A valid date, assigned course and attendance records are required" });
  }

  const seen = new Set();
  for (const record of records) {
    if (
      !record || typeof record.studentId !== "string" || !record.studentId.trim() ||
      !ATTENDANCE_STATUSES.includes(record.status) || seen.has(record.studentId)
    ) {
      return res.status(400).json({ error: "Each student must have one valid attendance status" });
    }
    seen.add(record.studentId);
  }

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) {
      console.error(connectionErr);
      return res.status(500).json({ error: "Database connection error" });
    }

    // Confirm that the selected assignment belongs to this teacher and that
    // every submitted student belongs to this exact course assignment.
    connection.query(
      `SELECT DISTINCT s.student_id
       FROM teacher_courses tc
       INNER JOIN course_selections cs
         ON cs.course_id = tc.course_id
       AND cs.academic_year_id = tc.academic_year_id
       AND cs.semester_id = tc.semester_id
       AND cs.selection_status = 'Selected'
      INNER JOIN student_enrollments se
        ON se.student_id = cs.student_id
       AND se.academic_year_id = tc.academic_year_id
       AND se.semester_id = tc.semester_id
       AND se.status = 'Active'
      INNER JOIN students s
        ON s.student_id = cs.student_id
       AND s.status = 'Active'
      WHERE tc.id = ?
       AND tc.teacher_id = ?
       AND tc.status = 'Active'
       AND s.student_id IN (?)`
      [teacherCourseId, req.teacher.id, Array.from(seen)],
      (checkErr, foundRows) => {
        if (checkErr || foundRows.length !== seen.size) {
          connection.release();
          if (checkErr) console.error("Teacher attendance permission check error:", checkErr);
          return res.status(checkErr ? 500 : 403).json({
            error: checkErr
              ? "Could not validate students for this course"
              : "You can only record attendance for students in the selected assigned course",
          });
        }

        connection.beginTransaction((beginErr) => {
          if (beginErr) {
            connection.release();
            console.error(beginErr);
            return res.status(500).json({ error: "Could not start attendance save" });
          }

          const rollbackWithError = (err, message) => connection.rollback(() => {
            connection.release();
            if (err) console.error(err);
            res.status(500).json({ error: message });
          });

          connection.query(
            `SELECT id FROM attendance_sessions
              WHERE teacher_course_id = ? AND attendance_date = ?
              ORDER BY id DESC LIMIT 1 FOR UPDATE`,
            [teacherCourseId, date],
            (sessionErr, sessionRows) => {
              if (sessionErr) return rollbackWithError(sessionErr, "Could not prepare attendance session");

              const continueWithSession = (sessionId) => {
                const saveNext = (index) => {
                  if (index >= records.length) {
                    return connection.query(
                      "UPDATE attendance_sessions SET status = 'Completed' WHERE id = ?",
                      [sessionId],
                      (updateSessionErr) => {
                        if (updateSessionErr) return rollbackWithError(updateSessionErr, "Could not complete attendance session");
                        connection.commit((commitErr) => {
                          if (commitErr) return rollbackWithError(commitErr, "Could not save attendance");
                          connection.release();
                          return res.json({ success: true, saved: records.length, attendanceSessionId: sessionId });
                        });
                      }
                    );
                  }

                  const record = records[index];
                  connection.query(
                    `SELECT id FROM attendance_records
                      WHERE student_id = ? AND attendance_session_id = ?
                      ORDER BY id DESC LIMIT 1`,
                    [record.studentId, sessionId],
                    (recordErr, existingRows) => {
                      if (recordErr) return rollbackWithError(recordErr, "Could not check existing attendance");

                      const finishRecord = (saveErr) => {
                        if (saveErr) return rollbackWithError(saveErr, "Database error while saving course attendance");
                        saveNext(index + 1);
                      };

                      if (existingRows.length) {
                        connection.query(
                          "UPDATE attendance_records SET attendance_date = ?, status = ? WHERE id = ?",
                          [date, record.status, existingRows[0].id],
                          finishRecord
                        );
                      } else {
                        connection.query(
                          `INSERT INTO attendance_records
                             (student_id, attendance_session_id, attendance_date, status)
                           VALUES (?, ?, ?, ?)`,
                          [record.studentId, sessionId, date, record.status],
                          finishRecord
                        );
                      }
                    }
                  );
                };
                saveNext(0);
              };

              if (sessionRows.length) {
                return continueWithSession(sessionRows[0].id);
              }

              connection.query(
                `INSERT INTO attendance_sessions
                   (teacher_course_id, attendance_date, status, created_by)
                 VALUES (?, ?, 'Scheduled', ?)`,
                [teacherCourseId, date, req.user.id],
                (insertErr, insertResult) => {
                  if (insertErr) return rollbackWithError(insertErr, "Could not create attendance session");
                  continueWithSession(insertResult.insertId);
                }
              );
            }
          );
        });
      }
    );
  });
}


function getAttendanceReport(req, res) {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!isRealDate(from) || !isRealDate(to) || from > to) {
    return res.status(400).json({ error: "A valid date range is required" });
  }

  db.query(
    `SELECT tc.id AS assignmentId,
            c.course_name AS courseName,
            c.course_code AS courseCode,
            t.name AS teacherName,
            tc.section,
            SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) AS late,
            COUNT(ar.id) AS total,
            ROUND(100 * SUM(CASE WHEN ar.status IN ('Present', 'Late') THEN 1 ELSE 0 END) / NULLIF(COUNT(ar.id), 0), 1) AS attendancePercentage
       FROM attendance_sessions ses
       INNER JOIN teacher_courses tc ON tc.id = ses.teacher_course_id
       INNER JOIN courses c ON c.id = tc.course_id
       LEFT JOIN teachers t ON t.id = tc.teacher_id
       LEFT JOIN attendance_records ar ON ar.attendance_session_id = ses.id
      WHERE ses.attendance_date BETWEEN ? AND ?
      GROUP BY tc.id, c.course_name, c.course_code, t.name, tc.section
      ORDER BY c.course_name ASC, t.name ASC`,
    [from, to],
    (err, rows) => {
      if (err) {
        console.error("Attendance report error:", err);
        return res.status(500).json({ error: "Could not generate attendance report" });
      }
      return res.json(rows);
    }
  );
}

module.exports = {
  getMyAttendance,
  getAttendanceByDate,
  getAttendanceReport,
  saveAttendance,
  getTeacherAttendance,
  saveTeacherAttendance,
};