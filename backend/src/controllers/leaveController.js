
const { isRealDate } = require("../utils/dateUtils");
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const LEAVE_TYPES = ["Sick leave", "Casual leave", "Family event", "Other"];

const LEAVE_SELECT = `SELECT id, student_id, leave_type, reason, status,
  DATE_FORMAT(from_date, '%Y-%m-%d') AS from_date,
  DATE_FORMAT(to_date, '%Y-%m-%d') AS to_date
  FROM leave_requests`;

function toLeave(row, studentName) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: studentName || null,
    type: row.leave_type,
    from: row.from_date,
    to: row.to_date,
    reason: row.reason,
    status: row.status,
  };
}

function requireStudent(req, res, next) {
  if (req.user.role !== "student" || !req.user.studentId) {
    return res.status(403).json({ error: "Students only" });
  }

  next();
}

// Student: list my own leave requests
function getMyLeaves(req, res) {
  db.query(
    `${LEAVE_SELECT} WHERE student_id = ? ORDER BY id DESC`,
    [req.user.studentId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(rows.map((row) => toLeave(row)));
    }
  );
}

// Student: submit a new leave request
function createLeave(req, res) {
  const { type, from, to, reason } = req.body;

  if (!LEAVE_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid leave type" });
  }

  if (!isRealDate(from) || !isRealDate(to)) {
    return res.status(400).json({
      error: "Valid start and end dates are required",
    });
  }

  if (to < from) {
    return res.status(400).json({
      error: "End date cannot be before the start date",
    });
  }

  const cleanReason = String(reason || "").trim();

  if (!cleanReason || cleanReason.length > 500) {
    return res.status(400).json({
      error: "Reason is required (maximum 500 characters)",
    });
  }

  db.query(
    "INSERT INTO leave_requests (student_id, leave_type, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)",
    [req.user.studentId, type, from, to, cleanReason],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      writeAuditLog(req, {
        action: "LEAVE_REQUEST_CREATED",
        entityType: "leave_request",
        entityId: result.insertId,
        newValues: {
          student_id: req.user.studentId,
          leave_type: type,
          from_date: from,
          to_date: to,
          status: "Pending",
        },
      });

      res.status(201).json({
        id: result.insertId,
        studentId: req.user.studentId,
        studentName: null,
        type,
        from,
        to,
        reason: cleanReason,
        status: "Pending",
      });
    }
  );
}

// Student: cancel my own pending request
function cancelMyLeave(req, res) {
  db.query(
    "SELECT id, student_id, leave_type, from_date, to_date, status FROM leave_requests WHERE id = ? AND student_id = ? AND status = 'Pending'",
    [req.params.id, req.user.studentId],
    (selectErr, rows) => {
      if (selectErr) {
        console.error(selectErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (!rows.length) {
        return res.status(404).json({
          error: "Request not found or already decided",
        });
      }

      const oldValues = rows[0];

      db.query(
        "DELETE FROM leave_requests WHERE id = ? AND student_id = ? AND status = 'Pending'",
        [req.params.id, req.user.studentId],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({
              error: "Request not found or already decided",
            });
          }

          writeAuditLog(req, {
            action: "LEAVE_REQUEST_CANCELLED",
            entityType: "leave_request",
            entityId: oldValues.id,
            oldValues,
          });

          res.json({ success: true });
        }
      );
    }
  );
}

// Staff: list all leave requests
function getAllLeaves(req, res) {
  db.query(
    `${LEAVE_SELECT} ORDER BY FIELD(status, 'Pending', 'Approved', 'Rejected'), id DESC`,
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      db.query("SELECT student_id, name FROM students", (nameErr, students) => {
        if (nameErr) {
          console.error(nameErr);
          return res.status(500).json({ error: "Database error" });
        }

        const names = {};

        students.forEach((student) => {
          names[student.student_id] = student.name;
        });

        res.json(rows.map((row) => toLeave(row, names[row.student_id])));
      });
    }
  );
}

// Staff: approve or reject a pending request
function updateLeaveStatus(req, res) {
  const { status } = req.body;

  if (status !== "Approved" && status !== "Rejected") {
    return res.status(400).json({
      error: "Status must be Approved or Rejected",
    });
  }

  db.query(
    "SELECT id, student_id, leave_type, from_date, to_date, status FROM leave_requests WHERE id = ? AND status = 'Pending'",
    [req.params.id],
    (selectErr, rows) => {
      if (selectErr) {
        console.error(selectErr);
        return res.status(500).json({ error: "Database error" });
      }

      if (!rows.length) {
        return res.status(404).json({
          error: "Request not found or already decided",
        });
      }

      const oldValues = rows[0];

      db.query(
        "UPDATE leave_requests SET status = ? WHERE id = ? AND status = 'Pending'",
        [status, req.params.id],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({
              error: "Request not found or already decided",
            });
          }

          writeAuditLog(req, {
            action:
              status === "Approved"
                ? "LEAVE_REQUEST_APPROVED"
                : "LEAVE_REQUEST_REJECTED",
            entityType: "leave_request",
            entityId: oldValues.id,
            oldValues: {
              ...oldValues,
              status: "Pending",
            },
            newValues: {
              status,
            },
          });

          res.json({ success: true, status });
        }
      );
    }
  );
}

module.exports = {
  requireStudent,
  getMyLeaves,
  createLeave,
  cancelMyLeave,
  getAllLeaves,
  updateLeaveStatus,
};
