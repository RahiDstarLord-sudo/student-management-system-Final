const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const CONFIG = {
  departments: {
    fields: ["faculty_id", "department_code", "department_name", "description", "status"],
    required: ["faculty_id", "department_code", "department_name"],
    numeric: ["faculty_id"],
    defaults: { status: "Active" },
    order: "department_code ASC",
  },
  faculties: {
    fields: ["faculty_code", "faculty_name", "description", "status"],
    required: ["faculty_code", "faculty_name"],
    numeric: [],
    defaults: { status: "Active" },
    order: "faculty_name ASC",
  },
  programs: {
    fields: ["department_id", "program_code", "program_name", "degree_level", "duration_semesters", "status"],
    required: ["department_id", "program_code", "program_name"],
    numeric: ["department_id", "duration_semesters"],
    defaults: { status: "Active" },
    order: "program_name ASC",
  },
  batches: {
    fields: ["program_id", "academic_year_id", "batch_code", "admission_year", "status"],
    required: ["program_id", "academic_year_id", "batch_code"],
    numeric: ["program_id", "academic_year_id", "admission_year"],
    defaults: { status: "Active" },
    order: "batch_code ASC",
  },
  sections: {
    fields: ["batch_id", "semester_id", "section_code", "section_name", "capacity", "status"],
    required: ["batch_id", "semester_id", "section_code", "section_name"],
    numeric: ["batch_id", "semester_id", "capacity"],
    defaults: { status: "Active" },
    order: "section_name ASC",
  },
  rooms: {
    fields: ["room_code", "room_name", "building", "floor_name", "room_type", "capacity", "has_projector", "status"],
    required: ["room_code"],
    numeric: ["capacity"],
    defaults: { room_type: "classroom", status: "Active", has_projector: false },
    order: "room_code ASC",
  },
};

const VALID_ROOM_TYPES = ["classroom", "laboratory", "auditorium", "online", "other"];

function normalizePayload(config, body, isUpdate = false) {
  const values = {};

  for (const field of config.fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

    let value = body[field];

    if (value === "" || value === undefined) value = null;

    if (config.required.includes(field) && (value === null || value === "")) {
      return { error: `${field} is required` };
    }

    if (config.numeric.includes(field) && value !== null) {
      value = Number(value);
      if (!Number.isSafeInteger(value) || value < 0 || (config.required.includes(field) && value === 0)) {
        return { error: `${field} must be a valid positive integer` };
      }
      if (["capacity", "duration_semesters", "admission_year"].includes(field) && value === 0) {
        return { error: `${field} must be greater than zero` };
      }
    }

    if (field === "has_projector" && value !== null) {
      if (![true, false, 0, 1, "true", "false", "0", "1"].includes(value)) {
        return { error: "has_projector must be a boolean" };
      }
      value = value === true || value === 1 || value === "1" || value === "true";
    }

    if (field === "room_type" && value !== null && !VALID_ROOM_TYPES.includes(value)) {
      return { error: "Invalid room_type" };
    }

    if (typeof value === "string") value = value.trim();

    if (config.required.includes(field) && (value === null || value === "")) {
      return { error: `${field} is required` };
    }

    values[field] = value;
  }

  if (!isUpdate) {
    for (const [field, value] of Object.entries(config.defaults)) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) {
        values[field] = value;
      }
    }

    for (const field of config.required) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) {
        return { error: `${field} is required` };
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(values, "status")) {
    if (!["Active", "Inactive"].includes(values.status)) {
      return { error: "status must be Active or Inactive" };
    }
  }

  return { values };
}

function handleDbError(res, err, operation) {
  console.error(`Academic structure ${operation} failed:`, err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "A record with the same unique value already exists" });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ error: "A selected related record does not exist" });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({ error: "This record is being used by other records and cannot be changed" });
  }

  return res.status(500).json({ error: `Could not ${operation} academic structure record` });
}


