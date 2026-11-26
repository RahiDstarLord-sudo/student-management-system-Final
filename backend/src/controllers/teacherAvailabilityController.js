const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday"
];

const TYPES = ["available", "unavailable"];

function validatePayload(body) {
  const teacherId = Number(body.teacher_id);
  const day = body.day_of_week;
  const start = body.start_time;
  const end = body.end_time;
  const type = body.availability_type;
  const from = body.effective_from || null;
  const until = body.effective_until || null;
  const reason = body.reason ? String(body.reason).trim() : null;

  if (!Number.isInteger(teacherId) || teacherId < 1)
    return { error: "A valid teacher is required." };

  if (!DAYS.includes(day))
    return { error: "Invalid day of week." };

  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(start || "") ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(end || ""))
    return { error: "Valid start and end times are required." };

  if (start >= end)
    return { error: "End time must be later than start time." };

  if (!TYPES.includes(type))
    return { error: "Invalid availability type." };

  const validDate = value =>
    value === null ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
     !Number.isNaN(Date.parse(value)));

  if (!validDate(from) || !validDate(until))
    return { error: "Dates must use YYYY-MM-DD format." };

  if (from && until && from > until)
    return { error: "Effective until cannot be earlier than effective from." };

  if (reason && reason.length > 255)
    return { error: "Reason cannot exceed 255 characters." };

  return {
    values: {
      teacher_id: teacherId,
      day_of_week: day,
      start_time: start.length === 5 ? `${start}:00` : start,
      end_time: end.length === 5 ? `${end}:00` : end,
      availability_type: type,
      effective_from: from,
      effective_until: until,
      reason
    }
  };
}

async function findOverlap(conn, values, excludeId = null) {
  const params = [
    values.teacher_id,
    values.day_of_week,
    values.end_time,
    values.start_time,
    values.effective_from,
    values.effective_until
  ];

  let sql = `
    SELECT id
    FROM teacher_availability
    WHERE teacher_id = ?
      AND day_of_week = ?
      AND start_time < ?
      AND end_time > ?
      AND COALESCE(effective_until, '9999-12-31') >=
          COALESCE(?, '1000-01-01')
      AND COALESCE(effective_from, '1000-01-01') <=
          COALESCE(?, '9999-12-31')
  `;

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
}

async function getTeacher(conn, teacherId) {
  const [rows] = await conn.query(
    "SELECT id, teacher_id, status FROM teachers WHERE id = ? LIMIT 1",
    [teacherId]
  );

  return rows[0] || null;
}

async function listAvailability(req, res) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.teacher_id) {
      const id = Number(req.query.teacher_id);
      if (!Number.isInteger(id) || id < 1)
        return res.status(400).json({ error: "Invalid teacher_id." });

      conditions.push("ta.teacher_id = ?");
      params.push(id);
    }

    if (req.query.day_of_week) {
      if (!DAYS.includes(req.query.day_of_week))
        return res.status(400).json({ error: "Invalid day_of_week." });

      conditions.push("ta.day_of_week = ?");
      params.push(req.query.day_of_week);
    }

    if (req.query.availability_type) {
      if (!TYPES.includes(req.query.availability_type))
        return res.status(400).json({ error: "Invalid availability_type." });

      conditions.push("ta.availability_type = ?");
      params.push(req.query.availability_type);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await db.promise().query(
      `SELECT ta.*
       FROM teacher_availability ta
       ${where}
       ORDER BY ta.teacher_id, FIELD(
         ta.day_of_week,
         'Monday','Tuesday','Wednesday','Thursday',
         'Friday','Saturday','Sunday'
       ), ta.start_time`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error("Availability list error:", err);
    return res.status(500).json({ error: "Could not load teacher availability." });
  }
}

async function createAvailability(req, res) {
  const checked = validatePayload(req.body);
  if (checked.error)
    return res.status(400).json({ error: checked.error });

  const values = checked.values;
  let conn;

  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const teacher = await getTeacher(conn, values.teacher_id);

    if (!teacher || teacher.status !== "Active") {
      await conn.rollback();
      return res.status(400).json({ error: "Teacher does not exist or is inactive." });
    }

    const overlap = await findOverlap(conn, values);

    if (overlap) {
      await conn.rollback();
      return res.status(409).json({
        error: "This teacher already has an overlapping availability record.",
        conflicting_id: overlap.id
      });
    }

    const [result] = await conn.query(
      `INSERT INTO teacher_availability
       (teacher_id, day_of_week, start_time, end_time,
        availability_type, effective_from, effective_until, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.teacher_id,
        values.day_of_week,
        values.start_time,
        values.end_time,
        values.availability_type,
        values.effective_from,
        values.effective_until,
        values.reason
      ]
    );

    await conn.commit();

    writeAuditLog(req, {
      action: "CREATE",
      entityType: "teacher_availability",
      entityId: result.insertId,
      newValues: values
    });

    return res.status(201).json({
      message: "Teacher availability created successfully.",
      availability: { id: result.insertId, ...values }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Availability create error:", err);
    return res.status(500).json({ error: "Could not create teacher availability." });
  } finally {
    if (conn) conn.release();
  }
}

async function updateAvailability(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: "Invalid availability ID." });

  const checked = validatePayload(req.body);
  if (checked.error)
    return res.status(400).json({ error: checked.error });

  const values = checked.values;
  let conn;

  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      "SELECT * FROM teacher_availability WHERE id = ? FOR UPDATE",
      [id]
    );

    if (!existingRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Availability record not found." });
    }

    const teacher = await getTeacher(conn, values.teacher_id);

    if (!teacher || teacher.status !== "Active") {
      await conn.rollback();
      return res.status(400).json({ error: "Teacher does not exist or is inactive." });
    }

    const overlap = await findOverlap(conn, values, id);

    if (overlap) {
      await conn.rollback();
      return res.status(409).json({
        error: "This teacher already has an overlapping availability record.",
        conflicting_id: overlap.id
      });
    }

    await conn.query(
      `UPDATE teacher_availability
       SET teacher_id = ?, day_of_week = ?, start_time = ?, end_time = ?,
           availability_type = ?, effective_from = ?, effective_until = ?, reason = ?
       WHERE id = ?`,
      [
        values.teacher_id,
        values.day_of_week,
        values.start_time,
        values.end_time,
        values.availability_type,
        values.effective_from,
        values.effective_until,
        values.reason,
        id
      ]
    );

    await conn.commit();

    writeAuditLog(req, {
      action: "UPDATE",
      entityType: "teacher_availability",
      entityId: id,
      oldValues: existingRows[0],
      newValues: values
    });

    return res.json({
      message: "Teacher availability updated successfully.",
      availability: { id, ...values }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Availability update error:", err);
    return res.status(500).json({ error: "Could not update teacher availability." });
  } finally {
    if (conn) conn.release();
  }
}

async function deleteAvailability(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: "Invalid availability ID." });

  let conn;

  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT * FROM teacher_availability WHERE id = ? FOR UPDATE",
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Availability record not found." });
    }

    await conn.query(
      "DELETE FROM teacher_availability WHERE id = ?",
      [id]
    );

    await conn.commit();

    writeAuditLog(req, {
      action: "DELETE",
      entityType: "teacher_availability",
      entityId: id,
      oldValues: rows[0]
    });

    return res.json({ message: "Availability record deleted successfully." });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Availability delete error:", err);
    return res.status(500).json({ error: "Could not delete availability record." });
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  listAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability
};
