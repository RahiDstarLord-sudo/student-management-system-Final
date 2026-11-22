
const express = require("express");
const router = express.Router();

const {
  getAllSemesters,
  createSemester,
} = require("../controllers/semesterController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// All authenticated users can view semesters.
router.get("/semesters", requireAuth, getAllSemesters);

// Only users with semesters.manage permission can create semesters.
router.post(
  "/semesters",
  requireAuth,
  requirePermission("semesters.manage"),
  createSemester
);

module.exports = router;
