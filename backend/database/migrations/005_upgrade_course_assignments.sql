
-- Migration 005: Upgrade Course Assignments
-- Database: greenfield_college
-- MariaDB 10.11+

ALTER TABLE teacher_courses
    ADD COLUMN academic_year_id INT NULL AFTER course_id,
    ADD COLUMN semester_id INT NULL AFTER academic_year_id,
    ADD COLUMN section VARCHAR(30) NULL AFTER semester_id,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active',
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE teacher_courses
    DROP INDEX unique_teacher_course,
    ADD INDEX idx_teacher_courses_academic_year (academic_year_id),
    ADD INDEX idx_teacher_courses_semester (semester_id),
    ADD UNIQUE KEY unique_teacher_course_offering (
        teacher_id,
        course_id,
        academic_year_id,
        semester_id,
        section
    );

ALTER TABLE teacher_courses
    ADD CONSTRAINT fk_teacher_courses_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    ADD CONSTRAINT fk_teacher_courses_course
        FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    ADD CONSTRAINT fk_teacher_courses_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES academic_years(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    ADD CONSTRAINT fk_teacher_courses_semester
        FOREIGN KEY (semester_id)
        REFERENCES semesters(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
