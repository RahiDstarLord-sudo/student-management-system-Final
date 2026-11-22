
const express = require("express");
const router = express.Router();

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const {
  getMarksSetup,
  getExamCourseMarks,
  saveExamCourseMark,
} = require("../controllers/examMarksController");

// Exam marks management
router.get(
  "/marks/setup",
  requireAuth,
  requirePermission("exam_marks.manage"),
  getMarksSetup
);

router.get(
  "/marks",
  requireAuth,
  requirePermission("exam_marks.manage"),
  getExamCourseMarks
);

router.post(
  "/marks",
  requireAuth,
  requirePermission("exam_marks.manage"),
  saveExamCourseMark
);

module.exports = router;
