
const express = require("express");
const router = express.Router();

const {
  requireStudent,
  getMyLeaves,
  createLeave,
  cancelMyLeave,
  getAllLeaves,
  updateLeaveStatus,
} = require("../controllers/leaveController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// Student: own leave requests
router.get("/my/leaves", requireAuth, requireStudent, getMyLeaves);

// Student: submit a leave request
router.post("/my/leaves", requireAuth, requireStudent, createLeave);

// Student: cancel own pending request
router.delete(
  "/my/leaves/:id",
  requireAuth,
  requireStudent,
  cancelMyLeave
);

// Admin / Super Admin: list all leave requests
router.get(
  "/leaves",
  requireAuth,
  requirePermission("leaves.manage"),
  getAllLeaves
);

// Admin / Super Admin: approve or reject a request
router.put(
  "/leaves/:id",
  requireAuth,
  requirePermission("leaves.manage"),
  updateLeaveStatus
);

module.exports = router;
