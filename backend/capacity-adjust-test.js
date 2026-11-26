require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  try {
    const [before] = await db.promise().query(
      "SELECT id, section_code, capacity FROM sections WHERE id=3"
    );
    console.log("Before:", before);
    if (before.length !== 1 || Number(before[0].capacity) !== 2) {
      throw new Error("Unexpected section state; update cancelled.");
    }

    await db.promise().query(
      "UPDATE sections SET capacity=3 WHERE id=3"
    );

    const [after] = await db.promise().query(
      "SELECT id, section_code, capacity FROM sections WHERE id=3"
    );
    console.log("After:", after);
  } catch (error) {
    console.error(error.message);
  } finally {
    process.exit(0);
  }
})();
