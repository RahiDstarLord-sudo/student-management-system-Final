const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

async function getTimetableVersions(req, res) {
  try {
    const conditions = [];
    const params = [];

    for (const field of ["department_id", "academic_year_id", "semester_id", "status"]) {
      if (req.query[field] !== undefined) {
        conditions.push(`tv.${field} = ?`);
        params.push(req.query[field]);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.promise().query(
      `SELECT tv.*, d.department_name, ay.year_name, ay.start_date, ay.end_date, s.semester_name
       FROM timetable_versions tv
       INNER JOIN departments d ON d.id = tv.department_id
       INNER JOIN academic_years ay ON ay.id = tv.academic_year_id
       INNER JOIN semesters s ON s.id = tv.semester_id
       ${where}
       ORDER BY tv.created_at DESC, tv.version_number DESC`,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("Get timetable versions failed:", error);
    res.status(500).json({ error: "Could not load timetable versions" });
  }
}

async function createTimetableVersion(req, res) {
  const departmentId = Number(req.body.department_id);
  const academicYearId = Number(req.body.academic_year_id);
  const semesterId = Number(req.body.semester_id);
  const title = String(req.body.title || "").trim().slice(0, 150) || null;

  if (
    !Number.isInteger(departmentId) || departmentId < 1 ||
    !Number.isInteger(academicYearId) || academicYearId < 1 ||
    !Number.isInteger(semesterId) || semesterId < 1
  ) {
    return res.status(400).json({
      error: "Valid department, academic year and semester are required."
    });
  }

  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const [lockRows] = await connection.query(
      "SELECT GET_LOCK('greenfield_timetable_version_write', 15) AS acquired"
    );

    if (Number(lockRows[0]?.acquired) !== 1) {
      return res.status(409).json({ error: "Timetable version service is busy." });
    }
    lockAcquired = true;

    await connection.beginTransaction();
    transactionStarted = true;

    const [departmentRows] = await connection.query(
      "SELECT id FROM departments WHERE id = ? FOR UPDATE",
      [departmentId]
    );

    const [yearRows] = await connection.query(
      "SELECT id FROM academic_years WHERE id = ?",
      [academicYearId]
    );

    const [semesterRows] = await connection.query(
      "SELECT id FROM semesters WHERE id = ? AND department_id = ?",
      [semesterId, departmentId]
    );

    if (!departmentRows.length || !yearRows.length || !semesterRows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        error: "Selected department, academic year or semester is invalid. Semester must belong to the selected department."
      });
    }

    const [numberRows] = await connection.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM timetable_versions
       WHERE department_id = ? AND academic_year_id = ? AND semester_id = ?`,
      [departmentId, academicYearId, semesterId]
    );

    const versionNumber = Number(numberRows[0].next_version);

    const [result] = await connection.query(
      `INSERT INTO timetable_versions
       (department_id, academic_year_id, semester_id, version_number,
        title, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        departmentId,
        academicYearId,
        semesterId,
        versionNumber,
        title,
        req.user.id,
        req.user.id
      ]
    );

    await connection.commit();
    transactionStarted = false;

    writeAuditLog(req, {
      action: "TIMETABLE_VERSION_CREATED",
      entityType: "timetable_version",
      entityId: result.insertId,
      newValues: {
        department_id: departmentId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        version_number: versionNumber,
        title,
        status: "draft"
      }
    });

    return res.status(201).json({
      success: true,
      message: "Draft timetable version created.",
      version: {
        id: result.insertId,
        department_id: departmentId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        version_number: versionNumber,
        title,
        status: "draft"
      }
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Version create rollback failed:", rollbackError);
      }
    }

    console.error("Create timetable version failed:", error);
    return res.status(500).json({ error: "Could not create timetable version." });
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await connection.query(
            "SELECT RELEASE_LOCK('greenfield_timetable_version_write')"
          );
        } catch (error) {
          console.error("Version lock release failed:", error);
        }
      }
      connection.release();
    }
  }
}

