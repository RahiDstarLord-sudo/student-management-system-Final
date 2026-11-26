require("dotenv").config();
const db = require("./src/config/db");

(async () => {
  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    async function getOrCreate(table, key, value, fields, values) {
      const [found] = await conn.query(
        `SELECT id FROM ${table} WHERE ${key} = ? LIMIT 1`, [value]
      );
      if (found.length) return found[0].id;

      const columns = Object.keys(fields);
      const params = Object.values(fields);
      const placeholders = columns.map(() => "?").join(",");
      const [result] = await conn.query(
        `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`,
        params
      );
      return result.insertId;
    }

    const facultyId = await getOrCreate(
      "faculties", "faculty_code", "FAC-ENG-TEST",
      { faculty_code: "FAC-ENG-TEST", faculty_name: "Faculty of Engineering (TEST)",
        description: "Test record for capacity validation", status: "Active" }
    );

    await conn.query(
      "UPDATE departments SET faculty_id = ? WHERE id = 1 AND faculty_id IS NULL",
      [facultyId]
    );

    const [dept] = await conn.query(
      "SELECT id, faculty_id, status FROM departments WHERE id = 1"
    );
    if (!dept.length || Number(dept[0].faculty_id) !== facultyId || dept[0].status !== "Active") {
      throw new Error("CSE department is not linked to the test faculty or is inactive.");
    }

    const programId = await getOrCreate(
      "programs", "program_code", "BSCS-CSE-TEST",
      { department_id: 1, program_code: "BSCS-CSE-TEST",
        program_name: "BSc in CSE (TEST)", degree_level: "Bachelor",
        duration_semesters: 8, status: "Active" }
    );

    const [program] = await conn.query(
      "SELECT department_id FROM programs WHERE id = ?", [programId]
    );
    if (Number(program[0].department_id) !== 1) throw new Error("Test program belongs to another department.");

    const batchId = await getOrCreate(
      "batches", "batch_code", "CSE-2026-TEST",
      { program_id: programId, academic_year_id: 1,
        batch_code: "CSE-2026-TEST", admission_year: 2026, status: "Active" }
    );

    const [batch] = await conn.query(
      "SELECT program_id, academic_year_id FROM batches WHERE id = ?", [batchId]
    );
    if (Number(batch[0].program_id) !== programId || Number(batch[0].academic_year_id) !== 1) {
      throw new Error("Existing test batch has unexpected relationships.");
    }

    const [sections] = await conn.query(
      "SELECT id FROM sections WHERE batch_id = ? AND semester_id = 1 AND section_code = 'A-TEST'",
      [batchId]
    );
    let sectionId = sections[0]?.id;
    if (!sectionId) {
      const [r] = await conn.query(
        `INSERT INTO sections (batch_id, semester_id, section_code, section_name, capacity, status)
         VALUES (?, 1, 'A-TEST', 'CSE Section A (TEST)', 2, 'Active')`, [batchId]
      );
      sectionId = r.insertId;
    }

    const rooms = [
      ["CSE-ROOM-TEST", "CSE Classroom (TEST)", "classroom", 2],
      ["CSE-LAB-TEST", "CSE Laboratory (TEST)", "laboratory", 2]
    ];

    for (const [code, name, type, capacity] of rooms) {
      const [existing] = await conn.query(
        "SELECT id FROM rooms WHERE room_code = ?", [code]
      );
      if (!existing.length) {
        await conn.query(
          `INSERT INTO rooms (room_code, room_name, room_type, capacity, status)
           VALUES (?, ?, ?, ?, 'Active')`, [code, name, type, capacity]
        );
      }
    }

    await conn.commit();
    console.log("TEST STRUCTURE CREATED / VERIFIED");
    console.log({ facultyId, programId, batchId, sectionId });
    console.table(await conn.query(
      "SELECT id, room_code, room_type, capacity FROM rooms WHERE room_code IN ('CSE-ROOM-TEST','CSE-LAB-TEST')"
    ).then(x => x[0]));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
})().catch(error => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
