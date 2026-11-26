const express = require("express");
const router = express.Router();

const {
  getTimetableVersions,
  createTimetableVersion,
  publishTimetableVersion,
  archiveTimetableVersion
} = require("../controllers/timetableVersionController");

const {
  requireAuth,
  requirePermission
} = require("../middleware/authMiddleware");

router.use(requireAuth, requirePermission("timetable.manage"));

router.get("/", getTimetableVersions);
router.post("/", createTimetableVersion);
router.patch("/:id/publish", publishTimetableVersion);
router.patch("/:id/archive", archiveTimetableVersion);

module.exports = router;
