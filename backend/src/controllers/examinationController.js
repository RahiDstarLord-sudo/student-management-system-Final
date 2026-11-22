
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const VALID_EXAM_TYPES = [
  "Midterm",
  "Final",
  "Quiz",
  "Practical",
  "Supplementary",
];

const VALID_EXAM_STATUSES = [
  "Upcoming",
  "Ongoing",
  "Completed",
  "Cancelled",
];

function validDateRange(start, end) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(end || "")) &&
    start <= end
  );
}

function validateExamination(body) {
  const {
    name,
    exam_type,
    academic_year,
    start_date,
    end_date,
    status,
  } = body || {};

  if (
    !String(name || "").trim() ||
    String(name).length > 150 ||
    !String(academic_year || "").trim() ||
    String(academic_year).length > 30 ||
    !VALID_EXAM_TYPES.includes(exam_type) ||
    !VALID_EXAM_STATUSES.includes(status) ||
    !validDateRange(start_date, end_date)
  ) {
    return false;
  }

  return true;
}

function getExaminations(req, res) {
  db.query(
    "SELECT * FROM examinations ORDER BY start_date DESC, id DESC",
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: "Could not load examinations",
        });
      }

      res.json(rows);
    }
  );
}

function createExamination(req, res) {
  const {
    name,
    exam_type,
    academic_year,
    start_date,
    end_date,
    status,
  } = req.body || {};

  if (!validateExamination(req.body)) {
    return res.status(400).json({
      error: "Please provide valid examination details and dates.",
    });
  }

  db.query(
    `INSERT INTO examinations
      (name, exam_type, academic_year, start_date, end_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      exam_type,
      academic_year.trim(),
      start_date,
      end_date,
      status,
      req.user.id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          error: "Could not create examination",
        });
      }
      
        writeAuditLog(req, {
          action: "EXAMINATION_CREATED",
          entityType: "examination",
          entityId: result.insertId,
          newValues: {
            name: name.trim(),
            exam_type,
            academic_year: academic_year.trim(),
            start_date,
            end_date,
            status,
          },
        });

        writeAuditLog(req, {
          action: "EXAMINATION_UPDATED",
          entityType: "examination",
          entityId: req.params.id,
          newValues: {
            name: name.trim(),
            exam_type,
            academic_year: academic_year.trim(),
            start_date,
            end_date,
            status,
          },
        });

      db.query(
        "SELECT * FROM examinations WHERE id = ?",
        [result.insertId],
        (readErr, rows) => {
          if (readErr) {
            return res.status(500).json({
              error: "Examination created, but could not reload it",
            });
          }

          res.status(201).json(rows[0]);
        }
      );
    }
  );
}

function updateExamination(req, res) {
  const {
    name,
    exam_type,
    academic_year,
    start_date,
    end_date,
    status,
  } = req.body || {};

  if (!validateExamination(req.body)) {
    return res.status(400).json({
      error: "Please provide valid examination details and dates.",
    });
  }

  db.query(
    `UPDATE examinations
     SET name=?, exam_type=?, academic_year=?, start_date=?, end_date=?, status=?
     WHERE id=?`,
    [
      name.trim(),
      exam_type,
      academic_year.trim(),
      start_date,
      end_date,
      status,
      req.params.id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          error: "Could not update examination",
        });
      }

      if (!result.affectedRows) {
        return res.status(404).json({
          error: "Examination not found",
        });
      }

      db.query(
        "SELECT * FROM examinations WHERE id=?",
        [req.params.id],
        (readErr, rows) => {
          if (readErr) {
            return res.status(500).json({
              error: "Could not reload examination",
            });
          }

          res.json(rows[0]);
        }
      );
    }
  );
}

function deleteExamination(req, res) {
  db.query(
    "DELETE FROM examinations WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          error: "Could not delete examination",
        });
      }

      if (!result.affectedRows) {
        return res.status(404).json({
          error: "Examination not found",
        });
      }
      writeAuditLog(req, {
        action: "EXAMINATION_DELETED",
        entityType: "examination",
        entityId: req.params.id,
      });

      res.json({ success: true });
    }
  );
}


function getExaminationCourses(req, res) {
  db.query(
    `SELECT ec.id AS exam_course_id, ec.examination_id, ec.course_id,
            ec.max_marks, ec.pass_marks, c.course_code, c.course_name, c.credits
     FROM exam_courses ec
     JOIN courses c ON c.id = ec.course_id
     WHERE ec.examination_id = ?
     ORDER BY c.course_code`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error("Examination courses error:", err);
        return res.status(500).json({ error: "Could not load examination courses" });
      }
      res.json(rows);
    }
  );
}


function assignCourseToExamination(req, res) {
  const examinationId = Number(req.params.id);
  const courseId = Number(req.body?.course_id);
  const maxMarks = Number(req.body?.max_marks);
  const passMarks = Number(req.body?.pass_marks);
  if (!Number.isInteger(examinationId) || examinationId < 1 || !Number.isInteger(courseId) || courseId < 1 ||
      !Number.isFinite(maxMarks) || maxMarks <= 0 || !Number.isFinite(passMarks) || passMarks < 0 || passMarks > maxMarks) {
    return res.status(400).json({ error: "Enter a valid course, maximum marks and pass marks." });
  }
  db.query(
    `INSERT INTO exam_courses (examination_id, course_id, max_marks, pass_marks)
     VALUES (?, ?, ?, ?)`,
    [examinationId, courseId, maxMarks, passMarks],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This course is already assigned to the examination." });
        if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(404).json({ error: "Examination or course not found." });
        console.error(err);
        return res.status(500).json({ error: "Could not assign course to examination." });
      }
      writeAuditLog(req, {
        action: "EXAMINATION_COURSE_ASSIGNED",
        entityType: "exam_course",
        entityId: result.insertId,
        newValues: {
          examinationId,
          courseId,
          maxMarks,
          passMarks,
        },
      });
      res.status(201).json({ success: true, id: result.insertId, examination_id: examinationId, course_id: courseId, max_marks: maxMarks, pass_marks: passMarks });
    }
  );
}

function removeCourseFromExamination(req, res) {
  db.query(
    "DELETE FROM exam_courses WHERE examination_id = ? AND course_id = ?",
    [req.params.id, req.params.courseId],
    (err, result) => {
      if (err) {
        if (err.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ error: "Marks or components already exist for this course; it cannot be removed." });
        console.error(err);
        return res.status(500).json({ error: "Could not remove assigned course." });
      }
      if (!result.affectedRows) return res.status(404).json({ error: "Assigned course not found." });
      
      writeAuditLog(req, {
        action: "EXAMINATION_COURSE_REMOVED",
        entityType: "exam_course",
        entityId: `${req.params.id}:${req.params.courseId}`,
        oldValues: {
          examinationId: req.params.id,
          courseId: req.params.courseId,
        },
      });
      res.json({ success: true });
    }
  );
}

module.exports = {
  getExaminations,
  createExamination,
  updateExamination,
  deleteExamination,
  getExaminationCourses,
  assignCourseToExamination,
  removeCourseFromExamination,
};
