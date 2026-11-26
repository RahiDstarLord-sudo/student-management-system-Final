-- Enforce uniqueness for teacher course offerings, including NULL dimensions.

ALTER TABLE teacher_courses
    ADD COLUMN normalized_academic_year_id INT NOT NULL DEFAULT 0,
    ADD COLUMN normalized_semester_id INT NOT NULL DEFAULT 0,
    ADD COLUMN normalized_section VARCHAR(30)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_general_ci
        NOT NULL DEFAULT '';

CREATE TRIGGER trg_teacher_courses_normalize_insert
BEFORE INSERT ON teacher_courses
FOR EACH ROW
SET
    NEW.normalized_academic_year_id = COALESCE(NEW.academic_year_id, 0),
    NEW.normalized_semester_id = COALESCE(NEW.semester_id, 0),
    NEW.normalized_section = COALESCE(NULLIF(TRIM(NEW.section), ''), '');

CREATE TRIGGER trg_teacher_courses_normalize_update
BEFORE UPDATE ON teacher_courses
FOR EACH ROW
SET
    NEW.normalized_academic_year_id = COALESCE(NEW.academic_year_id, 0),
    NEW.normalized_semester_id = COALESCE(NEW.semester_id, 0),
    NEW.normalized_section = COALESCE(NULLIF(TRIM(NEW.section), ''), '');

UPDATE teacher_courses
SET
    normalized_academic_year_id = COALESCE(academic_year_id, 0),
    normalized_semester_id = COALESCE(semester_id, 0),
    normalized_section = COALESCE(NULLIF(TRIM(section), ''), '');

ALTER TABLE teacher_courses
    DROP INDEX unique_teacher_course_offering,
    ADD UNIQUE KEY unique_teacher_course_offering (
        teacher_id,
        course_id,
        normalized_academic_year_id,
        normalized_semester_id,
        normalized_section
    );
