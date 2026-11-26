require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    const ids = ["GC-07AE430C4D", "GC-112F4552", "GC-2026-002"];

    for (const studentId of ids) {
      const [existing] = await conn.query(
        "SELECT id FROM student_enrollments WHERE student_id=? AND academic_year_id=1 AND semester_id=1",
        [studentId]
      );
      if (existing.length) throw new Error("Existing enrollment found: " + studentId);

      await conn.query(
        `INSERT INTO student_enrollments
         (student_id, academic_year_id, semester_id, enrollment_date, status, remarks, section_id)
         VALUES (?, 1, 1, CURDATE(), 'Active', 'TEST_PUBLISH_CAPACITY', 3)`,
        [studentId]
      );
    }

    await conn.commit();
    const [rows] = await conn.query(
      "SELECT id, student_id, section_id FROM student_enrollments WHERE remarks='TEST_PUBLISH_CAPACITY'"
    );
    console.table(rows);
  } catch (e) {
    await conn.rollback();
    console.error("SETUP FAILED:", e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
