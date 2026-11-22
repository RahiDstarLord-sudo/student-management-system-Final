
const db = require("../config/db");
const { writeAuditLog } = require("../utils/auditLogger");

function getMessages(req, res) {
  db.query(
    `SELECT m.*, u.email AS sender_email, u.email AS sender_name, (m.sender_id = ?) AS is_sent
     FROM messages m LEFT JOIN users u ON u.id=m.sender_id
     WHERE m.sender_id=? OR m.recipient_id=?
     ORDER BY m.created_at DESC LIMIT 250`,
    [req.user.id, req.user.id, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Could not load messages" });
      res.json(rows.map(row => ({ ...row, is_read: Boolean(row.is_read) })));
    }
  );
}

function sendMessage(req, res) {
  const { recipient_role, subject, body } = req.body || {};

  if (
    !["all_students", "staff"].includes(recipient_role) ||
    !String(subject || "").trim() ||
    String(subject).length > 180 ||
    !String(body || "").trim() ||
    String(body).length > 10000
  ) {
    return res.status(400).json({
      error: "Choose a valid audience and provide a subject and message.",
    });
  }

  const role = recipient_role === "all_students" ? "student" : "staff";

  db.query(
    "SELECT id FROM users WHERE role=? AND id<>?",
    [role, req.user.id],
    (findErr, recipients) => {
      if (findErr) {
        return res.status(500).json({ error: "Could not find message recipients" });
      }

      if (!recipients.length) {
        return res.status(400).json({
          error: `There are no ${role} accounts to receive this message yet.`,
        });
      }

      const values = recipients.map(user => [
        req.user.id,
        user.id,
        role,
        subject.trim(),
        body.trim(),
      ]);

      db.query(
        "INSERT INTO messages (sender_id,recipient_id,recipient_role,subject,body) VALUES ?",
        [values],
        (err, result) => {
          if (err) return res.status(500).json({ error: "Could not send message" });

          writeAuditLog(req, {
            action: "MESSAGE_SENT",
            entityType: "message",
            entityId: result.insertId || null,
            newValues: {
              recipient_role: role,
              recipient_count: recipients.length,
              subject: subject.trim(),
            },
          });

          res.status(201).json({ success: true, recipient_count: recipients.length });
        }
      );
    }
  );
}

function markMessageRead(req, res) {
  db.query(
    "UPDATE messages SET is_read=1 WHERE id=? AND recipient_id=? AND is_read=0",
    [req.params.id, req.user.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Could not update message status" });

      if (!result.affectedRows) {
        return db.query(
          "SELECT id FROM messages WHERE id=? AND recipient_id=? AND is_read=1",
          [req.params.id, req.user.id],
          (checkErr, rows) => {
            if (checkErr) {
              return res.status(500).json({ error: "Could not update message status" });
            }

            if (!rows.length) {
              return res.status(404).json({ error: "Message not found" });
            }

            res.json({ success: true });
          }
        );
      }

      writeAuditLog(req, {
        action: "MESSAGE_MARKED_READ",
        entityType: "message",
        entityId: req.params.id,
        oldValues: { is_read: false },
        newValues: { is_read: true },
      });

      res.json({ success: true });
    }
  );
}

function deleteMessage(req, res) {
  db.query(
    "SELECT id, recipient_id, recipient_role, subject, is_read FROM messages WHERE id=? AND sender_id=?",
    [req.params.id, req.user.id],
    (selectErr, rows) => {
      if (selectErr) {
        return res.status(500).json({ error: "Could not delete message" });
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Message not found or not owned by you" });
      }

      const oldValues = rows[0];

      db.query(
        "DELETE FROM messages WHERE id=? AND sender_id=?",
        [req.params.id, req.user.id],
        (err, result) => {
          if (err) return res.status(500).json({ error: "Could not delete message" });

          if (!result.affectedRows) {
            return res.status(404).json({ error: "Message not found or not owned by you" });
          }

          writeAuditLog(req, {
            action: "MESSAGE_DELETED",
            entityType: "message",
            entityId: oldValues.id,
            oldValues,
          });

          res.json({ success: true });
        }
      );
    }
  );
}

function getMyMessages(req, res) {
  db.query(
    `SELECT m.id,m.subject,m.body,m.is_read,m.created_at,u.email AS sender_email
     FROM messages m LEFT JOIN users u ON u.id=m.sender_id
     WHERE m.recipient_id=? ORDER BY m.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Could not load your messages" });
      res.json(rows.map(row => ({ ...row, is_read: Boolean(row.is_read) })));
    }
  );
}

module.exports = {
  getMessages,
  sendMessage,
  markMessageRead,
  deleteMessage,
  getMyMessages,
};
