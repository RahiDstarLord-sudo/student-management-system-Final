
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function parseOptionalId(val) {
  if (val === undefined || val === null || val === "") {
    return null;
  }
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : NaN;
}

// Get all courses
function getAllCourses(req, res) {
  const { department_id, semester_id } = req.query || {};
  let sql = `
    SELECT c.id, c.course_code, c.course_name, c.teacher, c.credits,
           c.department_id, d.department_name,
           c.semester_id, s.semester_name, c.created_at
    FROM courses c
    LEFT JOIN departments d ON d.id = c.department_id
    LEFT JOIN semesters s ON s.id = c.semester_id
    WHERE 1 = 1
  `;
  const params = [];

  if (department_id) {
    sql += " AND c.department_id = ?";
    params.push(Number(department_id));
  }

  if (semester_id) {
    sql += " AND c.semester_id = ?";
    params.push(Number(semester_id));
  }

  sql += " ORDER BY c.id ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Courses Error:", err);
      return res.status(500).json({ error: "Failed to fetch courses" });
    }

    res.json(results);
  });
}

// Add a new course
function addCourse(req, res) {
  const { courseCode, courseName, teacher, credits, department_id, departmentId, semester_id, semesterId } = req.body || {};
  const numericCredits = Number(credits);
  const deptId = parseOptionalId(department_id !== undefined ? department_id : departmentId);
  const semId = parseOptionalId(semester_id !== undefined ? semester_id : semesterId);

  if (
    !courseCode?.trim() ||
    !courseName?.trim() ||
    !teacher?.trim() ||
    !Number.isFinite(numericCredits) ||
    numericCredits <= 0 ||
    numericCredits > 99 ||
    Number.isNaN(deptId) ||
    Number.isNaN(semId)
  ) {
    return res.status(400).json({ error: "Please provide valid course information" });
  }

  const newCourse = {
    course_code: courseCode.trim(),
    course_name: courseName.trim(),
    teacher: teacher.trim(),
    credits: numericCredits,
    department_id: deptId,
    semester_id: semId,
  };

  db.query(
    "INSERT INTO courses (course_code, course_name, teacher, credits, department_id, semester_id) VALUES (?, ?, ?, ?, ?, ?)",
    [
      newCourse.course_code,
      newCourse.course_name,
      newCourse.teacher,
      newCourse.credits,
      newCourse.department_id,
      newCourse.semester_id,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Course code already exists" });
        }
        if (err.code === "ER_NO_REFERENCED_ROW_2") {
          return res.status(400).json({ error: "Invalid department_id or semester_id" });
        }
        return res.status(500).json({ error: "Could not add course" });
      }

      writeAuditLog(req, {
        action: "COURSE_CREATED",
        entityType: "course",
        entityId: result.insertId,
        newValues: newCourse,
      });

      res.status(201).json({
        id: result.insertId,
        ...newCourse,
      });
    }
  );
}

// Update an existing course
function updateCourse(req, res) {
  const { courseCode, courseName, teacher, credits, department_id, departmentId, semester_id, semesterId } = req.body || {};
  const numericCredits = Number(credits);
  const deptId = parseOptionalId(department_id !== undefined ? department_id : departmentId);
  const semId = parseOptionalId(semester_id !== undefined ? semester_id : semesterId);

  if (
    !courseCode?.trim() ||
    !courseName?.trim() ||
    !teacher?.trim() ||
    !Number.isFinite(numericCredits) ||
    numericCredits <= 0 ||
    numericCredits > 99 ||
    Number.isNaN(deptId) ||
    Number.isNaN(semId)
  ) {
    return res.status(400).json({ error: "Please provide valid course information" });
  }

  const id = req.params.id;

  db.query(
    `SELECT id, course_code, course_name, teacher, credits, department_id, semester_id
     FROM courses
     WHERE id = ?`,
    [id],
    (findErr, rows) => {
      if (findErr) {
        console.error("Failed to load course before update:", findErr);
        return res.status(500).json({ error: "Could not update course" });
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Course not found" });
      }

      const oldCourse = rows[0];

      const newCourse = {
        course_code: courseCode.trim(),
        course_name: courseName.trim(),
        teacher: teacher.trim(),
        credits: numericCredits,
        department_id: deptId,
        semester_id: semId,
      };

      db.query(
        `UPDATE courses
         SET course_code = ?, course_name = ?, teacher = ?, credits = ?, department_id = ?, semester_id = ?
         WHERE id = ?`,
        [
          newCourse.course_code,
          newCourse.course_name,
          newCourse.teacher,
          newCourse.credits,
          newCourse.department_id,
          newCourse.semester_id,
          id,
        ],
        (err, result) => {
          if (err) {
            console.error(err);
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(409).json({ error: "Course code already exists" });
            }
            if (err.code === "ER_NO_REFERENCED_ROW_2") {
              return res.status(400).json({ error: "Invalid department_id or semester_id" });
            }
            return res.status(500).json({ error: "Could not update course" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Course not found" });
          }

          writeAuditLog(req, {
            action: "COURSE_UPDATED",
            entityType: "course",
            entityId: id,
            oldValues: oldCourse,
            newValues: newCourse,
          });

          res.json({ success: true, message: "Course updated successfully" });
        }
      );
    }
  );
}

// Delete a course
function deleteCourse(req, res) {
  const id = req.params.id;

  db.query(
    `SELECT id, course_code, course_name, teacher, credits, department_id, semester_id
     FROM courses
     WHERE id = ?`,
    [id],
    (findErr, rows) => {
      if (findErr) {
        console.error("Failed to load course before deletion:", findErr);
        return res.status(500).json({ error: "Could not delete course" });
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Course not found" });
      }

      const oldCourse = rows[0];

      db.query(
        "DELETE FROM courses WHERE id = ?",
        [id],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Could not delete course" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Course not found" });
          }

          writeAuditLog(req, {
            action: "COURSE_DELETED",
            entityType: "course",
            entityId: id,
            oldValues: oldCourse,
          });

          res.json({ success: true, message: "Course deleted successfully" });
        }
      );
    }
  );
}

module.exports = {
  getAllCourses,
  addCourse,
  updateCourse,
  deleteCourse,
};
