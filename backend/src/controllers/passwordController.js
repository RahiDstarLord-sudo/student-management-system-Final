
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { writeAuditLog } = require("../utils/auditLogger");

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword ||
    !newPassword
  ) {
    return res.status(400).json({
      error: "Current and new password are required",
    });
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({
      error: "New password must be between 8 and 128 characters",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      error: "New password must be different from the current password",
    });
  }

  let connection;

  try {
    connection = await db.promise().getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, password_hash, role
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [req.user.id]
    );

    const user = rows[0];

    if (!user) {
      await connection.rollback();
      return res.status(404).json({
        error: "User not found",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!passwordMatches) {
      await connection.rollback();
      return res.status(400).json({
        error: "Current password is incorrect",
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear mandatory first-login password change.
    await connection.query(
      `UPDATE users
       SET password_hash = ?,
           must_change_password = 0
       WHERE id = ?`,
      [newHash, user.id]
    );

    // Keep current session alive and revoke all other active sessions.
    const [sessionResult] = await connection.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND id <> ?
         AND revoked_at IS NULL`,
      [user.id, req.sessionId]
    );

    await connection.commit();

    writeAuditLog(req, {
      action: "PASSWORD_CHANGED",
      entityType: "user",
      entityId: user.id,
      newValues: {
        passwordChanged: true,
        mandatoryPasswordChangeCompleted: true,
        otherSessionsRevoked: sessionResult.affectedRows,
      },
    });

    return res.json({
      success: true,
      mustChangePassword: false,
      message: "Password updated successfully.",
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("Password change rollback error:", rollbackErr);
      }
    }

    console.error("Password change error:", err);

    return res.status(500).json({
      error: "Could not update password",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = { changePassword };
