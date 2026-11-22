
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function getMarksSetup(req, res) {
  db.query(
    `SELECT id, name, academic_year, status FROM examinations ORDER BY start_date DESC, id DESC`,
    (examErr, examinations) => {
      if (examErr) return res.status(500).json({ error: "Could not load examinations" });
      db.query(
        `SELECT ec.id AS exam_course_id, ec.examination_id, ec.max_marks, ec.pass_marks,
                c.id AS course_id, c.course_code, c.course_name
         FROM exam_courses ec
         INNER JOIN courses c ON c.id = ec.course_id
         ORDER BY c.course_code ASC`,
        (courseErr, examCourses) => {
          if (courseErr) return res.status(500).json({ error: "Could not load examination courses" });
          res.json({ examinations, examCourses });
        }
      );
    }
  );
}

function getExamCourseMarks(req, res) {
  const examCourseId = Number(req.query.examCourseId);
  if (!Number.isInteger(examCourseId) || examCourseId < 1) {
    return res.status(400).json({ error: "A valid examination course is required" });
  }
  db.query(
    `SELECT er.id, er.student_id, s.name AS student_name, er.marks
     FROM exam_results er
     INNER JOIN students s ON s.student_id = er.student_id
     WHERE er.exam_course_id = ?
     ORDER BY s.name ASC`,
    [examCourseId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Could not load saved examination marks" });
      res.json(rows);
    }
  );
}

function saveExamCourseMark(req, res) {
  const examCourseId = Number(req.body?.examCourseId);
  const studentId = String(req.body?.studentId || "").trim();
  const marks = Number(req.body?.marks);

  if (!Number.isInteger(examCourseId) || examCourseId < 1 || !studentId || !Number.isFinite(marks) || marks < 0) {
    return res.status(400).json({ error: "Please provide a valid course, student and marks value" });
  }

  db.query(
    `SELECT id, max_marks FROM exam_courses WHERE id = ?`,
    [examCourseId],
    (courseErr, courses) => {
      if (courseErr) return res.status(500).json({ error: "Could not validate examination course" });
      if (!courses.length) return res.status(404).json({ error: "Examination course not found" });
      if (marks > Number(courses[0].max_marks)) return res.status(400).json({ error: `Marks cannot exceed ${courses[0].max_marks}` });

      db.query(
        `SELECT student_id FROM students WHERE student_id = ?`,
        [studentId],
        (studentErr, students) => {
          if (studentErr) return res.status(500).json({ error: "Could not validate student" });
          if (!students.length) return res.status(404).json({ error: "Student not found" });

          db.query(
            `SELECT id, marks FROM exam_results
             WHERE exam_course_id = ? AND student_id = ?`,
            [examCourseId, studentId],
            (oldErr, oldRows) => {
              if (oldErr) {
                return res.status(500).json({
                  error: "Could not check existing examination marks",
                });
              }

              const oldMark = oldRows.length ? oldRows[0] : null;

              db.query(
                `INSERT INTO exam_results (exam_course_id, student_id, marks, entered_by)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks = VALUES(marks), entered_by = VALUES(entered_by), updated_at = CURRENT_TIMESTAMP`,
                [examCourseId, studentId, marks, req.user?.id || null],
                (saveErr) => {
                  if (saveErr) {
                    return res.status(500).json({
                      error: "Could not save examination marks",
                    });
                  }

                  writeAuditLog(req, {
                    action: oldMark ? "EXAM_MARK_UPDATED" : "EXAM_MARK_CREATED",
                    entityType: "exam_result",
                    entityId: oldMark
                      ? oldMark.id
                      : `${examCourseId}:${studentId}`,
                    oldValues: oldMark
                      ? {
                          examCourseId,
                          studentId,
                          marks: oldMark.marks,
                        }
                      : null,
                    newValues: {
                      examCourseId,
                      studentId,
                      marks,
                    },
                  });

                  res.json({
                    success: true,
                    message: "Examination marks saved successfully",
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

module.exports = { getMarksSetup, getExamCourseMarks, saveExamCourseMark };
