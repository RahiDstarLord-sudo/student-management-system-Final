require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  for (const table of ["departments", "academic_years", "semesters", "batches"]) {
    try {
      const [rows] = await db.promise().query("SELECT * FROM " + table + " LIMIT 10");
      console.log("\n--- " + table.toUpperCase() + " ---");
      console.table(rows);
    } catch (error) {
      console.log(table + ": " + error.message);
    }
  }
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
