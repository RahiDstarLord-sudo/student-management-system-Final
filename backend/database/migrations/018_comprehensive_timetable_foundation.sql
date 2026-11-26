-- Migration 018: Comprehensive Timetable Management Foundation
-- MariaDB 10.11+
-- Safe foundation: preserves existing academic and timetable records.

CREATE TABLE IF NOT EXISTS faculties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_code VARCHAR(30) NOT NULL UNIQUE,
    faculty_name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS faculty_id INT NULL;

CREATE TABLE IF NOT EXISTS programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    program_code VARCHAR(30) NOT NULL UNIQUE,
    program_name VARCHAR(150) NOT NULL,
    degree_level VARCHAR(50) NULL,
    duration_semesters SMALLINT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_programs_department (department_id),
    CONSTRAINT fk_programs_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    batch_code VARCHAR(40) NOT NULL,
    admission_year SMALLINT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_batch_program_year_code (program_id, academic_year_id, batch_code),
    INDEX idx_batches_academic_year (academic_year_id),
    CONSTRAINT fk_batches_program
        FOREIGN KEY (program_id) REFERENCES programs(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batches_academic_year
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    semester_id INT NOT NULL,
    section_code VARCHAR(30) NOT NULL,
    section_name VARCHAR(80) NOT NULL,
    capacity INT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_section_batch_semester_code (batch_id, semester_id, section_code),
    INDEX idx_sections_semester (semester_id),
    CONSTRAINT fk_sections_batch
        FOREIGN KEY (batch_id) REFERENCES batches(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sections_semester
        FOREIGN KEY (semester_id) REFERENCES semesters(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(40) NOT NULL UNIQUE,
    room_name VARCHAR(100) NULL,
    building VARCHAR(100) NULL,
    floor_name VARCHAR(30) NULL,
    room_type ENUM('classroom','laboratory','auditorium','online','other')
        NOT NULL DEFAULT 'classroom',
    capacity INT UNSIGNED NULL,
    has_projector BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS timetable_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    semester_id INT NOT NULL,
    version_number INT UNSIGNED NOT NULL,
    title VARCHAR(150) NULL,
    status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    effective_from DATE NULL,
    effective_until DATE NULL,
    published_at DATETIME NULL,
    published_by INT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    override_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_timetable_version (department_id, academic_year_id, semester_id, version_number),
    INDEX idx_timetable_version_status (status, academic_year_id, semester_id),
    CONSTRAINT fk_timetable_version_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_timetable_version_year
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_timetable_version_semester
        FOREIGN KEY (semester_id) REFERENCES semesters(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_timetable_version_publisher
        FOREIGN KEY (published_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_timetable_version_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_timetable_version_updater
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE timetable_entries
    ADD COLUMN IF NOT EXISTS version_id BIGINT NULL,
    ADD COLUMN IF NOT EXISTS teacher_course_id INT NULL,
    ADD COLUMN IF NOT EXISTS section_id INT NULL,
    ADD COLUMN IF NOT EXISTS room_id INT NULL,
    ADD COLUMN IF NOT EXISTS effective_from DATE NULL,
    ADD COLUMN IF NOT EXISTS effective_until DATE NULL,
    ADD COLUMN IF NOT EXISTS session_type ENUM('lecture','lab','tutorial','exam','other')
        NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS notes TEXT NULL;

CREATE TABLE IF NOT EXISTS teacher_availability (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    availability_type ENUM('available','unavailable') NOT NULL DEFAULT 'unavailable',
    effective_from DATE NULL,
    effective_until DATE NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_teacher_availability (teacher_id, day_of_week),
    CONSTRAINT fk_teacher_availability_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS academic_calendar_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    academic_year_id INT NOT NULL,
    department_id INT NULL,
    title VARCHAR(150) NOT NULL,
    event_type ENUM('holiday','exam','closure','event','other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    affects_timetable BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_calendar_dates (start_date, end_date),
    CONSTRAINT fk_calendar_year
        FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_calendar_department
        FOREIGN KEY (department_id) REFERENCES departments(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_calendar_creator
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS timetable_change_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timetable_entry_id INT NOT NULL,
    requested_by INT NOT NULL,
    requested_start_time TIME NULL,
    requested_end_time TIME NULL,
    requested_day ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NULL,
    requested_room_id INT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    review_note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_change_request_status (status, created_at),
    CONSTRAINT fk_change_request_entry
        FOREIGN KEY (timetable_entry_id) REFERENCES timetable_entries(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_change_request_requester
        FOREIGN KEY (requested_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_change_request_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_change_request_room
        FOREIGN KEY (requested_room_id) REFERENCES rooms(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing timetable rows remain intact. New foreign keys are added
-- after the foundational tables and columns have been created.

-- Connect existing academic records to the new structure.
ALTER TABLE departments
    ADD CONSTRAINT fk_departments_faculty
    FOREIGN KEY (faculty_id) REFERENCES faculties(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE teacher_courses
    ADD COLUMN IF NOT EXISTS section_id INT NULL,
    ADD INDEX idx_teacher_courses_section (section_id),
    ADD CONSTRAINT fk_teacher_courses_section
        FOREIGN KEY (section_id) REFERENCES sections(id)
        ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE student_enrollments
    ADD COLUMN IF NOT EXISTS section_id INT NULL,
    ADD INDEX idx_student_enrollments_section (section_id),
    ADD CONSTRAINT fk_student_enrollments_section
        FOREIGN KEY (section_id) REFERENCES sections(id)
        ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE timetable_entries
    ADD INDEX idx_timetable_entries_version (version_id),
    ADD INDEX idx_timetable_entries_section (section_id),
    ADD INDEX idx_timetable_entries_room (room_id),
    ADD CONSTRAINT fk_timetable_entry_version
        FOREIGN KEY (version_id) REFERENCES timetable_versions(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_timetable_entry_section
        FOREIGN KEY (section_id) REFERENCES sections(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_timetable_entry_room
        FOREIGN KEY (room_id) REFERENCES rooms(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT fk_timetable_entry_teacher_course
        FOREIGN KEY (teacher_course_id) REFERENCES teacher_courses(id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
