
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function getAllDepartments(req, res) {
  db.query(
    `SELECT d.id, d.department_code, d.department_name, d.description,
            d.faculty_id, f.faculty_name, d.status, d.created_at, d.updated_at
     FROM departments d
     LEFT JOIN faculties f ON f.id = d.faculty_id
     ORDER BY d.department_code ASC`,
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch departments:", err);
        return res.status(500).json({ error: "Database error" });
      }
      return res.json(rows);
    }
  );
}

function createDepartment(req, res) {
  const { department_code, department_name, description, status, faculty_id } = req.body;

  if (!department_code || !department_name) {
    return res.status(400).json({
      error: "department_code and department_name are required",
    });
  }

  const normalizedCode = String(department_code).trim().toUpperCase();
  const normalizedName = String(department_name).trim();
  const normalizedDescription = description ? String(description).trim() : null;
  const normalizedStatus = status === "Inactive" ? "Inactive" : "Active";

  let normalizedFacultyId = null;
  if (faculty_id !== undefined && faculty_id !== null && faculty_id !== "") {
    normalizedFacultyId = Number(faculty_id);
    if (!Number.isSafeInteger(normalizedFacultyId) || normalizedFacultyId <= 0) {
      return res.status(400).json({ error: "faculty_id must be a valid positive integer" });
    }
  }

  function insertDepartment() {
    db.query(
      `INSERT INTO departments
        (faculty_id, department_code, department_name, description, status)
       VALUES (?, ?, ?, ?, ?)`,
      [normalizedFacultyId, normalizedCode, normalizedName, normalizedDescription, normalizedStatus],
      (err, result) => {
        if (err) {
          console.error("Failed to create department:", err);
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Department code already exists" });
          }
          return res.status(500).json({ error: "Could not create department" });
        }

        writeAuditLog(req, {
          action: "DEPARTMENT_CREATED",
          entityType: "department",
          entityId: result.insertId,
          newValues: {
            faculty_id: normalizedFacultyId,
            department_code: normalizedCode,
            department_name: normalizedName,
            description: normalizedDescription,
            status: normalizedStatus,
          },
        });

        return res.status(201).json({
          success: true,
          id: result.insertId,
          faculty_id: normalizedFacultyId,
          department_code: normalizedCode,
          department_name: normalizedName,
          status: normalizedStatus,
        });
      }
    );
  }

  if (normalizedFacultyId === null) {
    return insertDepartment();
  }

  db.query(
    "SELECT id FROM faculties WHERE id = ? AND status = 'Active'",
    [normalizedFacultyId],
    (err, rows) => {
      if (err) {
        console.error("Failed to validate department faculty:", err);
        return res.status(500).json({ error: "Could not validate selected faculty" });
      }
      if (!rows.length) {
        return res.status(400).json({ error: "Select an active faculty" });
      }
      return insertDepartment();
    }
  );
}

module.exports = {
  getAllDepartments,
  createDepartment,
};
