const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "database", "migrations");
const LOCK_NAME = "greenfield_college_schema_migrations";
const EXPECTED_DATABASE = "greenfield_college";

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.+\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function getChecksum(filePath) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function validateSequence(files) {
  if (!files.length) throw new Error("No migration files found.");
  files.forEach((name, index) => {
    const expected = String(index + 1).padStart(3, "0") + "_";
    if (!name.startsWith(expected)) {
      throw new Error(`Migration sequence gap or invalid filename at ${name}; expected prefix ${expected}`);
    }
  });
}

async function ensureHistoryTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INT UNSIGNED NULL,
      execution_type ENUM('executed','baseline') NOT NULL DEFAULT 'executed',
      notes VARCHAR(500) NULL,
      PRIMARY KEY (migration_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

const checks = [
  ["001 identity tables", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('roles','permissions','role_permissions','user_sessions','login_logs','audit_logs')`, 6],
  ["002 academic structure", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('departments','academic_years','semesters')`, 3],
  ["003 student profile tables", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('student_profiles','student_documents','student_academic_records','student_enrollments','course_selections')`, 5],
  ["004 teacher profile tables", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('teacher_profiles','teacher_documents','teacher_qualifications')`, 3],
  ["005 teacher course columns", `SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_courses' AND COLUMN_NAME IN ('academic_year_id','semester_id','section','status','created_at')`, 5],
  ["006 attendance upgrade", `SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='attendance_sessions')+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='attendance_records' AND COLUMN_NAME='attendance_session_id') n`, 2],
  ["007 examination workflow", `SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('exam_courses','exam_components','result_components'))+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='examinations' AND COLUMN_NAME IN ('academic_year_id','semester_id'))+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='results' AND COLUMN_NAME='exam_course_id') n`, 6],
  ["008 financial relationships", `SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_types')+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fee_invoices' AND COLUMN_NAME='fee_type_id') n`, 2],
  ["009 communication security", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('notices','notifications','system_settings')`, 3],
  ["010 student registration", `SELECT (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='registration_status')+(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_activation_codes')+(SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_profiles' AND COLUMN_NAME='nid' AND NON_UNIQUE=0) n`, 3],
  ["011 extended roles", `SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role' AND COLUMN_TYPE LIKE '%teacher%' AND COLUMN_TYPE LIKE '%superadmin%'`, 1],
  ["012 teacher user link", `SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers' AND COLUMN_NAME='user_id'`, 1],
  ["013 user sessions", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_sessions'`, 1],
  ["014 exam results", `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exam_results'`, 1],
  ["015 student department/course", `SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME IN ('department_id','course_id')`, 2],
  ["016 registration workflow", `SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_activation_codes')+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers' AND COLUMN_NAME IN ('department_id','registration_status','approved_at','approved_by'))+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_activation_codes' AND COLUMN_NAME IN ('status','revoked_at','created_by'))+(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='must_change_password') n`, 9],
  ["017 normalized assignment", `SELECT (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_courses' AND COLUMN_NAME IN ('normalized_academic_year_id','normalized_semester_id','normalized_section'))+(SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('trg_teacher_courses_normalize_insert','trg_teacher_courses_normalize_update'))+(SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teacher_courses' AND INDEX_NAME='unique_teacher_course_offering' AND NON_UNIQUE=0) n`, 6]
];

async function main() {
  const command = process.argv[2] || "status";
  const databaseName = process.env.DB_NAME;

  if (!databaseName) throw new Error("DB_NAME is missing from backend/.env.");
  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(`This migration runner is restricted to ${EXPECTED_DATABASE}.`);
  }
  if (!["status", "baseline-existing", "migrate"].includes(command)) {
    throw new Error("Supported commands: status, baseline-existing, migrate.");
  }

  const files = getMigrationFiles();
  validateSequence(files);

  let connection;
  let lockAcquired = false;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: databaseName,
      connectTimeout: 10000,
      multipleStatements: true
    });

    const [dbRows] = await connection.query(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version"
    );
    console.log("\n========== DATABASE ==========");
    console.log(JSON.stringify(dbRows[0], null, 2));

    if (dbRows[0].database_name !== EXPECTED_DATABASE) {
      throw new Error("Connected database does not match the protected project database.");
    }

    if (command === "baseline-existing") {
      if (files.length !== 17) {
        throw new Error("Existing-database baseline is only allowed for the original 17 migrations.");
      }

      const [lockRows] = await connection.query(
        "SELECT GET_LOCK(?, 10) AS acquired", [LOCK_NAME]
      );
      if (Number(lockRows[0].acquired) !== 1) throw new Error("Could not acquire migration lock.");
      lockAcquired = true;

      const [tableRows] = await connection.query(
        `SELECT COUNT(*) AS n FROM information_schema.TABLES
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations'`
      );

      if (Number(tableRows[0].n) === 1) {
        const [countRows] = await connection.query("SELECT COUNT(*) AS n FROM schema_migrations");
        if (Number(countRows[0].n) > 0) {
          throw new Error("Migration history already contains records. Baseline refused; no rows were added.");
        }
      }

      console.log("\n========== BASELINE PREFLIGHT ==========");
      let failed = false;
      for (const [name, sql, expected] of checks) {
        const [rows] = await connection.query(sql);
        const actual = Number(rows[0].n);
        const passed = actual === expected;
        console.log(`${passed ? "PASS" : "FAIL"} | ${name} | ${actual}/${expected}`);
        if (!passed) failed = true;
      }
      if (failed) throw new Error("Schema preflight failed. No baseline records were written.");

      await ensureHistoryTable(connection);
      await connection.beginTransaction();
      try {
        for (const name of files) {
          await connection.execute(
            `INSERT INTO schema_migrations (migration_name,checksum,execution_type,notes)
             VALUES (?,?,'baseline',?)`,
            [name, getChecksum(path.join(MIGRATIONS_DIR, name)),
              "Existing database baseline; migration SQL was not executed."]
          );
          console.log(`BASELINED | ${name}`);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      console.log("\nBaseline completed. No migration SQL was executed.");
      return;
    }

    const [tableRows] = await connection.query(
      `SELECT COUNT(*) AS n FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations'`
    );

    if (command === "status" && Number(tableRows[0].n) === 0) {
      console.log("\nNo migration history table exists. Run the approved baseline or migration setup first.");
      return;
    }

    if (command === "migrate") {
      const [lockRows] = await connection.query(
        "SELECT GET_LOCK(?, 10) AS acquired", [LOCK_NAME]
      );
      if (Number(lockRows[0].acquired) !== 1) throw new Error("Could not acquire migration lock.");
      lockAcquired = true;
      await ensureHistoryTable(connection);
    }

    const [historyRows] = await connection.query(
      `SELECT migration_name,checksum,execution_type,applied_at
       FROM schema_migrations ORDER BY migration_name`
    );
    const history = new Map(historyRows.map((row) => [row.migration_name, row]));
    const known = new Set(files);
    const orphans = [...history.keys()].filter((name) => !known.has(name));

    if (orphans.length) {
      throw new Error(`Unknown migration history record(s): ${orphans.join(", ")}`);
    }

    console.log("\n========== MIGRATION STATUS ==========");
    let pendingStarted = false;
    let pendingCount = 0;

    for (const name of files) {
      const checksum = getChecksum(path.join(MIGRATIONS_DIR, name));
      const record = history.get(name);

      if (record) {
        if (record.checksum !== checksum) {
          throw new Error(`Checksum mismatch for ${name}. File changed after being recorded; refusing to continue.`);
        }
        if (!["baseline", "executed"].includes(record.execution_type)) {
          throw new Error(`Invalid execution type recorded for ${name}.`);
        }
        if (pendingStarted) {
          throw new Error(`Migration history has a gap before recorded file ${name}. Refusing out-of-order execution.`);
        }
        console.log(`RECORDED - ${record.execution_type.toUpperCase()} - CHECKSUM OK | ${name}`);
      } else {
        pendingStarted = true;
        pendingCount++;
        console.log(`PENDING | ${name}`);
      }
    }

    console.log(`\nTotal files: ${files.length}`);
    console.log(`Recorded: ${history.size}`);
    console.log(`Pending: ${pendingCount}`);

    if (command === "status") {
      console.log("Read-only status completed. No migration SQL was executed.");
      return;
    }

    if (pendingCount === 0) {
      console.log("Database is already up to date. Nothing to execute.");
      return;
    }

    console.log("\n========== APPLYING PENDING MIGRATIONS ==========");
    for (const name of files) {
      if (history.has(name)) continue;

      const filePath = path.join(MIGRATIONS_DIR, name);
      const sql = fs.readFileSync(filePath, "utf8");
      if (!sql.trim()) throw new Error(`${name} is empty. Execution stopped.`);

      const startedAt = Date.now();
      console.log(`EXECUTING | ${name}`);

      try {
        await connection.query(sql);
      } catch (error) {
        console.error(`FAILED | ${name} | ${error.message}`);
        console.error("Migration was NOT recorded. MariaDB DDL may have partially applied; inspect the database before retrying.");
        throw error;
      }

      const duration = Date.now() - startedAt;
      await connection.execute(
        `INSERT INTO schema_migrations
          (migration_name,checksum,execution_time_ms,execution_type,notes)
         VALUES (?,?,?,'executed',?)`,
        [name, getChecksum(filePath), duration, "Applied by migration runner."]
      );
      history.set(name, { migration_name: name });
      console.log(`APPLIED | ${name} | ${duration} ms`);
    }

    console.log("\nAll pending migrations completed successfully.");
  } finally {
    if (connection) {
      if (lockAcquired) {
        try { await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]); } catch (_) {}
      }
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error("\nMigration command failed:", error.message);
  process.exitCode = 1;
});
