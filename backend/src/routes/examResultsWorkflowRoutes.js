
const express = require("express");
const router = express.Router();

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const {
  getExamSummary,
  setExamResultsPublished,
  getStudentExamHistory,
} = require("../controllers/examResultsWorkflowController");

// Results summary
router.get(
  "/summary",
  requireAuth,
  requirePermission("results.manage"),
  getExamSummary
);

// Publish examination results
router.post(
  "/publish",
  requireAuth,
  requirePermission("results.publish"),
  setExamResultsPublished
);

// Student examination history
router.get(
  "/student/:studentId",
  requireAuth,
  requirePermission("results.manage"),
  getStudentExamHistory
);

module.exports = router;
