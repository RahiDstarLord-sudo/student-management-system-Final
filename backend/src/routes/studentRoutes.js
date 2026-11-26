const express = require("express");
const router = express.Router();

const {
  getAllStudents,
  updateStudent,
  deleteStudent,
  getMyProfile,
} = require("../controllers/studentController");
const {
  generateRegistrationId,
  verifyRegistration,
  submitRegistration,
  getPendingRegistrations,
  getRegistrationIds,
  approveRegistration,
  rejectRegistration,
  revokeRegistrationId,
  getRegistrationOptions,
} = require("../controllers/registrationController");
const { requireAuth, requireRole, requirePermission } = require("../middleware/authMiddleware");
const { activationRateLimit } = require("../middleware/activationRateLimit");
const { registrationRateLimit } = require("../middleware/registrationRateLimit");

// Public, read-only catalog data used by registration autocomplete controls.
router.get("/registration/options", getRegistrationOptions);
router.post("/registration/verify", activationRateLimit, verifyRegistration);
router.post("/registration/submit", registrationRateLimit, submitRegistration);

// Admin registration ID issuance and review.
router.post("/registration-ids/:type", requireAuth, requireRole("admin"), (req, res, next) => {
  const permission = req.params.type === "teacher" ? "teachers.manage" : "students.create";
  return requirePermission(permission)(req, res, next);
}, generateRegistrationId);
router.get("/admin/registration-ids", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), getRegistrationIds);
router.post("/admin/registration-ids/:type/:id/revoke", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), revokeRegistrationId);
router.get("/admin/registrations/pending", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), getPendingRegistrations);
// Backward-compatible student approval URLs.
router.put("/admin/registrations/:studentId/approve", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), (req, res, next) => {
  req.params.type = "student";
  req.params.id = req.params.studentId;
  return approveRegistration(req, res, next);
});
router.put("/admin/registrations/:studentId/reject", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), (req, res, next) => {
  req.params.type = "student";
  req.params.id = req.params.studentId;
  return rejectRegistration(req, res, next);
});

router.put("/admin/registrations/:type/:id/approve", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), approveRegistration);
router.put("/admin/registrations/:type/:id/reject", requireAuth, requireRole("admin"), requirePermission("students.registration.review"), rejectRegistration);



router.get("/students", requireAuth, requireRole("admin"), requirePermission("students.view"), getAllStudents);
router.get("/me", requireAuth, getMyProfile);
router.put("/students/:id", requireAuth, requireRole("admin"), requirePermission("students.update"), updateStudent);
// DELETE is intentionally a safe deactivation operation; records are never physically removed.
router.delete("/students/:id", requireAuth, requireRole("admin"), requirePermission("students.delete"), deleteStudent);

module.exports = router;

