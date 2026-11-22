
const express = require("express");
const router = express.Router();

const { requireAuth, requirePermission } = require("../middleware/authMiddleware");
const { requireStudent } = require("../controllers/leaveController");

const {
  getCourseSelectionData,
  saveCourseSelection,
  getPendingCourseSelectionRequests,
  approveCourseSelectionRequest,
  rejectCourseSelectionRequest,
} = require("../controllers/studentCourseSelectionController");

// Student: view own course selection and request status
router.get(
  "/student/course-selection",
  requireAuth,
  requireStudent,
  getCourseSelectionData
);

// Student: submit course selection request
router.put(
  "/student/course-selection",
  requireAuth,
  requireStudent,
  saveCourseSelection
);

// Admin: view pending course selection requests
router.get(
  "/admin/course-selection-requests",
  requireAuth,
  requirePermission("courses.manage"),
  getPendingCourseSelectionRequests
);

// Admin: approve a course selection request
router.put(
  "/admin/course-selection-requests/:requestId/approve",
  requireAuth,
  requirePermission("courses.manage"),
  approveCourseSelectionRequest
);

// Admin: reject a course selection request
router.put(
  "/admin/course-selection-requests/:requestId/reject",
  requireAuth,
  requirePermission("courses.manage"),
  rejectCourseSelectionRequest
);

module.exports = router;
