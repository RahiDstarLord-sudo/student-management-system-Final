
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function loadTimetable(req, res) {
  const requestedVersion = req.query.version_id;
  let sql = `
    SELECT tt.*, c.course_code, c.course_name, t.name AS teacher_name
    FROM timetable_entries tt
    LEFT JOIN courses c ON c.id = tt.course_id
    LEFT JOIN teachers t ON t.id = tt.teacher_id
  `;
  const params = [];

  if (requestedVersion !== undefined && requestedVersion !== "") {
    if (requestedVersion === "legacy") {
      sql += " WHERE tt.version_id IS NULL";
    } else {
      const versionId = Number(requestedVersion);

      if (!Number.isInteger(versionId) || versionId < 1) {
        return res.status(400).json({ error: "Invalid timetable version ID." });
      }

      sql += " WHERE tt.version_id = ?";
      params.push(versionId);
    }
  }

  sql += `
    ORDER BY FIELD(tt.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
             tt.start_time
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Timetable load failed:", err);
      return res.status(500).json({ error: "Could not load timetable" });
    }

    res.json(rows);
  });
}
function validateTimetable(body) {
  const days = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday",
  ];

  const day = String(body.day_of_week || "");
  const start = String(body.start_time || "");
  const end = String(body.end_time || "");

  const courseId =
    body.course_id === "" || body.course_id == null
      ? null
      : Number(body.course_id);

  const teacherId =
    body.teacher_id === "" || body.teacher_id == null
      ? null
      : Number(body.teacher_id);

  const versionId =
    body.version_id === "" || body.version_id == null
      ? null
      : Number(body.version_id);

  const roomId =
    body.room_id === "" || body.room_id == null
      ? null
      : Number(body.room_id);

  const sectionId =
    body.section_id === "" || body.section_id == null
      ? null
      : Number(body.section_id);

  const sessionType = String(body.session_type || "lecture").trim().toLowerCase();
  const validSessionTypes = ["lecture", "lab", "tutorial", "exam", "other"];

  if (
    !days.includes(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) ||
    start >= end ||
    !String(body.semester || "").trim() ||
    !String(body.academic_year || "").trim() ||
    (courseId !== null &&
      (!Number.isInteger(courseId) || courseId < 1)) ||
    (teacherId !== null &&
      (!Number.isInteger(teacherId) || teacherId < 1)) ||
    (versionId !== null && (!Number.isInteger(versionId) || versionId < 1)) ||
    (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) ||
    (sectionId !== null && (!Number.isInteger(sectionId) || sectionId < 1)) ||
    !validSessionTypes.includes(sessionType)
  ) {
    return {
      error: "Please provide a valid day, time, semester and academic year.",
    };
  }

  const effectiveFrom = body.effective_from || null;
  const effectiveUntil = body.effective_until || null;

  if (
    (effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveFrom))) ||
    (effectiveUntil && !/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveUntil))) ||
    (effectiveFrom && effectiveUntil && effectiveFrom > effectiveUntil)
  ) {
    return { error: "Please provide a valid timetable effective date range." };
  }

  return {
    day,
    start,
    end,
    courseId,
    teacherId,
    versionId,
    roomId,
    sectionId,
    sessionType,
    effectiveFrom,
    effectiveUntil,
    room: String(body.room || "").trim().slice(0, 60) || null,
    semester: String(body.semester).trim().slice(0, 60),
    academicYear: String(body.academic_year).trim().slice(0, 30),
  };
}
function getTimetable(req, res) {
  loadTimetable(req, res);
}

async function acquireTimetableWriteLock(connection) {
  const [rows] = await connection.query(
    "SELECT GET_LOCK('greenfield_timetable_write', 15) AS acquired"
  );

  if (!rows.length || Number(rows[0].acquired) !== 1) {
    const error = new Error("Timetable is busy. Please try again.");
    error.code = "TIMETABLE_LOCK_TIMEOUT";
    throw error;
  }
}

async function releaseTimetableWriteLock(connection) {
  await connection.query(
    "SELECT RELEASE_LOCK('greenfield_timetable_write')"
  );
}

async function findTimetableConflict(connection, values, excludeId = null) {
  const excludeSql = excludeId === null ? "" : " AND id <> ?";
  const params = [
    values.day,
    values.academicYear,
    values.semester,
    values.end,
    values.start,
    values.effectiveFrom ?? null,
    values.effectiveFrom ?? null,
    values.effectiveUntil ?? null,
    values.effectiveUntil ?? null,
    values.versionId ?? null,
    values.versionId ?? null,
  ];

  if (excludeId !== null) params.push(excludeId);

  const [rows] = await connection.query(
    `SELECT id, teacher_id, room, room_id, section_id FROM timetable_entries
     WHERE day_of_week = ?
       AND academic_year = ?
       AND semester = ?
       AND start_time < ?
       AND end_time > ?
       AND (effective_until IS NULL OR ? IS NULL OR effective_until >= ?)
       AND (effective_from IS NULL OR ? IS NULL OR effective_from <= ?)
       AND ((? IS NULL AND version_id IS NULL) OR version_id = ?)
       ${excludeSql}
     FOR UPDATE`,
    params
  );

  const normalizedRoom = String(values.room || "").trim().toLowerCase();

  for (const row of rows) {
    if (
      values.sectionId !== null &&
      row.section_id !== null &&
      Number(row.section_id) === values.sectionId
    ) {
      return {
        type: "section",
        error: "This section already has another class during the selected time.",
      };
    }

    if (
      values.roomId !== null &&
      row.room_id !== null &&
      Number(row.room_id) === values.roomId
    ) {
      return {
        type: "room",
        error: "This room is already booked during the selected time.",
      };
    }

    if (
      values.teacherId !== null &&
      row.teacher_id !== null &&
      Number(row.teacher_id) === values.teacherId
    ) {
      return {
        type: "teacher",
        error: "This teacher already has another class during the selected time.",
      };
    }

    if (
      normalizedRoom &&
      row.room &&
      String(row.room).trim().toLowerCase() === normalizedRoom
    ) {
      return {
        type: "room",
        error: "This room is already booked during the selected time.",
      };
    }
  }

  return null;
}
async function findTeacherAvailabilityConflict(connection, values) {
  if (!values.teacherId) return null;

  const [rows] = await connection.query(
    `SELECT id, start_time, end_time, availability_type,
            DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
            DATE_FORMAT(effective_until, '%Y-%m-%d') AS effective_until
     FROM teacher_availability
     WHERE teacher_id = ?
       AND day_of_week = ?
       AND (effective_until IS NULL OR ? IS NULL OR effective_until >= ?)
       AND (effective_from IS NULL OR ? IS NULL OR effective_from <= ?)
     ORDER BY start_time`,
    [
      values.teacherId,
      values.day,
      values.effectiveFrom ?? null,
      values.effectiveFrom ?? null,
      values.effectiveUntil ?? null,
      values.effectiveUntil ?? null
    ]
  );

  const normalizeTime = value => {
    const time = String(value);
    return time.length === 5 ? `${time}:00` : time.slice(0, 8);
  };

  const start = normalizeTime(values.start);
  const end = normalizeTime(values.end);

  const unavailable = rows.find(row =>
    row.availability_type === "unavailable" &&
    normalizeTime(row.start_time) < end &&
    normalizeTime(row.end_time) > start
  );

  if (unavailable) {
    return {
      type: "teacher_unavailable",
      error: "This teacher is marked unavailable during the selected time."
    };
  }

  const availableRows = rows.filter(row => {
    if (row.availability_type !== "available") return false;

    const coversStart = values.effectiveFrom
      ? (!row.effective_from || row.effective_from <= String(values.effectiveFrom).slice(0, 10))
      : !row.effective_from;

    const coversEnd = values.effectiveUntil
      ? (!row.effective_until || row.effective_until >= String(values.effectiveUntil).slice(0, 10))
      : !row.effective_until;

    return coversStart && coversEnd;
  });

  if (
    availableRows.length > 0 &&
    !availableRows.some(row =>
      normalizeTime(row.start_time) <= start &&
      normalizeTime(row.end_time) >= end
    )
  ) {
    return {
      type: "outside_available_hours",
      error: "The selected class time is outside this teacher's available hours."
    };
  }

  return null;
}
async function validateRoomAndSection(connection, values) {
  let section = null;
  let room = null;

  if (values.sectionId !== null) {
    const [sections] = await connection.query(
      `SELECT s.id, s.status, s.semester_id, s.capacity, sem.semester_name,
              b.academic_year_id, p.department_id
       FROM sections s
       INNER JOIN semesters sem ON sem.id = s.semester_id
       INNER JOIN batches b ON b.id = s.batch_id
       INNER JOIN programs p ON p.id = b.program_id
       WHERE s.id = ? FOR UPDATE`,
      [values.sectionId]
    );

    if (!sections.length || String(sections[0].status).toLowerCase() !== "active") {
      return { error: "Selected section does not exist or is inactive." };
    }
    section = sections[0];

    if (String(section.semester_name).trim().toLowerCase() !== String(values.semester).trim().toLowerCase()) {
      return { error: "Selected section does not belong to the timetable semester." };
    }

    if (values.versionId !== null) {
      const [versions] = await connection.query(
        "SELECT department_id, academic_year_id, semester_id FROM timetable_versions WHERE id = ? LIMIT 1",
        [values.versionId]
      );
      if (!versions.length) return { error: "Selected timetable version does not exist." };
      const version = versions[0];
      if (Number(section.semester_id) !== Number(version.semester_id) ||
          Number(section.academic_year_id) !== Number(version.academic_year_id) ||
          Number(section.department_id) !== Number(version.department_id)) {
        return { error: "Selected section does not belong to this timetable version academic structure." };
      }
    }

    const [enrollmentRows] = await connection.query(
      `SELECT COUNT(*) AS enrolled_count
       FROM student_enrollments
       WHERE section_id = ? AND LOWER(status) = 'active'`,
      [values.sectionId]
    );
    const enrolledCount = Number(enrollmentRows[0]?.enrolled_count || 0);
    const sectionCapacity = section.capacity == null ? null : Number(section.capacity);
    if (sectionCapacity !== null && sectionCapacity > 0 && enrolledCount > sectionCapacity) {
      return {
        error: `Section capacity exceeded: ${enrolledCount} active students are enrolled, but the section capacity is ${sectionCapacity}.`,
        validation: "section_capacity",
        enrolled_count: enrolledCount,
        section_capacity: sectionCapacity
      };
    }
    values.enrolledCount = enrolledCount;
    values.sectionCapacity = sectionCapacity;
  }

  if (values.roomId !== null) {
    const [rooms] = await connection.query(
      "SELECT id, room_code, room_type, capacity, status FROM rooms WHERE id = ? FOR UPDATE",
      [values.roomId]
    );
    if (!rooms.length || String(rooms[0].status).toLowerCase() !== "active") {
      return { error: "Selected room does not exist or is inactive." };
    }
    room = rooms[0];

    const classSize = values.enrolledCount ?? null;
    const roomCapacity = room.capacity == null ? null : Number(room.capacity);
    if (classSize !== null && roomCapacity !== null && roomCapacity > 0 && classSize > roomCapacity) {
      return {
        error: `Room capacity insufficient: ${classSize} active students are enrolled, but ${room.room_code} accommodates ${roomCapacity}.`,
        validation: "room_capacity",
        enrolled_count: classSize,
        room_capacity: roomCapacity,
        room_code: room.room_code
      };
    }
    if (values.sessionType === "lab" && room.room_type !== "laboratory") {
      return {
        error: `Laboratory sessions must use a laboratory room. ${room.room_code} is classified as ${room.room_type}.`,
        validation: "lab_room_compatibility",
        room_type: room.room_type
      };
    }
  } else if (values.sessionType === "lab") {
    return {
      error: "A laboratory room must be selected for a lab session.",
      validation: "lab_room_required"
    };
  }

  return null;
}

async function createTimetable(req, res) {
  const v = validateTimetable(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });

  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();
    await acquireTimetableWriteLock(connection);
    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;

    const resourceError = await validateRoomAndSection(connection, v);
    if (resourceError) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json(resourceError);
    }

    if (v.versionId !== null) {
      const [versions] = await connection.query(
        `SELECT tv.id, tv.status, ay.year_name, s.semester_name
         FROM timetable_versions tv
         INNER JOIN academic_years ay ON ay.id = tv.academic_year_id
         INNER JOIN semesters s ON s.id = tv.semester_id
         WHERE tv.id = ?
         FOR UPDATE`,
        [v.versionId]
      );

      if (!versions.length) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({
          error: "Timetable version not found.",
        });
      }

      const version = versions[0];

      if (version.status !== "draft") {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          error: "Entries can only be added to a draft version.",
        });
      }

      if (
        String(version.year_name).trim() !== v.academicYear ||
        String(version.semester_name).trim() !== v.semester
      ) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({
          error: "The timetable entry academic year and semester must match the selected version.",
        });
      }
    }

    const conflict = await findTimetableConflict(connection, v);

    if (conflict) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: conflict.error });
    }

    const availabilityConflict =
      await findTeacherAvailabilityConflict(connection, v);

    if (availabilityConflict) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: availabilityConflict.error,
        conflict: availabilityConflict.type
      });
    }

    const [result] = await connection.query(
      `INSERT INTO timetable_entries
       (day_of_week, start_time, end_time, course_id, teacher_id,
        room, room_id, section_id, semester, academic_year,
        version_id, effective_from, effective_until, session_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.day,
        v.start,
        v.end,
        v.courseId,
        v.teacherId,
        v.room,
        v.roomId,
        v.sectionId,
        v.semester,
        v.academicYear,
        v.versionId,
        v.effectiveFrom,
        v.effectiveUntil,
        v.sessionType
      ]
    );

    await connection.commit();
    transactionStarted = false;

    writeAuditLog(req, {
      action: "TIMETABLE_CREATED",
      entityType: "timetable",
      entityId: result.insertId,
      newValues: {
        day_of_week: v.day,
        start_time: v.start,
        end_time: v.end,
        course_id: v.courseId,
        teacher_id: v.teacherId,
        room: v.room,
        room_id: v.roomId,
        section_id: v.sectionId,
        semester: v.semester,
        academic_year: v.academicYear,
        version_id: v.versionId,
        session_type: v.sessionType,
      },
    });

    loadTimetable(req, res);
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Timetable create rollback failed:", rollbackError);
      }
    }

    console.error("Timetable create failed:", error);

    if (!res.headersSent) {
      const busy = error.code === "TIMETABLE_LOCK_TIMEOUT";
      res.status(busy ? 409 : 500).json({
        error: busy ? error.message : "Could not create timetable entry",
      });
    }
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await releaseTimetableWriteLock(connection);
        } catch (error) {
          console.error("Timetable lock release failed:", error);
        }
      }
      connection.release();
    }
  }
}
async function updateTimetable(req, res) {
  const v = validateTimetable(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });

  const timetableId = Number(req.params.id);
  if (!Number.isInteger(timetableId) || timetableId < 1) {
    return res.status(400).json({ error: "Invalid timetable entry ID" });
  }

  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();
    await acquireTimetableWriteLock(connection);
    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;

    const resourceError = await validateRoomAndSection(connection, v);
    if (resourceError) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json(resourceError);
    }

    const [rows] = await connection.query(
      "SELECT * FROM timetable_entries WHERE id = ? FOR UPDATE",
      [timetableId]
    );

    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Timetable entry not found" });
    }

    const oldValues = rows[0];

    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "version_id") &&
      (v.versionId ?? null) !== (oldValues.version_id == null ? null : Number(oldValues.version_id))
    ) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: "A timetable entry cannot be moved between versions."
      });
    }

    if (oldValues.version_id !== null) {
      const [versionRows] = await connection.query(
        "SELECT id, status FROM timetable_versions WHERE id = ? FOR UPDATE",
        [oldValues.version_id]
      );

      if (!versionRows.length || versionRows[0].status !== "draft") {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          error: "Only draft timetable versions can be edited."
        });
      }
    }

    const conflictValues = {
      ...v,
      versionId: oldValues.version_id == null ? null : Number(oldValues.version_id),
      effectiveFrom: Object.prototype.hasOwnProperty.call(req.body || {}, "effective_from")
        ? v.effectiveFrom : oldValues.effective_from,
      effectiveUntil: Object.prototype.hasOwnProperty.call(req.body || {}, "effective_until")
        ? v.effectiveUntil : oldValues.effective_until
    };

    const conflict = await findTimetableConflict(connection, conflictValues, timetableId);
    if (conflict) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: conflict.error });
    }

    const availabilityConflict =
      await findTeacherAvailabilityConflict(connection, conflictValues);

    if (availabilityConflict) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        error: availabilityConflict.error,
        conflict: availabilityConflict.type
      });
    }

    const [result] = await connection.query(
      `UPDATE timetable_entries
       SET day_of_week=?, start_time=?, end_time=?, course_id=?, teacher_id=?,
           room=?, room_id=?, section_id=?, semester=?, academic_year=?,
           effective_from=?, effective_until=?, session_type=?
       WHERE id=?`,
      [
        v.day, v.start, v.end, v.courseId, v.teacherId, v.room,
        v.roomId, v.sectionId, v.semester, v.academicYear,
        conflictValues.effectiveFrom, conflictValues.effectiveUntil,
        v.sessionType, timetableId
      ]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Timetable entry not found" });
    }

    await connection.commit();
    transactionStarted = false;

    writeAuditLog(req, {
      action: "TIMETABLE_UPDATED",
      entityType: "timetable",
      entityId: timetableId,
      oldValues,
      newValues: {
        day_of_week: v.day,
        start_time: v.start,
        end_time: v.end,
        course_id: v.courseId,
        teacher_id: v.teacherId,
        room: v.room,
        room_id: v.roomId,
        section_id: v.sectionId,
        semester: v.semester,
        academic_year: v.academicYear,
        session_type: v.sessionType,
      },
    });

    loadTimetable(req, res);
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Timetable update rollback failed:", rollbackError);
      }
    }
    console.error("Timetable update failed:", error);
    if (!res.headersSent) {
      const busy = error.code === "TIMETABLE_LOCK_TIMEOUT";
      res.status(busy ? 409 : 500).json({
        error: busy ? error.message : "Could not update timetable entry",
      });
    }
  } finally {
    if (connection) {
      if (lockAcquired) {
        try { await releaseTimetableWriteLock(connection); } catch (error) {
          console.error("Timetable lock release failed:", error);
        }
      }
      connection.release();
    }
  }
}
async function deleteTimetable(req, res) {
  const timetableId = Number(req.params.id);
  if (!Number.isInteger(timetableId) || timetableId < 1) {
    return res.status(400).json({ error: "Invalid timetable entry ID" });
  }

  let connection;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    connection = await db.promise().getConnection();
    await acquireTimetableWriteLock(connection);
    lockAcquired = true;
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query(
      "SELECT * FROM timetable_entries WHERE id = ? FOR UPDATE",
      [timetableId]
    );

    if (!rows.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Timetable entry not found" });
    }

    const oldValues = rows[0];

    if (oldValues.version_id !== null) {
      const [versionRows] = await connection.query(
        "SELECT id, status FROM timetable_versions WHERE id = ? FOR UPDATE",
        [oldValues.version_id]
      );

      if (!versionRows.length || versionRows[0].status !== "draft") {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          error: "Only draft timetable versions can be deleted."
        });
      }
    }

    const [result] = await connection.query(
      "DELETE FROM timetable_entries WHERE id = ?",
      [timetableId]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Timetable entry not found" });
    }

    await connection.commit();
    transactionStarted = false;

    writeAuditLog(req, {
      action: "TIMETABLE_DELETED",
      entityType: "timetable",
      entityId: timetableId,
      oldValues,
    });

    res.json({ success: true });
  } catch (error) {
    if (transactionStarted && connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Timetable delete rollback failed:", rollbackError);
      }
    }
    console.error("Timetable delete failed:", error);
    if (!res.headersSent) {
      const busy = error.code === "TIMETABLE_LOCK_TIMEOUT";
      res.status(busy ? 409 : 500).json({
        error: busy ? error.message : "Could not delete timetable entry",
      });
    }
  } finally {
    if (connection) {
      if (lockAcquired) {
        try { await releaseTimetableWriteLock(connection); } catch (error) {
          console.error("Timetable lock release failed:", error);
        }
      }
      connection.release();
    }
  }
}
module.exports = {
  getTimetable,
  createTimetable,
  updateTimetable,
  deleteTimetable,
};
