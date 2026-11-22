const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const VALID_STATUSES = ["Active", "Inactive"];

function getAcademicYears(req, res) {
  db.query(
    `SELECT id, year_name, start_date, end_date, status, created_at, updated_at
     FROM academic_years
     ORDER BY start_date DESC, id DESC`,
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch academic years:", err);
        return res.status(500).json({ error: "Could not load academic years" });
      }
      return res.json(rows);
    }
  );
}

function createAcademicYear(req, res) {
  const { year_name, yearName, start_date, startDate, end_date, endDate, status } = req.body || {};

  const normalizedYearName = String(year_name ?? yearName ?? "").trim().slice(0, 30);
  const normalizedStartDate = String(start_date ?? startDate ?? "").trim();
  const normalizedEndDate = String(end_date ?? endDate ?? "").trim();
  const normalizedStatus = VALID_STATUSES.includes(status) ? status : "Inactive";

  if (!normalizedYearName || !normalizedStartDate || !normalizedEndDate) {
    return res.status(400).json({
      error: "year_name, start_date, and end_date are required",
    });
  }

  if (normalizedEndDate < normalizedStartDate) {
    return res.status(400).json({
      error: "end_date must be on or after start_date",
    });
  }

  db.query(
    `INSERT INTO academic_years (year_name, start_date, end_date, status)
     VALUES (?, ?, ?, ?)`,
    [normalizedYearName, normalizedStartDate, normalizedEndDate, normalizedStatus],
    (err, result) => {
      if (err) {
        console.error("Failed to create academic year:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "Academic year already exists" });
        }
        return res.status(500).json({ error: "Could not create academic year" });
      }

      writeAuditLog(req, {
        action: "ACADEMIC_YEAR_CREATED",
        entityType: "academic_year",
        entityId: result.insertId,
        newValues: {
          year_name: normalizedYearName,
          start_date: normalizedStartDate,
          end_date: normalizedEndDate,
          status: normalizedStatus,
        },
      });

      return res.status(201).json({
        success: true,
        id: result.insertId,
        year_name: normalizedYearName,
        start_date: normalizedStartDate,
        end_date: normalizedEndDate,
        status: normalizedStatus,
      });
    }
  );
}

function updateAcademicYear(req, res) {
  const id = Number(req.params.id);
  const { year_name, yearName, start_date, startDate, end_date, endDate, status } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Valid academic year id is required" });
  }

  db.query(
    "SELECT id, year_name, start_date, end_date, status FROM academic_years WHERE id = ?",
    [id],
    (findErr, rows) => {
      if (findErr) {
        console.error("Failed to find academic year:", findErr);
        return res.status(500).json({ error: "Could not load academic year" });
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Academic year not found" });
      }

      const current = rows[0];
      const nextYearName = String(year_name ?? yearName ?? current.year_name ?? "").trim().slice(0, 30);
      const nextStartDate = String(start_date ?? startDate ?? current.start_date ?? "").trim().slice(0, 10);
      const nextEndDate = String(end_date ?? endDate ?? current.end_date ?? "").trim().slice(0, 10);
      const nextStatus = status !== undefined
        ? (VALID_STATUSES.includes(status) ? status : null)
        : current.status;

      if (!nextYearName || !nextStartDate || !nextEndDate || !nextStatus) {
        return res.status(400).json({
          error: "Valid year_name, start_date, end_date, and status (Active/Inactive) are required",
        });
      }

      if (nextEndDate < nextStartDate) {
        return res.status(400).json({
          error: "end_date must be on or after start_date",
        });
      }

      db.query(
        `UPDATE academic_years
         SET year_name = ?, start_date = ?, end_date = ?, status = ?
         WHERE id = ?`,
        [nextYearName, nextStartDate, nextEndDate, nextStatus, id],
        (updErr) => {
          if (updErr) {
            console.error("Failed to update academic year:", updErr);
            if (updErr.code === "ER_DUP_ENTRY") {
              return res.status(409).json({ error: "Academic year already exists" });
            }
            return res.status(500).json({ error: "Could not update academic year" });
          }

          writeAuditLog(req, {
            action: "ACADEMIC_YEAR_UPDATED",
            entityType: "academic_year",
            entityId: id,
            oldValues: current,
            newValues: {
              year_name: nextYearName,
              start_date: nextStartDate,
              end_date: nextEndDate,
              status: nextStatus,
            },
          });

          return res.json({
            success: true,
            id,
            year_name: nextYearName,
            start_date: nextStartDate,
            end_date: nextEndDate,
            status: nextStatus,
          });
        }
      );
    }
  );
}

module.exports = {
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
};
