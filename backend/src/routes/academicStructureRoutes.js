const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const controllers = require("../controllers/academicStructureController");

router.use(requireAuth, requireRole("admin"));

const resources = ["faculties", "departments", "programs", "batches", "sections", "rooms"];

for (const resource of resources) {
  router.get(`/${resource}`, controllers[resource].list);
  router.post(`/${resource}`, controllers[resource].create);
  router.put(`/${resource}/:id`, controllers[resource].update);
  router.patch(`/${resource}/:id/deactivate`, controllers[resource].deactivate);
}

module.exports = router;
