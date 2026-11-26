require("dotenv").config({ path: require("path").resolve("backend/.env") });
const mysql = require("mysql2/promise");

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const names = [
      "departments", "academic_years", "semesters", "teachers",
      "users", "teacher_courses", "student_enrollments",
      "timetable_entries", "courses"
    ];

    for (const name of names) {
      const [rows] = await db.query(
        "SHOW CREATE TABLE `" + name + "`"
      );
      console.log("\n========== " + name.toUpperCase() + " ==========");
      console.log(rows[0]["Create Table"]);
    }
  } finally {
    await db.end();
  }
})().catch(error => {
  console.error("SCHEMA CHECK ERROR:", error.message);
  process.exitCode = 1;
});
