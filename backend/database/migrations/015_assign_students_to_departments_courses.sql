USE greenfield_college;

-- =========================================================
-- MIGRATION 014
-- Assign Departments and Courses to Students
-- =========================================================

ALTER TABLE students
    ADD COLUMN department_id INT NULL AFTER course,
    ADD COLUMN course_id INT NULL AFTER department_id,

    ADD INDEX idx_students_department_id (department_id),
    ADD INDEX idx_students_course_id (course_id),

    ADD CONSTRAINT fk_students_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    ADD CONSTRAINT fk_students_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
        