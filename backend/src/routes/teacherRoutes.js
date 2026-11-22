
const express = require("express");
const router = express.Router();

const {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherCourseAssignments,
  assignCourseToTeacher,
  updateTeacherCourseAssignment,
  deleteTeacherCourseAssignment,
  getMyTeacherProfile,
  getMyTeacherCourses,
  getMyTeacherStudents,
  getMyTeacherTimetable,
} = require("../controllers/teacherController");

const {
  requireAuth,
  requireTeacher,
  requirePermission,
} = require("../middleware/authMiddleware");

// Teacher self-service routes
router.get("/me", requireAuth, requireTeacher, getMyTeacherProfile);
router.get("/me/courses", requireAuth, requireTeacher, getMyTeacherCourses);
router.get("/me/students", requireAuth, requireTeacher, getMyTeacherStudents);
router.get("/me/timetable", requireAuth, requireTeacher, getMyTeacherTimetable);

// Teacher course assignment management
router.get(
  "/course-assignments",
  requireAuth,
  requirePermission("teachers.manage"),
  getTeacherCourseAssignments
);

router.post(
  "/:id/assign-course",
  requireAuth,
  requirePermission("teachers.manage"),
  assignCourseToTeacher
);

router.put(
  "/course-assignments/:assignmentId",
  requireAuth,
  requirePermission("teachers.manage"),
  updateTeacherCourseAssignment
);

router.delete(
  "/course-assignments/:assignmentId",
  requireAuth,
  requirePermission("teachers.manage"),
  deleteTeacherCourseAssignment
);

// Teacher management
router.get(
  "/",
  requireAuth,
  requirePermission("teachers.manage"),
  getTeachers
);

router.post(
  "/",
  requireAuth,
  requirePermission("teachers.manage"),
  createTeacher
);

router.put(
  "/:id",
  requireAuth,
  requirePermission("teachers.manage"),
  updateTeacher
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("teachers.manage"),
  deleteTeacher
);

module.exports = router;
