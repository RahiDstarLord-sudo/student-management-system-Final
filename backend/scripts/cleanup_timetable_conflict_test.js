require("dotenv").config();
const db = require("../src/config/db");

(async () => {
  const conn = await db.promise().getConnection();

  const expected = {
    program: "TMP-85312965",
    batch: "TMP-85312965",
    section1: "TMP-85312965",
    section2: "TMP-S2-87623377",
    room1: "TMP-85312965",
    room2: "TMP-R2-87623377",
  };

  function verifyMarker(row, marker, label) {
    if (!row || !Object.values(row).some(v => String(v) === marker)) {
      throw new Error(`${label} verification failed. Cleanup cancelled.`);
    }
  }

  try {
    await conn.beginTransaction();

    const [versionRows] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id = 1 FOR UPDATE"
    );
    if (!versionRows.length || versionRows[0].status !== "published") {
      throw new Error("Version 1 is not published. Cleanup cancelled.");
    }

    const [entries] = await conn.query(
      "SELECT * FROM timetable_entries WHERE id = 9 FOR UPDATE"
    );
    if (entries.length !== 1) {
      throw new Error("Expected test timetable entry 9 was not found.");
    }

    const e = entries[0];
    if (
      Number(e.version_id) !== 1 ||
      Number(e.course_id) !== 5 ||
      Number(e.teacher_id) !== 7 ||
      Number(e.room_id) !== 1 ||
      Number(e.section_id) !== 1 ||
      e.day_of_week !== "Monday" ||
      String(e.start_time).slice(0, 8) !== "09:00:00" ||
      String(e.end_time).slice(0, 8) !== "10:00:00"
    ) {
      throw new Error("Timetable entry does not match our test record.");
    }

    const checks = [
      ["programs", 1, expected.program, "Program"],
      ["batches", 1, expected.batch, "Batch"],
      ["sections", 1, expected.section1, "Section 1"],
      ["sections", 2, expected.section2, "Section 2"],
      ["rooms", 1, expected.room1, "Room 1"],
      ["rooms", 2, expected.room2, "Room 2"],
    ];

    for (const [table, id, marker, label] of checks) {
      const [rows] = await conn.query(
        `SELECT * FROM ${table} WHERE id = ? FOR UPDATE`,
        [id]
      );
      verifyMarker(rows[0], marker, label);
    }

    await conn.query(
      `DELETE FROM timetable_entries
       WHERE id = 9 AND version_id = 1 AND course_id = 5
         AND teacher_id = 7 AND room_id = 1 AND section_id = 1`
    );

    await conn.query("DELETE FROM sections WHERE id IN (1, 2)");
    await conn.query("DELETE FROM rooms WHERE id IN (1, 2)");
    await conn.query("DELETE FROM batches WHERE id = 1");
    await conn.query("DELETE FROM programs WHERE id = 1");

    const [remaining] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id = 1"
    );

    if (!remaining.length || remaining[0].status !== "published") {
      throw new Error("Published version verification failed.");
    }

    await conn.commit();
    console.log("CLEANUP SUCCESS");
    console.log("Temporary timetable entry 9 removed.");
    console.log("Temporary sections, rooms, batch and program removed.");
    console.log("Published Version 1 preserved.");
  } catch (error) {
    await conn.rollback();
    console.error("CLEANUP ROLLED BACK:", error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
})();

