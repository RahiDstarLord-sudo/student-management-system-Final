require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const [sections] = await db.promise().query(
    "SELECT s.id, s.section_code, s.section_name, s.capacity, s.status, COUNT(e.id) AS enrolled_count FROM sections s LEFT JOIN student_enrollments e ON e.section_id=s.id AND LOWER(e.status)='active' GROUP BY s.id ORDER BY s.id"
  );

  console.log("\n--- SECTION ENROLLMENTS ---");
  console.table(sections);

  const [rooms] = await db.promise().query(
    "SELECT id, room_code, room_type, capacity, status FROM rooms ORDER BY id"
  );

  console.log("\n--- ROOM CAPACITIES ---");
  console.table(rooms);

  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
