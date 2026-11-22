
const express = require("express");
const router = express.Router();

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const {
  getExamCourseStudents,
  saveExamCourseResults,
  getAllExamResults,
} = require("../controllers/examResultController");

// Exam results management
router.get(
  "/exam-results",
  requireAuth,
  requirePermission("results.manage"),
  getAllExamResults
);

router.get(
  "/exam-courses/:examCourseId/students",
  requireAuth,
  requirePermission("results.manage"),
  getExamCourseStudents
);

router.post(
  "/exam-courses/:examCourseId/results",
  requireAuth,
  requirePermission("results.manage"),
  saveExamCourseResults
);

module.exports = router;
