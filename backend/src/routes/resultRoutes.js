
const express = require("express");
const router = express.Router();

const {
  getAllResults,
  saveResult,
  getMyResults,
} = require("../controllers/resultController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const {
  requireStudent,
} = require("../controllers/leaveController");

// Admin: manage all results
router.get(
  "/results",
  requireAuth,
  requirePermission("results.manage"),
  getAllResults
);

router.post(
  "/results",
  requireAuth,
  requirePermission("results.manage"),
  saveResult
);

// Student: view own results
router.get("/my/results", requireAuth, requireStudent, getMyResults);

module.exports = router;