async function findPublishAvailabilityConflicts(connection, versionId) {
  const [entries] = await connection.query(
    `SELECT id, day_of_week, start_time, end_time, teacher_id,
            DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
            DATE_FORMAT(effective_until, '%Y-%m-%d') AS effective_until
     FROM timetable_entries
     WHERE version_id = ? AND teacher_id IS NOT NULL`,
    [versionId]
  );

  const conflicts = [];

  for (const entry of entries) {
    const [rows] = await connection.query(
      `SELECT id, start_time, end_time, availability_type,
              DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
              DATE_FORMAT(effective_until, '%Y-%m-%d') AS effective_until
       FROM teacher_availability
       WHERE teacher_id = ?
         AND day_of_week = ?
         AND (effective_until IS NULL OR ? IS NULL OR effective_until >= ?)
         AND (effective_from IS NULL OR ? IS NULL OR effective_from <= ?)`,
      [
        entry.teacher_id,
        entry.day_of_week,
        entry.effective_from,
        entry.effective_from,
        entry.effective_until,
        entry.effective_until
      ]
    );

    const startTime = String(entry.start_time).slice(0, 8);
    const endTime = String(entry.end_time).slice(0, 8);

    const unavailable = rows.find(row =>
      row.availability_type === "unavailable" &&
      String(row.start_time).slice(0, 8) < endTime &&
      String(row.end_time).slice(0, 8) > startTime
    );

    const availableRows = rows.filter(row => {
      if (row.availability_type !== "available") return false;

      const coversStart = entry.effective_from
        ? (!row.effective_from || row.effective_from <= entry.effective_from)
        : !row.effective_from;

      const coversEnd = entry.effective_until
        ? (!row.effective_until || row.effective_until >= entry.effective_until)
        : !row.effective_until;

      return coversStart && coversEnd;
    });

    const outsideAvailable = availableRows.length > 0 &&
      !availableRows.some(row =>
        String(row.start_time).slice(0, 8) <= startTime &&
        String(row.end_time).slice(0, 8) >= endTime
      );

    if (unavailable || outsideAvailable) {
      conflicts.push({
        entry_id: entry.id,
        teacher_id: entry.teacher_id,
        conflict_type: unavailable
          ? "teacher_unavailable"
          : "outside_available_hours"
      });
    }
  }

  return conflicts;
}
async function publishTimetableVersion(req, res) {
  const versionId = Number(req.params.id);

  if (!Number.isInteger(versionId) || versionId < 1) {
    return res.status(400).json({ error: "Invalid timetable version ID." });
  }

  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();

    const [lockRows] = await connection.query(
      "SELECT GET_LOCK('greenfield_timetable_version_write', 15) AS acquired"
    );

    if (Number(lockRows[0]?.acquired) !== 1) {
      return res.status(409).json({ error: "Timetable version service is busy." });
    }
    lockAcquired = true;

    await connection.beginTransaction();
    transactionStarted = true;

    const [versions] = await connection.query(
      "SELECT * FROM timetable_versions WHERE id = ? FOR UPDATE",
      [versionId]
    );

    if (!versions.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Timetable version not found." });
    }

    const version = versions[0];

    if (version.status !== "draft") {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "Only a draft timetable version can be published."
      });
    }

    const [entryCount] = await connection.query(
      "SELECT COUNT(*) AS total FROM timetable_entries WHERE version_id = ?",
      [versionId]
    );

    if (Number(entryCount[0].total) === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "Cannot publish an empty timetable. Add timetable entries to this draft first."
      });
    }

    const [conflicts] = await connection.query(
      `SELECT a.id AS first_entry, b.id AS second_entry,
              CASE
                WHEN a.teacher_id IS NOT NULL AND a.teacher_id = b.teacher_id
                  THEN 'teacher'
                WHEN a.section_id IS NOT NULL AND a.section_id = b.section_id
                  THEN 'section'
                ELSE 'room'
              END AS conflict_type
       FROM timetable_entries a
       INNER JOIN timetable_entries b
         ON a.version_id = b.version_id
        AND a.id < b.id
        AND a.day_of_week = b.day_of_week
        AND a.start_time < b.end_time
        AND a.end_time > b.start_time
        AND (
          a.effective_until IS NULL
          OR b.effective_from IS NULL
          OR a.effective_until >= b.effective_from
        )
        AND (
          b.effective_until IS NULL
          OR a.effective_from IS NULL
          OR b.effective_until >= a.effective_from
        )
       WHERE a.version_id = ?
         AND (
           (a.teacher_id IS NOT NULL AND a.teacher_id = b.teacher_id)
           OR (a.section_id IS NOT NULL AND a.section_id = b.section_id)
           OR (a.room_id IS NOT NULL AND a.room_id = b.room_id)
           OR (
             a.room IS NOT NULL AND b.room IS NOT NULL
             AND LOWER(TRIM(a.room)) = LOWER(TRIM(b.room))
           )
         )
       LIMIT 20`,
      [versionId]
    );

    if (conflicts.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "Timetable contains scheduling conflicts. Resolve them before publishing.",
        conflicts
      });
    }

    const [resourceEntries] = await connection.query(
      `SELECT tt.id, tt.section_id, tt.room_id, tt.session_type,
              s.capacity AS section_capacity, s.status AS section_status,
              r.room_code, r.room_type, r.capacity AS room_capacity, r.status AS room_status
       FROM timetable_entries tt
       LEFT JOIN sections s ON s.id = tt.section_id
       LEFT JOIN rooms r ON r.id = tt.room_id
       WHERE tt.version_id = ?`,
      [versionId]
    );
    const resourceConflicts = [];
    for (const entry of resourceEntries) {
      let enrolled = null;
      if (entry.section_id !== null) {
        if (String(entry.section_status || "").toLowerCase() !== "active") {
          resourceConflicts.push({ entry_id: entry.id, conflict_type: "inactive_section" });
        }
        const [counts] = await connection.query(
          `SELECT COUNT(*) AS enrolled_count FROM student_enrollments
           WHERE section_id = ? AND LOWER(status) = 'active'`,
          [entry.section_id]
        );
        enrolled = Number(counts[0]?.enrolled_count || 0);
        const cap = entry.section_capacity == null ? null : Number(entry.section_capacity);
        if (cap !== null && cap > 0 && enrolled > cap) {
          resourceConflicts.push({ entry_id: entry.id, conflict_type: "section_capacity", enrolled_count: enrolled, section_capacity: cap });
        }
      }
      if (entry.room_id !== null) {
        if (String(entry.room_status || "").toLowerCase() !== "active") {
          resourceConflicts.push({ entry_id: entry.id, conflict_type: "inactive_room", room_code: entry.room_code });
        }
        const roomCap = entry.room_capacity == null ? null : Number(entry.room_capacity);
        if (enrolled !== null && roomCap !== null && roomCap > 0 && enrolled > roomCap) {
          resourceConflicts.push({ entry_id: entry.id, conflict_type: "room_capacity", enrolled_count: enrolled, room_capacity: roomCap, room_code: entry.room_code });
        }
      }
      if (entry.session_type === "lab" && (entry.room_id === null || entry.room_type !== "laboratory")) {
        resourceConflicts.push({ entry_id: entry.id, conflict_type: "lab_room_compatibility", room_type: entry.room_type || null });
      }
    }
    if (resourceConflicts.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "Timetable contains section/room capacity or laboratory compatibility conflicts. Resolve them before publishing.",
        conflicts: resourceConflicts
      });
    }

    const availabilityConflicts =
      await findPublishAvailabilityConflicts(connection, versionId);

    if (availabilityConflicts.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "Timetable contains teacher availability conflicts. Resolve them before publishing.",
        conflicts: availabilityConflicts
      });
    }
    await connection.query(
      `UPDATE timetable_versions
       SET status = 'archived', updated_by = ?
       WHERE department_id = ?
         AND academic_year_id = ?
         AND semester_id = ?
         AND status = 'published'`,
      [
        req.user.id,
        version.department_id,
        version.academic_year_id,
        version.semester_id
      ]
    );

    await connection.query(
      `UPDATE timetable_versions
       SET status = 'published',
           published_at = NOW(),
           published_by = ?,
           updated_by = ?
       WHERE id = ? AND status = 'draft'`,
      [req.user.id, req.user.id, versionId]
    );

    await connection.commit();
    transactionStarted = false;

    writeAuditLog(req, {
      action: "TIMETABLE_VERSION_PUBLISHED",
      entityType: "timetable_version",
      entityId: versionId,
      oldValues: { status: "draft" },
      newValues: { status: "published", published_by: req.user.id }
    });

    return res.json({
      success: true,
      message: "Timetable version published successfully.",
      version_id: versionId,
      status: "published"
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Version publish rollback failed:", rollbackError);
      }
    }

    console.error("Publish timetable version failed:", error);
    return res.status(500).json({ error: "Could not publish timetable version." });
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await connection.query(
            "SELECT RELEASE_LOCK('greenfield_timetable_version_write')"
          );
        } catch (error) {
          console.error("Version lock release failed:", error);
        }
      }
      connection.release();
    }
  }
}

