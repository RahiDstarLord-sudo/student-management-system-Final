require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  for (const table of ["faculties", "programs", "batches", "sections", "rooms"]) {
    const [rows] = await db.promise().query("SHOW CREATE TABLE `" + table + "`");
    console.log("\n--- " + table.toUpperCase() + " ---");
    console.log(rows[0]["Create Table"]);
  }
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
