
const express = require("express");
const router = express.Router();

const {
  getAcademicYears,
  createAcademicYear,
  updateAcademicYear,
} = require("../controllers/academicYearController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

router.get(
  "/academic-years",
  requireAuth,
  requirePermission("academic_years.manage"),
  getAcademicYears
);

router.post(
  "/academic-years",
  requireAuth,
  requirePermission("academic_years.manage"),
  createAcademicYear
);

router.put(
  "/academic-years/:id",
  requireAuth,
  requirePermission("academic_years.manage"),
  updateAcademicYear
);

module.exports = router;