function validateRelations(table, values, callback) {
  // Inactive records may retain historical relationships.
  if (values.status === "Inactive") return callback(null);

  const checks = [];

  if (table === "departments") {
    checks.push({
      sql: "SELECT id FROM faculties WHERE id = ? AND status = 'Active'",
      params: [values.faculty_id],
      message: "Select an active faculty"
    });
  }

  if (table === "programs") {
    checks.push({
      sql: "SELECT id FROM departments WHERE id = ? AND status = 'Active'",
      params: [values.department_id],
      message: "Select an active department"
    });
  }

  if (table === "batches") {
    checks.push({
      sql: "SELECT p.id FROM programs p JOIN departments d ON d.id = p.department_id WHERE p.id = ? AND p.status = 'Active' AND d.status = 'Active'",
      params: [values.program_id],
      message: "Select a program belonging to an active department"
    });
    checks.push({
      sql: "SELECT id FROM academic_years WHERE id = ? AND status = 'Active'",
      params: [values.academic_year_id],
      message: "Select an active academic year"
    });
  }

  if (table === "sections") {
    checks.push({
      sql: "SELECT b.id FROM batches b JOIN programs p ON p.id = b.program_id JOIN departments d ON d.id = p.department_id JOIN semesters s ON s.department_id = d.id WHERE b.id = ? AND s.id = ? AND b.status = 'Active' AND p.status = 'Active' AND d.status = 'Active' AND s.status = 'Active'",
      params: [values.batch_id, values.semester_id],
      message: "The selected semester must belong to the department of the selected batch's program, and all related records must be active"
    });
  }

  let index = 0;

  function next() {
    if (index >= checks.length) return callback(null);

    const check = checks[index++];

    db.query(check.sql, check.params, (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback({ validationMessage: check.message });
      next();
    });
  }

  next();
}

function createResourceController(table) {
  const config = CONFIG[table];

  function list(req, res) {
    const sql = `SELECT * FROM ${table} ORDER BY ${config.order}`;
    db.query(sql, (err, rows) => {
      if (err) return handleDbError(res, err, "fetch");
      return res.json(rows);
    });
  }

  function create(req, res) {
    const normalized = normalizePayload(config, req.body || {});
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const values = normalized.values;
    const fields = Object.keys(values);
    const placeholders = fields.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${placeholders})`;

    validateRelations(table, values, (validationError) => {
      if (validationError) {
        if (validationError.validationMessage) {
          return res.status(400).json({ error: validationError.validationMessage });
        }
        return handleDbError(res, validationError, "validate");
      }

      db.query(sql, fields.map((field) => values[field]), (err, result) => {
      if (err) return handleDbError(res, err, "create");

      writeAuditLog(req, {
        action: `${table.toUpperCase()}_CREATED`,
        entityType: table,
        entityId: result.insertId,
        newValues: values,
      });

      return res.status(201).json({
        success: true,
        id: result.insertId,
        ...values,
      });
      });
    });
  }

  function update(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

    const normalized = normalizePayload(config, req.body || {}, true);
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const values = normalized.values;
    const fields = Object.keys(values);

    if (!fields.length) {
      return res.status(400).json({ error: "At least one valid field is required" });
    }

    const sql = `UPDATE ${table} SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`;

    db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], (findErr, currentRows) => {
      if (findErr) return handleDbError(res, findErr, "fetch");
      if (!currentRows.length) return res.status(404).json({ error: "Record not found" });

      const mergedValues = { ...currentRows[0], ...values };

      validateRelations(table, mergedValues, (validationError) => {
        if (validationError) {
          if (validationError.validationMessage) {
            return res.status(400).json({ error: validationError.validationMessage });
          }
          return handleDbError(res, validationError, "validate");
        }

        db.query(sql, [...fields.map((field) => values[field]), id], (err, result) => {
      if (err) return handleDbError(res, err, "update");
      if (!result.affectedRows) return res.status(404).json({ error: "Record not found" });

      writeAuditLog(req, {
        action: `${table.toUpperCase()}_UPDATED`,
        entityType: table,
        entityId: id,
        newValues: values,
      });

      return res.json({ success: true, id, updated: values });
        });
      });
    });
  }

  function deactivate(req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

    db.query(
      `UPDATE ${table} SET status = 'Inactive' WHERE id = ?`,
      [id],
      (err, result) => {
        if (err) return handleDbError(res, err, "deactivate");

        if (!result.affectedRows) {
          return db.query(`SELECT id FROM ${table} WHERE id = ?`, [id], (checkErr, rows) => {
            if (checkErr) return handleDbError(res, checkErr, "deactivate");
            if (!rows.length) return res.status(404).json({ error: "Record not found" });
            return res.json({ success: true, id, status: "Inactive", alreadyInactive: true });
          });
        }

        writeAuditLog(req, {
          action: `${table.toUpperCase()}_DEACTIVATED`,
          entityType: table,
          entityId: id,
          newValues: { status: "Inactive" },
        });

        return res.json({ success: true, id, status: "Inactive" });
      }
    );
  }

  return { list, create, update, deactivate };
}

module.exports = Object.fromEntries(
  Object.keys(CONFIG).map((table) => [table, createResourceController(table)])
);
