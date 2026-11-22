
-- Migration 006: Upgrade Attendance System
-- Database: greenfield_college
-- MariaDB 10.11+

-- Step 1: Create attendance sessions

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_course_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    topic VARCHAR(180) NULL,
    status ENUM('Scheduled', 'Completed', 'Cancelled')
        NOT NULL DEFAULT 'Scheduled',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_attendance_sessions_offering (teacher_course_id),
    INDEX idx_attendance_sessions_date (attendance_date),

    CONSTRAINT fk_attendance_sessions_offering
        FOREIGN KEY (teacher_course_id)
        REFERENCES teacher_courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_attendance_sessions_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 2: Add session reference to existing attendance records

ALTER TABLE attendance_records
    ADD COLUMN attendance_session_id BIGINT NULL
    AFTER student_id;


-- Step 3: Replace old student/day uniqueness

ALTER TABLE attendance_records
    DROP INDEX unique_student_day,
    ADD INDEX idx_attendance_records_session (
        attendance_session_id
    ),
    ADD UNIQUE KEY unique_attendance_session_student (
        attendance_session_id,
        student_id
    );


-- Step 4: Add session relationship

ALTER TABLE attendance_records
    ADD CONSTRAINT fk_attendance_records_session
        FOREIGN KEY (attendance_session_id)
        REFERENCES attendance_sessions(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
