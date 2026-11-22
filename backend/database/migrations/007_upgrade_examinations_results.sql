
-- Migration 007: Upgrade Examinations and Results
-- Database: greenfield_college
-- MariaDB 10.11+

-- Step 1: Add normalized academic references to examinations

ALTER TABLE examinations
    ADD COLUMN academic_year_id INT NULL AFTER academic_year,
    ADD COLUMN semester_id INT NULL AFTER academic_year_id,
    ADD INDEX idx_examinations_academic_year_id (academic_year_id),
    ADD INDEX idx_examinations_semester_id (semester_id);


-- Step 2: Create examination course assignments

CREATE TABLE IF NOT EXISTS exam_courses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    examination_id INT NOT NULL,
    course_id INT NOT NULL,
    teacher_course_id INT NULL,
    max_marks DECIMAL(7,2) NOT NULL DEFAULT 100.00,
    pass_marks DECIMAL(7,2) NOT NULL DEFAULT 33.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_exam_course (examination_id, course_id),
    INDEX idx_exam_courses_offering (teacher_course_id),

    CONSTRAINT fk_exam_courses_examination
        FOREIGN KEY (examination_id)
        REFERENCES examinations(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_exam_courses_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_exam_courses_teacher_course
        FOREIGN KEY (teacher_course_id)
        REFERENCES teacher_courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 3: Create examination components

CREATE TABLE IF NOT EXISTS exam_components (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_course_id BIGINT NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    max_marks DECIMAL(7,2) NOT NULL,
    pass_marks DECIMAL(7,2) NOT NULL DEFAULT 0.00,
    weight_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_exam_component (
        exam_course_id,
        component_name
    ),

    CONSTRAINT fk_exam_components_exam_course
        FOREIGN KEY (exam_course_id)
        REFERENCES exam_courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 4: Add examination course reference to existing results

ALTER TABLE results
    ADD COLUMN exam_course_id BIGINT NULL AFTER semester,
    ADD INDEX idx_results_exam_course (exam_course_id);


-- Step 5: Create result component marks

CREATE TABLE IF NOT EXISTS result_components (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    result_id INT NOT NULL,
    exam_component_id BIGINT NOT NULL,
    marks_obtained DECIMAL(7,2) NOT NULL,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_result_component (
        result_id,
        exam_component_id
    ),

    CONSTRAINT fk_result_components_result
        FOREIGN KEY (result_id)
        REFERENCES results(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_result_components_exam_component
        FOREIGN KEY (exam_component_id)
        REFERENCES exam_components(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 6: Add examination academic references

ALTER TABLE examinations
    ADD CONSTRAINT fk_examinations_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    ADD CONSTRAINT fk_examinations_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;


-- Step 7: Add result examination course relationship

ALTER TABLE results
    ADD CONSTRAINT fk_results_exam_course
        FOREIGN KEY (exam_course_id)
        REFERENCES exam_courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
