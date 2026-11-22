
const express = require("express");
const router = express.Router();

const { changePassword } = require("../controllers/passwordController");
const { requireAuth } = require("../middleware/authMiddleware");

router.put("/change-password", requireAuth, changePassword);

module.exports = router;

