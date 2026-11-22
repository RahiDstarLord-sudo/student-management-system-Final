
const express = require("express");
const router = express.Router();

const {
  getTimetable,
  createTimetable,
  updateTimetable,
  deleteTimetable,
} = require("../controllers/timetableController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

// Timetable management
router.get(
  "/",
  requireAuth,
  requirePermission("timetable.manage"),
  getTimetable
);

router.post(
  "/",
  requireAuth,
  requirePermission("timetable.manage"),
  createTimetable
);

router.put(
  "/:id",
  requireAuth,
  requirePermission("timetable.manage"),
  updateTimetable
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("timetable.manage"),
  deleteTimetable
);

module.exports = router;
