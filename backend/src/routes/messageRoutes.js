
const express = require("express");
const router = express.Router();

const {
  getMessages,
  sendMessage,
  markMessageRead,
  deleteMessage,
  getMyMessages,
} = require("../controllers/messageController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const { requireStudent } = require("../controllers/leaveController");

// Admin: message management
router.get(
  "/messages",
  requireAuth,
  requirePermission("messages.manage"),
  getMessages
);

router.post(
  "/messages",
  requireAuth,
  requirePermission("messages.manage"),
  sendMessage
);

// Authenticated user: mark an owned/received message as read.
// Controller enforces recipient ownership.
router.put("/messages/:id/read", requireAuth, markMessageRead);

// Admin: delete messages (controller enforces sender ownership).
router.delete(
  "/messages/:id",
  requireAuth,
  requirePermission("messages.manage"),
  deleteMessage
);

// Student: view own messages
router.get("/my/messages", requireAuth, requireStudent, getMyMessages);

module.exports = router;