async function archiveTimetableVersion(req, res) {
  const versionId = Number(req.params.id);

  if (!Number.isInteger(versionId) || versionId < 1) {
    return res.status(400).json({ error: "Invalid timetable version ID." });
  }

  try {
    const [result] = await db.promise().query(
      `UPDATE timetable_versions
       SET status = 'archived', updated_by = ?
       WHERE id = ? AND status IN ('draft', 'published')`,
      [req.user.id, versionId]
    );

    if (!result.affectedRows) {
      const [rows] = await db.promise().query(
        "SELECT id FROM timetable_versions WHERE id = ?",
        [versionId]
      );

      return res.status(rows.length ? 409 : 404).json({
        error: rows.length
          ? "Timetable version is already archived."
          : "Timetable version not found."
      });
    }

    writeAuditLog(req, {
      action: "TIMETABLE_VERSION_ARCHIVED",
      entityType: "timetable_version",
      entityId: versionId,
      newValues: { status: "archived" }
    });

    return res.json({
      success: true,
      message: "Timetable version archived.",
      version_id: versionId,
      status: "archived"
    });
  } catch (error) {
    console.error("Archive timetable version failed:", error);
    return res.status(500).json({ error: "Could not archive timetable version." });
  }
}

module.exports = {
  getTimetableVersions,
  createTimetableVersion,
  publishTimetableVersion,
  archiveTimetableVersion
};


