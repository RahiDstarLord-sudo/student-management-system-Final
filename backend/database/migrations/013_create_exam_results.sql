-- Examination-wise marks storage. Existing general results remain unchanged.
CREATE TABLE IF NOT EXISTS exam_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_course_id BIGINT NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  marks DECIMAL(7,2) NOT NULL,
  entered_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_exam_course_student (exam_course_id, student_id),
  INDEX idx_exam_results_student (student_id),
  CONSTRAINT fk_exam_results_exam_course FOREIGN KEY (exam_course_id)
    REFERENCES exam_courses(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
