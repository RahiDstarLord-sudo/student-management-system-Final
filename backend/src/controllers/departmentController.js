
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function getAllDepartments(req, res) {
  db.query(
    `SELECT id, department_code, department_name, description, status, created_at, updated_at
     FROM departments
     ORDER BY department_code ASC`,
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
  const { department_code, department_name, description, status } = req.body;

  if (!department_code || !department_name) {
    return res.status(400).json({
      error: "department_code and department_name are required",
    });
  }

  const normalizedCode = String(department_code).trim().toUpperCase();
  const normalizedName = String(department_name).trim();
  const normalizedDescription = description ? String(description).trim() : null;
  const normalizedStatus = status === "Inactive" ? "Inactive" : "Active";

  db.query(
    `INSERT INTO departments (department_code, department_name, description, status)
     VALUES (?, ?, ?, ?)`,
    [normalizedCode, normalizedName, normalizedDescription, normalizedStatus],
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
          department_code: normalizedCode,
          department_name: normalizedName,
          description: normalizedDescription,
          status: normalizedStatus,
        },
      });

      return res.status(201).json({
        success: true,
        id: result.insertId,
        department_code: normalizedCode,
        department_name: normalizedName,
        status: normalizedStatus,
      });
    }
  );
}

module.exports = {
  getAllDepartments,
  createDepartment,
};
