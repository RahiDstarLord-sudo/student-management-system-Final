
const express = require("express");
const router = express.Router();

const {
  getAllDepartments,
  createDepartment,
} = require("../controllers/departmentController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// All authenticated users can view departments.
router.get("/departments", requireAuth, getAllDepartments);

// Only users with departments.manage permission can create departments.
router.post(
  "/departments",
  requireAuth,
  requirePermission("departments.manage"),
  createDepartment
);

module.exports = router;
