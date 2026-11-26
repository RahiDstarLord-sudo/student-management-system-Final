require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const [rows] = await db.promise().query(
    "SELECT * FROM departments WHERE id = 1"
  );
  console.table(rows);
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
