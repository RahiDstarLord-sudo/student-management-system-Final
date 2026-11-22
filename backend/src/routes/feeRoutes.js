
const express = require("express");
const router = express.Router();

const {
  getAllFees,
  createFee,
  recordFeePayment,
  deleteFee,
  getMyFees,
} = require("../controllers/feeController");

const {
  requireAuth,
  requirePermission,
} = require("../middleware/authMiddleware");

const {
  requireStudent,
} = require("../controllers/leaveController");

// Staff: view all fee invoices.
router.get(
  "/fees",
  requireAuth,
  requirePermission("fees.manage"),
  getAllFees
);

// Staff: create a fee invoice.
router.post(
  "/fees",
  requireAuth,
  requirePermission("fees.manage"),
  createFee
);

// Staff: record a payment.
router.post(
  "/fees/:id/payments",
  requireAuth,
  requirePermission("fees.manage"),
  recordFeePayment
);

// Staff: delete an invoice.
router.delete(
  "/fees/:id",
  requireAuth,
  requirePermission("fees.manage"),
  deleteFee
);

// Student: view own fee invoices.
router.get("/my/fees", requireAuth, requireStudent, getMyFees);

module.exports = router;
