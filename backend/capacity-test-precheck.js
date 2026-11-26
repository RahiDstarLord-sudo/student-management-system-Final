require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const queries = [
    ["TEST SECTION ENROLLMENTS",
     "SELECT * FROM student_enrollments WHERE section_id = 3"],
    ["TIMETABLE TABLE STRUCTURE",
     "SHOW CREATE TABLE timetable_entries"],
    ["COURSES",
     "SHOW COLUMNS FROM courses"],
    ["TEACHERS",
     "SHOW COLUMNS FROM teachers"]
  ];

  for (const [title, sql] of queries) {
    const [rows] = await db.promise().query(sql);
    console.log("\n--- " + title + " ---");
    console.table(rows);
  }
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
