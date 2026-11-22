
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

function getResultGrade(marks) {
  return GRADE_SCALE.find((item) => marks >= item.min);
}

// Staff: Get all results
function getAllResults(req, res) {
  db.query(
    `SELECT r.*, s.name AS student_name
     FROM results r
     JOIN students s ON s.student_id = r.student_id
     ORDER BY r.semester DESC, s.name ASC`,
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Could not load results" });
      }

      res.json(
        rows.map((row) => ({
          ...row,
          grade: getResultGrade(Number(row.marks)).grade,
          point: getResultGrade(Number(row.marks)).point,
        }))
      );
    }
  );
}

// Staff: Save or update a result
function saveResult(req, res) {
  const { studentId, courseCode, courseName, semester, credit, marks } =
    req.body || {};

  const numericCredit = Number(credit);
  const numericMarks = Number(marks);

  if (
    !studentId ||
    !courseCode ||
    !courseName ||
    !semester ||
    !Number.isFinite(numericCredit) ||
    numericCredit <= 0 ||
    !Number.isFinite(numericMarks) ||
    numericMarks < 0 ||
    numericMarks > 100
  ) {
    return res.status(400).json({
      error: "Please provide valid result information",
    });
  }

  const cleanStudentId = String(studentId).trim();
  const cleanCourseCode = String(courseCode).trim();
  const cleanCourseName = String(courseName).trim();
  const cleanSemester = String(semester).trim();

  db.query(
    `SELECT student_id FROM students WHERE student_id = ?`,
    [cleanStudentId],
    (checkErr, students) => {
      if (checkErr) {
        console.error(checkErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (students.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }

      db.query(
        `SELECT id, marks, course_name, credit
         FROM results
         WHERE student_id = ? AND course_code = ? AND semester = ?
         LIMIT 1`,
        [cleanStudentId, cleanCourseCode, cleanSemester],
        (oldErr, oldRows) => {
          if (oldErr) {
            console.error(oldErr);
            return res.status(500).json({
              error: "Could not check existing result",
            });
          }

          const oldResult = oldRows[0] || null;

          db.query(
            `INSERT INTO results
              (student_id, course_code, course_name, semester, credit, marks)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              course_name = VALUES(course_name),
              credit = VALUES(credit),
              marks = VALUES(marks)`,
            [
              cleanStudentId,
              cleanCourseCode,
              cleanCourseName,
              cleanSemester,
              numericCredit,
              numericMarks,
            ],
            (err) => {
              if (err) {
                console.error(err);
                return res.status(500).json({
                  error: "Could not save result",
                });
              }

              const result = getResultGrade(numericMarks);

              writeAuditLog(req, {
                action: oldResult ? "RESULT_UPDATED" : "RESULT_CREATED",
                entityType: "result",
                entityId: oldResult
                  ? oldResult.id
                  : `${cleanStudentId}:${cleanCourseCode}:${cleanSemester}`,
                oldValues: oldResult
                  ? {
                      studentId: cleanStudentId,
                      courseCode: cleanCourseCode,
                      semester: cleanSemester,
                      courseName: oldResult.course_name,
                      credit: oldResult.credit,
                      marks: oldResult.marks,
                    }
                  : null,
                newValues: {
                  studentId: cleanStudentId,
                  courseCode: cleanCourseCode,
                  semester: cleanSemester,
                  courseName: cleanCourseName,
                  credit: numericCredit,
                  marks: numericMarks,
                },
              });

              return res.json({
                success: true,
                message: "Result saved successfully",
                grade: result.grade,
                point: result.point,
              });
            }
          );
        }
      );
    }
  );
}

// Student: Get only their own results
function getMyResults(req, res) {
  db.query(
    `SELECT course_code AS courseCode,
            course_name AS courseName,
            semester,
            credit,
            marks
     FROM results
     WHERE student_id = ?
     ORDER BY semester ASC, course_code ASC`,
    [req.user.studentId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: "Could not load your results",
        });
      }

      res.json(
        rows.map((row) => ({
          ...row,
          credit: Number(row.credit),
          marks: Number(row.marks),
          ...getResultGrade(Number(row.marks)),
        }))
      );
    }
  );
}

module.exports = {
  getAllResults,
  saveResult,
  getMyResults,
};
