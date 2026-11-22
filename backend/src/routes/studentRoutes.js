
const express = require("express");
const router = express.Router();

const {
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getMyProfile,
} = require("../controllers/studentController");

const {
  createStudentActivation,
  verifyStudentActivation,
  submitStudentRegistration,
  getPendingRegistrations,
  approveStudentRegistration,
  rejectStudentRegistration,
} = require("../controllers/registrationController");

const {
  requireAuth,
  requireStaff,
  requirePermission,
} = require("../middleware/authMiddleware");

const { activationRateLimit } = require("../middleware/activationRateLimit");
const { registrationRateLimit } = require("../middleware/registrationRateLimit");

// Student management
router.get(
  "/students",
  requireAuth,
  requirePermission("students.view"),
  getAllStudents
);

router.post(
  "/students/activation",
  requireAuth,
  requirePermission("students.create"),
  createStudentActivation
);

// Public registration endpoints
router.post(
  "/registration/verify",
  activationRateLimit,
  verifyStudentActivation
);

router.post(
  "/registration/submit",
  registrationRateLimit,
  submitStudentRegistration
);

// Registration review
router.get(
  "/admin/registrations/pending",
  requireAuth,
  requirePermission("students.registration.review"),
  getPendingRegistrations
);

router.put(
  "/admin/registrations/:studentId/approve",
  requireAuth,
  requirePermission("students.registration.review"),
  approveStudentRegistration
);

router.put(
  "/admin/registrations/:studentId/reject",
  requireAuth,
  requirePermission("students.registration.review"),
  rejectStudentRegistration
);

// Student CRUD
router.post(
  "/students",
  requireAuth,
  requirePermission("students.create"),
  addStudent
);

router.get("/me", requireAuth, getMyProfile);

router.put(
  "/students/:id",
  requireAuth,
  requirePermission("students.update"),
  updateStudent
);

router.delete(
  "/students/:id",
  requireAuth,
  requirePermission("students.delete"),
  deleteStudent
);

module.exports = router;
