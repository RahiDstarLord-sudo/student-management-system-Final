
const express = require("express");
const router = express.Router();

const {
  getTeachers,
  updateTeacher,
  deleteTeacher,
  getTeacherCourseAssignments,
  assignCourseToTeacher,
  updateTeacherCourseAssignment,
  deleteTeacherCourseAssignment,
  getMyTeacherProfile,
  getMyTeacherProfileForEdit,
  submitMyTeacherProfile,
  getTeacherProfileRequests,
  reviewTeacherProfileRequest,
  getMyTeacherCourses,
  getMyTeacherStudents,
  getMyTeacherTimetable,
} = require("../controllers/teacherController");

const {
  requireAuth,
  requireTeacher,
  requireRole,
  requirePermission,
} = require("../middleware/authMiddleware");

// Teacher profile self-service and administrator approval
router.get("/me/profile", requireAuth, requireTeacher, getMyTeacherProfileForEdit);
router.put("/me/profile", requireAuth, requireTeacher, submitMyTeacherProfile);
router.get("/profile-requests", requireAuth, requireRole("admin"), requirePermission("teachers.manage"), getTeacherProfileRequests);
router.patch("/profile-requests/:requestId/review", requireAuth, requireRole("admin"), requirePermission("teachers.manage"), reviewTeacherProfileRequest);

// Teacher self-service routes
router.get("/me", requireAuth, requireTeacher, getMyTeacherProfile);
router.get("/me/courses", requireAuth, requireTeacher, getMyTeacherCourses);
router.get("/me/students", requireAuth, requireTeacher, getMyTeacherStudents);
router.get("/me/timetable", requireAuth, requireTeacher, getMyTeacherTimetable);

// Teacher course assignment management
router.get(
  "/course-assignments",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  getTeacherCourseAssignments
);

router.post(
  "/:id/assign-course",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  assignCourseToTeacher
);

router.put(
  "/course-assignments/:assignmentId",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  updateTeacherCourseAssignment
);

router.delete(
  "/course-assignments/:assignmentId",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  deleteTeacherCourseAssignment
);

// Teacher management
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  getTeachers
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  updateTeacher
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  requirePermission("teachers.manage"),
  deleteTeacher
);

module.exports = router;

