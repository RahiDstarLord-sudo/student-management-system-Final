require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const [students] = await db.promise().query(
    "SELECT student_id, name, department_id, status FROM students ORDER BY student_id LIMIT 15"
  );
  console.log("--- STUDENTS ---");
  console.table(students);

  const [enrollments] = await db.promise().query(
    "SELECT id, student_id, academic_year_id, semester_id, section_id, status FROM student_enrollments ORDER BY id"
  );
  console.log("--- EXISTING ENROLLMENTS ---");
  console.table(enrollments);
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
