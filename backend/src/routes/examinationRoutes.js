
const express = require("express");
const router = express.Router();

const {
  getExaminations,
  createExamination,
  updateExamination,
  deleteExamination,
  getExaminationCourses,
  assignCourseToExamination,
  removeCourseFromExamination,
} = require("../controllers/examinationController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// Examination management
router.get(
  "/",
  requireAuth,
  requirePermission("examinations.manage"),
  getExaminations
);

router.get(
  "/:id/courses",
  requireAuth,
  requirePermission("examinations.manage"),
  getExaminationCourses
);

router.post(
  "/:id/courses",
  requireAuth,
  requirePermission("examinations.manage"),
  assignCourseToExamination
);

router.delete(
  "/:id/courses/:courseId",
  requireAuth,
  requirePermission("examinations.manage"),
  removeCourseFromExamination
);

router.post(
  "/",
  requireAuth,
  requirePermission("examinations.manage"),
  createExamination
);

router.put(
  "/:id",
  requireAuth,
  requirePermission("examinations.manage"),
  updateExamination
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("examinations.manage"),
  deleteExamination
);

module.exports = router;
