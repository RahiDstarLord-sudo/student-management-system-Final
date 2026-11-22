
-- Migration 003: Student Profile Tables
-- Database: greenfield_college
-- MariaDB 10.11+

CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL UNIQUE,
    date_of_birth DATE NULL,
    gender VARCHAR(30) NULL,
    phone VARCHAR(30) NULL,
    alternate_phone VARCHAR(30) NULL,
    address TEXT NULL,
    guardian_name VARCHAR(150) NULL,
    guardian_phone VARCHAR(30) NULL,
    profile_photo VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_student_profiles_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS student_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    document_type VARCHAR(80) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT UNSIGNED NULL,
    uploaded_by INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_student_documents_student (student_id),

    CONSTRAINT fk_student_documents_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_student_documents_uploader
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS student_academic_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    qualification VARCHAR(100) NOT NULL,
    institution_name VARCHAR(200) NULL,
    board_or_university VARCHAR(150) NULL,
    group_or_major VARCHAR(100) NULL,
    passing_year YEAR NULL,
    result_value DECIMAL(5,2) NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_student_academic_records_student (student_id),

    CONSTRAINT fk_student_academic_records_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS student_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    academic_year_id INT NOT NULL,
    semester_id INT NOT NULL,
    enrollment_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_student_enrollment (
        student_id,
        academic_year_id,
        semester_id
    ),

    INDEX idx_student_enrollments_year (academic_year_id),
    INDEX idx_student_enrollments_semester (semester_id),

    CONSTRAINT fk_student_enrollments_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_student_enrollments_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_student_enrollments_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS course_selections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    course_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    semester_id INT NOT NULL,
    selection_status VARCHAR(30) NOT NULL DEFAULT 'Selected',
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT NULL,

    UNIQUE KEY unique_student_course_selection (
        student_id,
        course_id,
        academic_year_id,
        semester_id
    ),

    INDEX idx_course_selections_course (course_id),
    INDEX idx_course_selections_year (academic_year_id),
    INDEX idx_course_selections_semester (semester_id),

    CONSTRAINT fk_course_selections_student
        FOREIGN KEY (student_id)
        REFERENCES students(student_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_course_selections_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_course_selections_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_course_selections_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

