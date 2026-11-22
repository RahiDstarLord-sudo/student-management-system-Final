
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function loadTimetable(res) {
  db.query(
    `SELECT tt.*, c.course_code, c.course_name, t.name AS teacher_name
     FROM timetable_entries tt
     LEFT JOIN courses c ON c.id = tt.course_id
     LEFT JOIN teachers t ON t.id = tt.teacher_id
     ORDER BY FIELD(tt.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), tt.start_time`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Could not load timetable" });
      }

      res.json(rows);
    }
  );
}

function validateTimetable(body) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
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
      (!Number.isInteger(teacherId) || teacherId < 1))
  ) {
    return {
      error: "Please provide a valid day, time, semester and academic year.",
    };
  }

  return {
    day,
    start,
    end,
    courseId,
    teacherId,
    room: String(body.room || "").trim().slice(0, 60) || null,
    semester: String(body.semester).trim().slice(0, 60),
    academicYear: String(body.academic_year).trim().slice(0, 30),
  };
}

function getTimetable(req, res) {
  loadTimetable(res);
}

function createTimetable(req, res) {
  const v = validateTimetable(req.body || {});

  if (v.error) {
    return res.status(400).json({ error: v.error });
  }

  db.query(
    `INSERT INTO timetable_entries
     (day_of_week,start_time,end_time,course_id,teacher_id,room,semester,academic_year)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      v.day,
      v.start,
      v.end,
      v.courseId,
      v.teacherId,
      v.room,
      v.semester,
      v.academicYear,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          error: "Could not create timetable entry",
        });
      }

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
          semester: v.semester,
          academic_year: v.academicYear,
        },
      });

      loadTimetable(res);
    }
  );
}

function updateTimetable(req, res) {
  const v = validateTimetable(req.body || {});

  if (v.error) {
    return res.status(400).json({ error: v.error });
  }

  const timetableId = Number(req.params.id);

  if (!Number.isInteger(timetableId) || timetableId < 1) {
    return res.status(400).json({ error: "Invalid timetable entry ID" });
  }

  db.query(
    "SELECT * FROM timetable_entries WHERE id = ?",
    [timetableId],
    (selectErr, rows) => {
      if (selectErr) {
        return res.status(500).json({
          error: "Could not load timetable entry",
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          error: "Timetable entry not found",
        });
      }

      const oldValues = rows[0];

      db.query(
        `UPDATE timetable_entries
         SET day_of_week=?,start_time=?,end_time=?,course_id=?,teacher_id=?,room=?,semester=?,academic_year=?
         WHERE id=?`,
        [
          v.day,
          v.start,
          v.end,
          v.courseId,
          v.teacherId,
          v.room,
          v.semester,
          v.academicYear,
          timetableId,
        ],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              error: "Could not update timetable entry",
            });
          }

          if (!result.affectedRows) {
            return res.status(404).json({
              error: "Timetable entry not found",
            });
          }

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
              semester: v.semester,
              academic_year: v.academicYear,
            },
          });

          loadTimetable(res);
        }
      );
    }
  );
}

function deleteTimetable(req, res) {
  const timetableId = Number(req.params.id);

  if (!Number.isInteger(timetableId) || timetableId < 1) {
    return res.status(400).json({ error: "Invalid timetable entry ID" });
  }

  db.query(
    "SELECT * FROM timetable_entries WHERE id = ?",
    [timetableId],
    (selectErr, rows) => {
      if (selectErr) {
        return res.status(500).json({
          error: "Could not load timetable entry",
        });
      }

      if (!rows.length) {
        return res.status(404).json({
          error: "Timetable entry not found",
        });
      }

      const oldValues = rows[0];

      db.query(
        "DELETE FROM timetable_entries WHERE id=?",
        [timetableId],
        (err, result) => {
          if (err) {
            return res.status(500).json({
              error: "Could not delete timetable entry",
            });
          }

          if (!result.affectedRows) {
            return res.status(404).json({
              error: "Timetable entry not found",
            });
          }

          writeAuditLog(req, {
            action: "TIMETABLE_DELETED",
            entityType: "timetable",
            entityId: timetableId,
            oldValues,
          });

          res.json({ success: true });
        }
      );
    }
  );
}

module.exports = {
  getTimetable,
  createTimetable,
  updateTimetable,
  deleteTimetable,
};
