require("dotenv").config();
const db = require("../src/config/db");

(async () => {
  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    const [version] = await conn.query(
      "SELECT id, status, title FROM timetable_versions WHERE id = 2 FOR UPDATE"
    );
    if (!version.length || version[0].status !== "draft" ||
        version[0].title !== "TEMP Publish Conflict Test") {
      throw new Error("Temporary draft verification failed.");
    }

    const [rows] = await conn.query(
      "SELECT id, version_id, teacher_id, start_time, end_time FROM timetable_entries WHERE id IN (10,11) ORDER BY id FOR UPDATE"
    );

    if (
      rows.length !== 2 ||
      rows.some(r => Number(r.version_id) !== 2 || Number(r.teacher_id) !== 7) ||
      String(rows[0].start_time).slice(0,8) !== "09:00:00" ||
      String(rows[0].end_time).slice(0,8) !== "10:00:00" ||
      String(rows[1].start_time).slice(0,8) !== "09:30:00" ||
      String(rows[1].end_time).slice(0,8) !== "10:30:00"
    ) {
      throw new Error("Temporary entries differ from expected test data.");
    }

    const [published] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id = 1"
    );
    if (!published.length || published[0].status !== "published") {
      throw new Error("Published Version 1 verification failed.");
    }

    await conn.query("DELETE FROM timetable_entries WHERE id IN (10,11) AND version_id = 2");
    await conn.query("DELETE FROM timetable_versions WHERE id = 2 AND status = 'draft'");

    await conn.commit();
    console.log("CLEANUP SUCCESS");
    console.log("Temporary entries 10 and 11 deleted.");
    console.log("Temporary Draft Version 2 deleted.");
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
