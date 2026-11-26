require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  for (const [name, sql] of [
    ["COURSES", "SELECT * FROM courses WHERE department_id = 1"],
    ["TEACHERS", "SELECT id, teacher_id, name, department_id, status FROM teachers WHERE department_id = 1"],
    ["TEACHER COURSES", "SELECT * FROM teacher_courses"],
    ["ENROLLMENT SCHEMA", "SHOW CREATE TABLE student_enrollments"],
    ["STUDENT COUNT", "SELECT COUNT(*) AS total FROM students"]
  ]) {
    const [rows] = await db.promise().query(sql);
    console.log("\n--- " + name + " ---");
    console.table(rows);
  }
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
