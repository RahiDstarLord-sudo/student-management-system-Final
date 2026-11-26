require("dotenv").config();
const db = require("../src/config/db");

(async () => {
  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    const [versions] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id = 2 FOR UPDATE"
    );
    if (!versions.length || versions[0].status !== "draft") {
      throw new Error("Test Version 2 is not draft. Aborting.");
    }

    const [rows] = await conn.query(
      "SELECT id, version_id, teacher_id, day_of_week, start_time, end_time FROM timetable_entries WHERE id IN (10, 11) ORDER BY id FOR UPDATE"
    );

    if (
      rows.length !== 2 ||
      Number(rows[0].version_id) !== 2 ||
      Number(rows[1].version_id) !== 2 ||
      Number(rows[0].teacher_id) !== 7 ||
      Number(rows[1].teacher_id) !== 7 ||
      rows[0].day_of_week !== "Monday" ||
      rows[1].day_of_week !== "Monday" ||
      String(rows[0].start_time).slice(0, 8) !== "09:00:00" ||
      String(rows[0].end_time).slice(0, 8) !== "10:00:00" ||
      String(rows[1].start_time).slice(0, 8) !== "10:00:00" ||
      String(rows[1].end_time).slice(0, 8) !== "11:00:00"
    ) {
      throw new Error("Test entries do not match expected original values. Aborting.");
    }

    await conn.query(
      "UPDATE timetable_entries SET start_time = '09:30:00', end_time = '10:30:00' WHERE id = 11 AND version_id = 2"
    );

    await conn.commit();
    console.log("CONTROLLED OVERLAP CREATED");
    console.log("Entry 10: Monday 09:00-10:00");
    console.log("Entry 11: Monday 09:30-10:30");
    console.log("Only temporary Draft Version 2 was changed.");
  } catch (error) {
    await conn.rollback();
    console.error("ABORTED:", error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
})();
