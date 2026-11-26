require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    const [entry] = await conn.query(
      "SELECT id FROM timetable_entries WHERE id=12 AND version_id IS NULL AND section_id=3 AND room_id=4 AND session_type='lab'"
    );
    if (entry.length !== 1) throw new Error("Test timetable entry verification failed; cleanup stopped.");

    const [enrollments] = await conn.query(
      "SELECT id FROM student_enrollments WHERE remarks='TEST_CAPACITY_VALIDATION' AND section_id=3"
    );
    const actualIds = enrollments.map(r => Number(r.id)).sort((a,b) => a-b);
    if (JSON.stringify(actualIds) !== JSON.stringify([4,5,6])) {
      throw new Error("Temporary enrollment verification failed; cleanup stopped.");
    }

    const [section] = await conn.query(
      "SELECT capacity FROM sections WHERE id=3 AND section_code='A-TEST'"
    );
    if (section.length !== 1 || Number(section[0].capacity) !== 3) {
      throw new Error("Test section state unexpected; cleanup stopped.");
    }

    await conn.query("DELETE FROM timetable_entries WHERE id=12");
    await conn.query(
      "DELETE FROM student_enrollments WHERE remarks='TEST_CAPACITY_VALIDATION' AND section_id=3"
    );
    await conn.query(
      "UPDATE sections SET capacity=2 WHERE id=3 AND section_code='A-TEST'"
    );

    await conn.commit();

    const [s] = await conn.query("SELECT id, section_code, capacity FROM sections WHERE id=3");
    const [e] = await conn.query("SELECT id FROM timetable_entries WHERE id=12");
    const [n] = await conn.query(
      "SELECT id FROM student_enrollments WHERE remarks='TEST_CAPACITY_VALIDATION'"
    );

    console.log("CLEANUP SUCCESS");
    console.table(s);
    console.log("Test timetable entry remaining:", e.length);
    console.log("Temporary enrollments remaining:", n.length);
  } catch (error) {
    await conn.rollback();
    console.error("CLEANUP FAILED:", error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
