require("dotenv").config();
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const accounts = [
  { email: "admin@greenfield.edu", password: process.env.ADMIN_PASSWORD, role: "admin", studentId: null },
  { email: "olivia@example.com", password: process.env.STUDENT_PASSWORD, role: "student", studentId: "GC-2026-001" },
];

let pending = accounts.length;

accounts.forEach((account) => {
  if (!account.password) {
    console.error("Missing password in .env for", account.email);
    pending -= 1;
    if (pending === 0) db.end();
    return;
  }

  const hash = bcrypt.hashSync(account.password, 10);

  db.query(
    `INSERT INTO users (email, password_hash, role, student_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [account.email, hash, account.role, account.studentId],
    (err) => {
      if (err) {
        console.error("Failed:", account.email, err.message);
      } else {
        console.log("Created:", account.email);
      }

      pending -= 1;
      if (pending === 0) db.end();
    }
  );
});