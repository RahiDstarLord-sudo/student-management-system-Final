
const express = require("express");
const router = express.Router();

const {
  getAllCourses,
  addCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// All authenticated users can view courses.
router.get("/courses", requireAuth, getAllCourses);

// Course management
router.post(
  "/courses",
  requireAuth,
  requirePermission("courses.manage"),
  addCourse
);

router.put(
  "/courses/:id",
  requireAuth,
  requirePermission("courses.manage"),
  updateCourse
);

router.delete(
  "/courses/:id",
  requireAuth,
  requirePermission("courses.manage"),
  deleteCourse
);

module.exports = router;
