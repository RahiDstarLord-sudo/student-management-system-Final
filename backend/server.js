
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const studentRoutes = require("./src/routes/studentRoutes");
const leaveRoutes = require("./src/routes/leaveRoutes");
const courseRoutes = require("./src/routes/courseRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const resultRoutes = require("./src/routes/resultRoutes");
const feeRoutes = require("./src/routes/feeRoutes");
const teacherRoutes = require("./src/routes/teacherRoutes");
const teacherAvailabilityRoutes = require("./src/routes/teacherAvailabilityRoutes");
const timetableRoutes = require("./src/routes/timetableRoutes");
const timetableVersionRoutes = require("./src/routes/timetableVersionRoutes");
const examinationRoutes = require("./src/routes/examinationRoutes");
const examResultsWorkflowRoutes = require("./src/routes/examResultsWorkflowRoutes");
const examMarksRoutes = require("./src/routes/examMarksRoutes");
const examResultRoutes = require("./src/routes/examResultRoutes");
const messageRoutes = require("./src/routes/messageRoutes");
const passwordRoutes = require("./src/routes/passwordRoutes");
const authRoutes = require("./src/routes/authRoutes");
const departmentRoutes = require("./src/routes/departmentRoutes");
const semesterRoutes = require("./src/routes/semesterRoutes");
const academicYearRoutes = require("./src/routes/academicYearRoutes");
const studentCourseSelectionRoutes = require("./src/routes/studentCourseSelectionRoutes");
const academicStructureRoutes = require("./src/routes/academicStructureRoutes");

const db = require("./src/config/db");

const app = express();

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const isLocalhost =
        !isProduction &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

      if (isLocalhost || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "100kb" }));

