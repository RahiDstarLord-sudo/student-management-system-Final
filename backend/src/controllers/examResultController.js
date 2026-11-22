
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const GRADE_SCALE = [
  { min: 80, grade: "A+", point: 5.0 },
  { min: 70, grade: "A", point: 4.0 },
  { min: 60, grade: "A-", point: 3.5 },
  { min: 50, grade: "B", point: 3.0 },
  { min: 40, grade: "C", point: 2.0 },
  { min: 33, grade: "D", point: 1.0 },
  { min: 0, grade: "F", point: 0.0 },
];

const gradeFor = (percentage) =>
  GRADE_SCALE.find((g) => percentage >= g.min);

function getExamCourseStudents(req, res) {
  const examCourseId = Number(req.params.examCourseId);

  if (!Number.isInteger(examCourseId) || examCourseId < 1) {
    return res.status(400).json({ error: "Invalid examination course" });
  }

  db.query(
    `SELECT ec.id AS exam_course_id, ec.examination_id, ec.max_marks, ec.pass_marks,
            c.id AS course_id, c.course_code, c.course_name, c.credits
     FROM exam_courses ec JOIN courses c ON c.id = ec.course_id
     WHERE ec.id = ? LIMIT 1`,
    [examCourseId],
    (err, courses) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Could not load course details" });
      }

      if (!courses.length) {
        return res.status(404).json({ error: "Examination course not found" });
      }

      const course = courses[0];

      db.query(
        `SELECT s.student_id, s.name, s.email, er.marks
         FROM students s
         LEFT JOIN exam_results er
           ON er.student_id = s.student_id AND er.exam_course_id = ?
         WHERE TRIM(s.course) = ? OR TRIM(s.course) = ?
         ORDER BY s.name ASC`,
        [examCourseId, course.course_code, course.course_name],
        (studentErr, students) => {
          if (studentErr) {
            console.error(studentErr);
            return res.status(500).json({
              error: "Could not load students for this course",
            });
          }

          res.json({ course, students });
        }
      );
    }
  );
}

function saveExamCourseResults(req, res) {
  const examCourseId = Number(req.params.examCourseId);
  const entries = Array.isArray(req.body?.results) ? req.body.results : [];

  if (!Number.isInteger(examCourseId) || examCourseId < 1 || !entries.length) {
    return res.status(400).json({
      error: "Select a course and enter at least one mark",
    });
  }

  db.query(
    "SELECT id, examination_id, course_id, max_marks FROM exam_courses WHERE id = ? LIMIT 1",
    [examCourseId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Could not verify examination course",
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          error: "Examination course not found",
        });
      }

      const maxMarks = Number(rows[0].max_marks);
      const clean = [];

      for (const entry of entries) {
        const studentId = String(entry.student_id || "").trim();
        const marks = Number(entry.marks);

        if (
          !studentId ||
          !Number.isFinite(marks) ||
          marks < 0 ||
          marks > maxMarks
        ) {
          return res.status(400).json({
            error: `Marks must be between 0 and ${maxMarks}`,
          });
        }

        clean.push([examCourseId, studentId, marks, req.user.id || null]);
      }

      const studentIds = [...new Set(clean.map((entry) => entry[1]))];

      // Load existing marks before saving so create/update can be distinguished.
      db.query(
        `SELECT id, student_id, marks
         FROM exam_results
         WHERE exam_course_id = ? AND student_id IN (?)`,
        [examCourseId, studentIds],
        (oldErr, oldRows) => {
          if (oldErr) {
            console.error(oldErr);
            return res.status(500).json({
              error: "Could not check existing examination results",
            });
          }

          const oldMarksMap = new Map(
            oldRows.map((row) => [String(row.student_id), row])
          );

          const placeholders = clean.map(() => "(?, ?, ?, ?)").join(",");
          const values = clean.flat();

          db.query(
            `INSERT INTO exam_results (exam_course_id, student_id, marks, entered_by)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
               marks = VALUES(marks),
               entered_by = VALUES(entered_by),
               updated_at = CURRENT_TIMESTAMP`,
            values,
            (saveErr) => {
              if (saveErr) {
                console.error(saveErr);
                return res.status(500).json({
                  error: "Could not save examination marks",
                });
              }

              // Write one audit entry for each submitted student.
              for (const entry of clean) {
                const studentId = entry[1];
                const marks = entry[2];
                const oldMark = oldMarksMap.get(String(studentId));

                writeAuditLog(req, {
                  action: oldMark
                    ? "EXAM_RESULT_UPDATED"
                    : "EXAM_RESULT_CREATED",
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
              }

              res.json({
                success: true,
                saved: clean.length,
                message: "Examination marks saved successfully",
              });
            }
          );
        }
      );
    }
  );
}

function getAllExamResults(req, res) {
  db.query(
    `SELECT er.id, er.student_id, s.name AS student_name,
            c.course_code, c.course_name, e.name AS examination_name,
            ec.max_marks, ec.pass_marks, er.marks,
            ROUND((er.marks / ec.max_marks) * 100, 2) AS percentage
     FROM exam_results er
     JOIN exam_courses ec ON ec.id = er.exam_course_id
     JOIN examinations e ON e.id = ec.examination_id
     JOIN courses c ON c.id = ec.course_id
     JOIN students s ON s.student_id = er.student_id
     ORDER BY e.start_date DESC, c.course_code, s.name`,
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Could not load examination results",
        });
      }

      res.json(
        rows.map((row) => {
          const percentage = Number(row.percentage);
          const grade = gradeFor(percentage);

          return {
            ...row,
            percentage,
            marks: Number(row.marks),
            grade: grade.grade,
            point: grade.point,
            result_status:
              Number(row.marks) >= Number(row.pass_marks)
                ? "Pass"
                : "Fail",
          };
        })
      );
    }
  );
}

module.exports = {
  getExamCourseStudents,
  saveExamCourseResults,
  getAllExamResults,
};
