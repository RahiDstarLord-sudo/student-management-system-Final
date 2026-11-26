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
    const tables = [
      "departments", "faculties", "programs", "batches", "sections",
      "academic_years", "semesters", "teachers", "users",
      "teacher_courses", "student_enrollments", "timetable_entries",
      "rooms", "timetable_versions"
    ];

    console.log("\n========== EXISTING TABLES ==========");
    const [existing] = await db.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME",
      [tables]
    );
    console.table(existing);

    console.log("\n========== RELEVANT COLUMN TYPES ==========");
    const [columns] = await db.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (?)
       AND COLUMN_NAME IN (
         'id','faculty_id','department_id','academic_year_id',
         'semester_id','teacher_id','user_id','course_id',
         'teacher_course_id','section_id','room_id','version_id'
       )
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [tables]
    );
    console.table(columns);

    console.log("\n========== EXISTING CONSTRAINT NAMES ==========");
    const [constraints] = await db.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND CONSTRAINT_NAME IN (
         'fk_departments_faculty','fk_programs_department',
         'fk_batches_program','fk_batches_academic_year',
         'fk_sections_batch','fk_sections_semester',
         'fk_teacher_courses_section','fk_student_enrollments_section',
         'fk_timetable_entry_version','fk_timetable_entry_section',
         'fk_timetable_entry_room','fk_timetable_entry_teacher_course'
       )
       ORDER BY TABLE_NAME, CONSTRAINT_NAME`
    );
    console.table(constraints);
  } finally {
    await db.end();
  }
})().catch(error => {
  console.error("PREFLIGHT ERROR:", error.message);
  process.exitCode = 1;
});
