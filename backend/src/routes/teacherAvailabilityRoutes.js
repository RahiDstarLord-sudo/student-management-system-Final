const express = require("express");
const router = express.Router();

const {
  listAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability
} = require("../controllers/teacherAvailabilityController");

const {
  requireAuth,
  requireRole,
  requirePermission
} = require("../middleware/authMiddleware");

router.use(requireAuth, requireRole("admin"), requirePermission("teachers.manage"));

router.get("/", listAvailability);
router.post("/", createAvailability);
router.put("/:id", updateAvailability);
router.delete("/:id", deleteAvailability);

module.exports = router;
