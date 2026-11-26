require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  for (const table of ["faculties", "departments", "programs", "academic_years", "semesters", "batches", "sections", "rooms"]) {
    const [rows] = await db.promise().query("SELECT * FROM `" + table + "` ORDER BY id");
    console.log("\n--- " + table.toUpperCase() + " ---");
    console.table(rows);
  }
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
