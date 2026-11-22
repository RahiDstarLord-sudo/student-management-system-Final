
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function getAllSemesters(req, res) {
  const { department_id } = req.query;

  let sql = `
    SELECT s.id, s.department_id, d.department_code, d.department_name,
           s.semester_number, s.semester_name, s.description, s.status,
           s.created_at, s.updated_at
    FROM semesters s
    LEFT JOIN departments d ON d.id = s.department_id
  `;
  const params = [];

  if (department_id) {
    sql += " WHERE s.department_id = ?";
    params.push(Number(department_id));
  }

  sql += " ORDER BY s.department_id ASC, s.semester_number ASC";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Failed to fetch semesters:", err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.json(rows);
  });
}

function createSemester(req, res) {
  const { department_id, semester_number, semester_name, description, status } = req.body;

  const deptId = Number(department_id);
  const semNum = Number(semester_number);

  if (!deptId || !Number.isInteger(semNum) || semNum < 1 || semNum > 8) {
    return res.status(400).json({
      error: "Valid department_id and semester_number (1 to 8) are required",
    });
  }

  const finalName = semester_name && String(semester_name).trim()
    ? String(semester_name).trim()
    : `Semester ${semNum}`;
  const normalizedStatus = status === "Inactive" ? "Inactive" : "Active";
  const normalizedDescription = description ? String(description).trim() : null;

  db.query(
    `INSERT INTO semesters (department_id, semester_number, semester_name, description, status)
     VALUES (?, ?, ?, ?, ?)`,
    [deptId, semNum, finalName, normalizedDescription, normalizedStatus],
    (err, result) => {
      if (err) {
        console.error("Failed to create semester:", err);
        if (err.code === "ER_NO_REFERENCED_ROW_2") {
          return res.status(400).json({ error: "Referenced department does not exist" });
        }
        return res.status(500).json({ error: "Could not create semester" });
      }

      writeAuditLog(req, {
        action: "SEMESTER_CREATED",
        entityType: "semester",
        entityId: result.insertId,
        newValues: {
          department_id: deptId,
          semester_number: semNum,
          semester_name: finalName,
          description: normalizedDescription,
          status: normalizedStatus,
        },
      });

      return res.status(201).json({
        success: true,
        id: result.insertId,
        department_id: deptId,
        semester_number: semNum,
        semester_name: finalName,
        status: normalizedStatus,
      });
    }
  );
}

module.exports = {
  getAllSemesters,
  createSemester,
};