app.use("/api", studentRoutes);
app.use("/api", leaveRoutes);
app.use("/api", courseRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", resultRoutes);
app.use("/api", feeRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/teacher-availability", teacherAvailabilityRoutes);
app.use("/api/timetable/versions", timetableVersionRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/examinations", examinationRoutes);
app.use("/api/exam-results", examResultsWorkflowRoutes);
app.use("/api/examinations", examMarksRoutes);
app.use("/api", examResultRoutes);
app.use("/api", messageRoutes);
app.use("/api", passwordRoutes);
app.use("/api", authRoutes);
app.use("/api", departmentRoutes);
app.use("/api", semesterRoutes);
app.use("/api", academicYearRoutes);
app.use("/api", studentCourseSelectionRoutes);
app.use("/api/academic-structure", academicStructureRoutes);

// Create the leave_requests table automatically if it does not exist yet
db.query(
  `CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  (err) => {
    if (err) console.error("Could not create leave_requests table:", err);
  }
);

// Create fee invoices first, then create payment history.
db.query(
  `CREATE TABLE IF NOT EXISTS fee_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(40) NOT NULL UNIQUE,
    student_id VARCHAR(20) NOT NULL,
    title VARCHAR(180) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fee_student (student_id),
    CONSTRAINT fk_fee_student FOREIGN KEY (student_id)
      REFERENCES students(student_id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  (invoiceErr) => {
    if (invoiceErr) {
      console.error("Could not create fee_invoices table:", invoiceErr);
      return;
    }

    console.log("Fee invoices table is ready.");

    db.query(
      `CREATE TABLE IF NOT EXISTS fee_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fee_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
        reference_no VARCHAR(100) NULL,
        paid_at DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payment_fee (fee_id),
        CONSTRAINT fk_payment_fee FOREIGN KEY (fee_id)
          REFERENCES fee_invoices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`,
      (paymentErr) => {
        if (paymentErr) {
          console.error("Could not create fee_payments table:", paymentErr);
          return;
        }

        console.log("Fee payments table is ready.");
      }
    );
  }
);

// Create attendance storage for both general attendance and teacher course sessions.
db.query(
  `CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    attendance_session_id INT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present', 'Absent', 'Late') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_attendance_student_date (student_id, attendance_date)
  ) ENGINE=InnoDB`,
  (recordsErr) => {
    if (recordsErr) {
      console.error("Could not create attendance_records table:", recordsErr);
      return;
    }

    db.query(
      `CREATE TABLE IF NOT EXISTS attendance_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_course_id INT NOT NULL,
        attendance_date DATE NOT NULL,
        status ENUM('Scheduled', 'Completed') NOT NULL DEFAULT 'Scheduled',
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_teacher_course_date (teacher_course_id, attendance_date),
        INDEX idx_attendance_session_date (attendance_date)
      ) ENGINE=InnoDB`,
      (sessionsErr) => {
        if (sessionsErr) {
          console.error("Could not create attendance_sessions table:", sessionsErr);
          return;
        }

        // Migrate existing databases without deleting prior attendance.
        db.query("SHOW COLUMNS FROM attendance_records LIKE 'attendance_session_id'", (columnErr, columns) => {
          if (columnErr) {
            console.error("Could not inspect attendance_records columns:", columnErr);
            return;
          }

          const ensureSessionColumn = (next) => {
            if (columns.length) return next();
            db.query(
              "ALTER TABLE attendance_records ADD COLUMN attendance_session_id INT NULL AFTER student_id",
              (alterErr) => {
                if (alterErr) {
                  console.error("Could not add attendance session column:", alterErr);
                  return;
                }
                next();
              }
            );
          };

          ensureSessionColumn(() => {
            db.query("SHOW INDEX FROM attendance_records WHERE Key_name = 'unique_student_day'", (indexErr, indexes) => {
              if (indexErr) {
                console.error("Could not inspect attendance indexes:", indexErr);
                return;
              }

              const ensureCourseSessionIndex = () => {
                db.query("SHOW INDEX FROM attendance_records WHERE Key_name = 'unique_student_session'", (newIndexErr, newIndexes) => {
                  if (newIndexErr) {
                    console.error("Could not inspect course attendance index:", newIndexErr);
                    return;
                  }
                  if (newIndexes.length) return;
                  db.query(
                    "ALTER TABLE attendance_records ADD UNIQUE KEY unique_student_session (attendance_session_id, student_id)",
                    (addIndexErr) => {
                      if (addIndexErr) console.error("Could not add course attendance index:", addIndexErr);
                      else console.log("Attendance storage is ready.");
                    }
                  );
                });
              };

              if (!indexes.length) return ensureCourseSessionIndex();
              db.query("ALTER TABLE attendance_records DROP INDEX unique_student_day", (dropErr) => {
                if (dropErr) {
                  console.error("Could not migrate daily attendance index:", dropErr);
                  return;
                }
                ensureCourseSessionIndex();
              });
            });
          });
        });
      }
    );
  }
);

// Create the courses table automatically if it does not exist.
db.query(
  `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(50) NOT NULL UNIQUE,
    course_name VARCHAR(255) NOT NULL,
    teacher VARCHAR(255) NOT NULL,
    credits DECIMAL(4,2) NOT NULL DEFAULT 3.00,
    department_id INT NULL,
    semester_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  (err) => {
    if (err) {
      console.error("Courses table creation failed:", err);
    } else {
      console.log("Courses table is ready.");
    }
  }
);

const createResultsTable = `
  CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    credit DECIMAL(4,2) NOT NULL DEFAULT 3.00,
    marks DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_course_semester (student_id, course_code, semester),
    INDEX idx_results_student (student_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
  )
`;

db.query(createResultsTable, (err) => {
  if (err) {
    console.error("Results table creation failed:", err);
  } else {
    console.log("Results table is ready.");
  }
});

// Create teacher records and course assignment storage.
db.query(
  `CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    phone VARCHAR(40) NULL,
    department VARCHAR(120) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  (teacherTableErr) => {
    if (teacherTableErr) {
      console.error("Could not create teachers table:", teacherTableErr);
      return;
    }

    console.log("Teachers table is ready.");

    db.query(
      `CREATE TABLE IF NOT EXISTS teacher_courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        course_id INT NOT NULL,
        academic_year_id INT NULL,
        semester_id INT NULL,
        section VARCHAR(30) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_teacher_course (teacher_id, course_id),
        INDEX idx_teacher_course_course (course_id)
      ) ENGINE=InnoDB`,
      (assignmentErr) => {
        if (assignmentErr) {
          console.error("Could not create teacher_courses table:", assignmentErr);
        } else {
          console.log("Teacher course assignments table is ready.");
        }
      }
    );
  }
);

// Academic calendar, timetable and internal messaging tables.
db.query(
  `CREATE TABLE IF NOT EXISTS examinations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    exam_type ENUM('Midterm','Final','Quiz','Practical','Supplementary') NOT NULL DEFAULT 'Midterm',
    academic_year VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('Upcoming','Ongoing','Completed','Cancelled') NOT NULL DEFAULT 'Upcoming',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_examinations_dates (start_date, end_date),
    INDEX idx_examinations_year (academic_year)
  ) ENGINE=InnoDB`,
  (err) => {
    if (err) console.error("Could not create examinations table:", err);
    else console.log("Examinations table is ready.");
  }
);

db.query(
  `CREATE TABLE IF NOT EXISTS timetable_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    course_id INT NULL,
    teacher_id INT NULL,
    room VARCHAR(60) NULL,
    semester VARCHAR(60) NOT NULL,
    academic_year VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_timetable_day_time (day_of_week, start_time),
    INDEX idx_timetable_course (course_id),
    INDEX idx_timetable_teacher (teacher_id)
  ) ENGINE=InnoDB`,
  (err) => {
    if (err) console.error("Could not create timetable_entries table:", err);
    else console.log("Timetable entries table is ready.");
  }
);

db.query(
  `CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NULL,
    recipient_role ENUM('student','staff','all_students','all_staff') NOT NULL,
    subject VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_sender (sender_id, created_at),
    INDEX idx_messages_recipient (recipient_id, is_read, created_at)
  ) ENGINE=InnoDB`,
  (err) => {
    if (err) console.error("Could not create messages table:", err);
    else console.log("Messages table is ready.");
  }
);

// Handle malformed JSON and oversized request bodies.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON request body" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  console.error("Request error:", err);
  return res.status(500).json({ error: "Internal server error" });
});


// Teacher profile data and administrator approval workflow.
db.query(
  `CREATE TABLE IF NOT EXISTS teacher_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL UNIQUE,
    profile_data JSON NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teacher_profile_updated (updated_at)
  ) ENGINE=InnoDB`,
  (err) => {
    if (err) console.error("Could not create teacher_profiles table:", err);
    else console.log("Teacher profiles table is ready.");
  }
);

db.query(
  `CREATE TABLE IF NOT EXISTS teacher_profile_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    submitted_data JSON NOT NULL,
    status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    admin_note VARCHAR(1000) NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_teacher_profile_request_status (status, created_at),
    INDEX idx_teacher_profile_request_teacher (teacher_id, status)
  ) ENGINE=InnoDB`,
  (err) => {
    if (err) console.error("Could not create teacher_profile_requests table:", err);
    else console.log("Teacher profile requests table is ready.");
  }
);

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});


