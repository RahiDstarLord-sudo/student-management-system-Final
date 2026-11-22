
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

function gradeForPercentage(value) {
  const percentage = Number(value) || 0;
  return GRADE_SCALE.find((item) => percentage >= item.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
}

function ensurePublicationTable(callback) {
  db.query(
    `CREATE TABLE IF NOT EXISTS exam_result_publications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      examination_id INT NOT NULL UNIQUE,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      published_by INT NULL,
      published_at DATETIME NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_exam_result_publication_exam FOREIGN KEY (examination_id)
        REFERENCES examinations(id) ON DELETE CASCADE ON UPDATE CASCADE,
      INDEX idx_exam_result_publication_status (is_published)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    callback
  );
}

function getExamSummary(req, res) {
  const examinationId = Number(req.query.examinationId);

  if (!Number.isInteger(examinationId) || examinationId < 1) {
    return res.status(400).json({ error: "A valid examination is required" });
  }

  ensurePublicationTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({
        error: "Could not prepare result publication data",
      });
    }

    db.query(
      `SELECT ec.id AS exam_course_id, ec.examination_id, ec.max_marks, ec.pass_marks,
              c.course_code, c.course_name, c.credits,
              er.id AS result_id, er.student_id, s.name AS student_name, er.marks,
              COALESCE(p.is_published, 0) AS is_published, p.published_at
       FROM exam_courses ec
       INNER JOIN courses c ON c.id = ec.course_id
       LEFT JOIN exam_results er ON er.exam_course_id = ec.id
       LEFT JOIN students s ON s.student_id = er.student_id
       LEFT JOIN exam_result_publications p ON p.examination_id = ec.examination_id
       WHERE ec.examination_id = ?
       ORDER BY c.course_code ASC, s.name ASC`,
      [examinationId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            error: "Could not calculate examination results",
          });
        }

        const publication = rows.find((row) => row.is_published !== undefined);

        const results = rows
          .filter((row) => row.result_id !== null)
          .map((row) => {
            const percentage =
              Number(row.max_marks) > 0
                ? (Number(row.marks) / Number(row.max_marks)) * 100
                : 0;

            const grade = gradeForPercentage(percentage);

            const passPercentage =
              Number(row.max_marks) > 0
                ? (Number(row.pass_marks) / Number(row.max_marks)) * 100
                : 0;

            return {
              exam_course_id: Number(row.exam_course_id),
              student_id: row.student_id,
              student_name: row.student_name,
              course_code: row.course_code,
              course_name: row.course_name,
              credits: Number(row.credits) || 0,
              marks: Number(row.marks),
              max_marks: Number(row.max_marks),
              percentage: Number(percentage.toFixed(2)),
              grade: grade.grade,
              point: grade.point,
              status: percentage >= passPercentage ? "Pass" : "Fail",
            };
          });

        res.json({
          examinationId,
          isPublished: Boolean(publication && Number(publication.is_published)),
          publishedAt: publication ? publication.published_at : null,
          results,
        });
      }
    );
  });
}

function setExamResultsPublished(req, res) {
  const examinationId = Number(req.body?.examinationId);
  const published = req.body?.published === true;

  if (
    !Number.isInteger(examinationId) ||
    examinationId < 1 ||
    typeof req.body?.published !== "boolean"
  ) {
    return res.status(400).json({
      error: "Provide a valid examination and publication status",
    });
  }

  ensurePublicationTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({
        error: "Could not prepare result publication data",
      });
    }

    db.query(
      `SELECT COUNT(DISTINCT ec.id) AS assigned_courses,
              COUNT(DISTINCT CASE WHEN er.id IS NOT NULL THEN ec.id END) AS marked_courses
       FROM exam_courses ec
       LEFT JOIN exam_results er ON er.exam_course_id = ec.id
       WHERE ec.examination_id = ?`,
      [examinationId],
      (checkErr, rows) => {
        if (checkErr) {
          return res.status(500).json({
            error: "Could not validate examination results",
          });
        }

        const counts = rows[0] || {};

        if (
          published &&
          (!Number(counts.assigned_courses) ||
            Number(counts.assigned_courses) !== Number(counts.marked_courses))
        ) {
          return res.status(400).json({
            error: "Enter marks for at least one student in every assigned course before publishing results.",
          });
        }

        // Read the previous publication state before updating it.
        db.query(
          `SELECT id, is_published, published_by, published_at
           FROM exam_result_publications
           WHERE examination_id = ?
           LIMIT 1`,
          [examinationId],
          (oldErr, oldRows) => {
            if (oldErr) {
              return res.status(500).json({
                error: "Could not check previous result publication status",
              });
            }

            const oldPublication = oldRows.length ? oldRows[0] : null;

            db.query(
              `INSERT INTO exam_result_publications (examination_id, is_published, published_by, published_at)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE is_published = VALUES(is_published),
                 published_by = VALUES(published_by), published_at = VALUES(published_at)`,
              [
                examinationId,
                published ? 1 : 0,
                published ? (req.user?.id || null) : null,
                published ? new Date() : null,
              ],
              (saveErr) => {
                if (saveErr) {
                  return res.status(500).json({
                    error: "Could not update result publication status",
                  });
                }

                writeAuditLog(req, {
                  action: published
                    ? "EXAM_RESULTS_PUBLISHED"
                    : "EXAM_RESULTS_UNPUBLISHED",
                  entityType: "exam_result_publication",
                  entityId: oldPublication
                    ? oldPublication.id
                    : examinationId,
                  oldValues: oldPublication
                    ? {
                        examinationId,
                        isPublished: Boolean(Number(oldPublication.is_published)),
                        publishedBy: oldPublication.published_by,
                        publishedAt: oldPublication.published_at,
                      }
                    : null,
                  newValues: {
                    examinationId,
                    isPublished: published,
                    publishedBy: published ? (req.user?.id || null) : null,
                  },
                });

                res.json({
                  success: true,
                  isPublished: published,
                  message: published
                    ? "Results published successfully"
                    : "Results unpublished successfully",
                });
              }
            );
          }
        );
      }
    );
  });
}

function getStudentExamHistory(req, res) {
  const studentId = String(req.params.studentId || "").trim();

  if (!studentId) {
    return res.status(400).json({ error: "A student ID is required" });
  }

  ensurePublicationTable((tableErr) => {
    if (tableErr) {
      return res.status(500).json({
        error: "Could not prepare result history",
      });
    }

    db.query(
      `SELECT e.id AS examination_id, e.name AS examination_name, e.exam_type, e.academic_year,
              e.start_date, ec.id AS exam_course_id, c.course_code, c.course_name, c.credits,
              ec.max_marks, ec.pass_marks, er.marks, p.published_at
       FROM exam_result_publications p
       INNER JOIN examinations e ON e.id = p.examination_id
       INNER JOIN exam_courses ec ON ec.examination_id = e.id
       INNER JOIN courses c ON c.id = ec.course_id
       INNER JOIN exam_results er ON er.exam_course_id = ec.id
       WHERE p.is_published = 1 AND er.student_id = ?
       ORDER BY e.start_date DESC, e.id DESC, c.course_code ASC`,
      [studentId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            error: "Could not load student result history",
          });
        }

        res.json(
          rows.map((row) => {
            const percentage =
              Number(row.max_marks) > 0
                ? (Number(row.marks) / Number(row.max_marks)) * 100
                : 0;

            const grade = gradeForPercentage(percentage);

            const passPercentage =
              Number(row.max_marks) > 0
                ? (Number(row.pass_marks) / Number(row.max_marks)) * 100
                : 0;

            return {
              ...row,
              credits: Number(row.credits) || 0,
              marks: Number(row.marks),
              max_marks: Number(row.max_marks),
              percentage: Number(percentage.toFixed(2)),
              grade: grade.grade,
              point: grade.point,
              status: percentage >= passPercentage ? "Pass" : "Fail",
            };
          })
        );
      }
    );
  });
}

module.exports = {
  getExamSummary,
  setExamResultsPublished,
  getStudentExamHistory,
};
