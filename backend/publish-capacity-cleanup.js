require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    const [v] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id=3 AND title='CAPACITY PUBLISH TEST' AND status='draft'"
    );
    if (v.length !== 1) throw new Error("Draft verification failed; cleanup stopped.");

    const [e] = await conn.query(
      "SELECT id FROM timetable_entries WHERE id=13 AND version_id=3 AND section_id=3 AND room_id=4 AND session_type='lab'"
    );
    if (e.length !== 1) throw new Error("Draft entry verification failed; cleanup stopped.");

    const [n] = await conn.query(
      "SELECT id FROM student_enrollments WHERE remarks='TEST_PUBLISH_CAPACITY' AND section_id=3"
    );
    const ids = n.map(x => Number(x.id)).sort((a,b) => a-b);
    if (JSON.stringify(ids) !== JSON.stringify([7,8,9])) {
      throw new Error("Temporary enrollment verification failed; cleanup stopped.");
    }

    await conn.query("DELETE FROM timetable_entries WHERE id=13 AND version_id=3");
    await conn.query("DELETE FROM student_enrollments WHERE remarks='TEST_PUBLISH_CAPACITY' AND section_id=3");
    await conn.query("DELETE FROM timetable_versions WHERE id=3 AND status='draft'");

    await conn.commit();

    const [published] = await conn.query(
      "SELECT id, status FROM timetable_versions WHERE id=1"
    );
    const [draft] = await conn.query(
      "SELECT id FROM timetable_versions WHERE id=3"
    );
    const [entry] = await conn.query(
      "SELECT id FROM timetable_entries WHERE id=13"
    );
    const [enrollments] = await conn.query(
      "SELECT id FROM student_enrollments WHERE remarks='TEST_PUBLISH_CAPACITY'"
    );

    console.log("CLEANUP SUCCESS");
    console.table(published);
    console.log("Test draft remaining:", draft.length);
    console.log("Test timetable entry remaining:", entry.length);
    console.log("Temporary enrollments remaining:", enrollments.length);
  } catch (error) {
    await conn.rollback();
    console.error("CLEANUP FAILED:", error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
