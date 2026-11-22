
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const VALID_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const VALID_STATUSES = ["Active", "Pending", "Inactive"];

function getInitials(name) {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "?";

  return cleanName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Get all students
function getAllStudents(req, res) {
  db.query(
  `SELECT * FROM students
   WHERE registration_status = 'approved'
   ORDER BY id DESC`,
  (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    const students = rows.map((row) => ({
      id: row.student_id,
      name: row.name,
      email: row.email,
      course: row.course,
      year: row.year,
      status: row.status,
      initials: getInitials(row.name),
    }));

    res.json(students);
  });
}

// Add a new student
function addStudent(req, res) {
  const { name, email, course } = req.body;

  if (!name || !email || !course) {
    return res
      .status(400)
      .json({ error: "Name, email and course are required" });
  }

  const studentId = `GC-${Date.now().toString().slice(-6)}`;

  db.query(
    "INSERT INTO students (student_id, name, email, course) VALUES (?, ?, ?, ?)",
    [studentId, name, email, course],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      writeAuditLog(req, {
        action: "STUDENT_CREATED",
        entityType: "student",
        entityId: studentId,
        newValues: { name, email, course },
      });

      res.status(201).json({
        id: studentId,
        name,
        email,
        course,
        year: "1st Year",
        status: "Active",
        initials: getInitials(name),
      });
    }
  );
}

// Update a student
function updateStudent(req, res) {
  const { name, email, course, year, status } = req.body;

  if (!name || !email || !course || !year || !status) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!VALID_YEARS.includes(year) || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid year or status" });
  }

  const studentId = req.params.id;

  db.query(
    `SELECT student_id, name, email, course, year, status
     FROM students
     WHERE student_id = ?
     LIMIT 1`,
    [studentId],
    (selectErr, rows) => {
      if (selectErr) {
        console.error(selectErr);
        return res.status(500).json({ error: "Database error" });
      }

      const oldStudent = rows[0];

      if (!oldStudent) {
        return res.status(404).json({ error: "Student not found" });
      }

      db.query(
        `UPDATE students
         SET name = ?, email = ?, course = ?, year = ?, status = ?
         WHERE student_id = ?`,
        [name, email, course, year, status, studentId],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found" });
          }

          writeAuditLog(req, {
            action: "STUDENT_UPDATED",
            entityType: "student",
            entityId: studentId,
            oldValues: oldStudent,
            newValues: { name, email, course, year, status },
          });

          res.json({
            id: studentId,
            name,
            email,
            course,
            year,
            status,
            initials: getInitials(name),
          });
        }
      );
    }
  );
}

// Delete a student
function deleteStudent(req, res) {
  const studentId = req.params.id;

  db.query(
    `SELECT student_id, name, email, course, year, status
     FROM students
     WHERE student_id = ?
     LIMIT 1`,
    [studentId],
    (selectErr, rows) => {
      if (selectErr) {
        console.error(selectErr);
        return res.status(500).json({ error: "Database error" });
      }

      const oldStudent = rows[0];

      if (!oldStudent) {
        return res.status(404).json({ error: "Student not found" });
      }

      db.query(
        "DELETE FROM students WHERE student_id = ?",
        [studentId],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found" });
          }

          writeAuditLog(req, {
            action: "STUDENT_DELETED",
            entityType: "student",
            entityId: studentId,
            oldValues: oldStudent,
          });

          res.json({ success: true });
        }
      );
    }
  );
}

// Get the logged-in student's own profile
function getMyProfile(req, res) {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Students only" });
  }

  db.query(
    "SELECT * FROM students WHERE student_id = ?",
    [req.user.studentId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      const row = rows[0];

      if (!row) {
        return res.status(404).json({ error: "Student record not found" });
      }

      res.json({
        id: row.student_id,
        name: row.name,
        email: row.email,
        course: row.course,
        year: row.year,
        status: row.status,
        initials: getInitials(row.name),
      });
    }
  );
}

module.exports = {
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getMyProfile,
};
