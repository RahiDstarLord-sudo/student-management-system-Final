
const express = require("express");
const router = express.Router();

const {
  getMyAttendance,
  getAttendanceByDate,
  getAttendanceReport,
  saveAttendance,
  getTeacherAttendance,
  saveTeacherAttendance,
} = require("../controllers/attendanceController");

const {
  requireAuth,
  requireTeacher,
  requirePermission,
} = require("../middleware/authMiddleware");

const { requireStudent } = require("../controllers/leaveController");

// Student: own attendance
router.get("/my/attendance", requireAuth, requireStudent, getMyAttendance);

// Teacher: attendance for own active assignments
router.get(
  "/teacher/attendance",
  requireAuth,
  requireTeacher,
  getTeacherAttendance
);

router.put(
  "/teacher/attendance",
  requireAuth,
  requireTeacher,
  saveTeacherAttendance
);

// Admin / Super Admin: attendance management
router.get(
  "/attendance/report",
  requireAuth,
  requirePermission("attendance.manage"),
  getAttendanceReport
);

router.get(
  "/attendance",
  requireAuth,
  requirePermission("attendance.manage"),
  getAttendanceByDate
);

router.put(
  "/attendance",
  requireAuth,
  requirePermission("attendance.manage"),
  saveAttendance
);

module.exports = router;
