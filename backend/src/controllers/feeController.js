
const db = require("../config/db");
const { isRealDate } = require("../utils/dateUtils");
const { writeAuditLog } = require("../utils/auditLogger");

// Load fee invoices with payment history.
function loadFeeInvoices(whereSql, params, res, errorMessage) {
  const sql = `
    SELECT f.id, f.invoice_no, f.student_id, f.title, f.amount,
           DATE_FORMAT(f.due_date, '%Y-%m-%d') AS due_date,
           f.notes, f.created_at, s.name AS student_name,
           COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM fee_invoices f
    JOIN students s ON s.student_id = f.student_id
    LEFT JOIN fee_payments p ON p.fee_id = f.id
    ${whereSql}
    GROUP BY f.id
    ORDER BY f.due_date DESC, f.id DESC
  `;

  db.query(sql, params, (err, invoices) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: errorMessage });
    }

    if (invoices.length === 0) return res.json([]);

    const ids = invoices.map((invoice) => invoice.id);

    db.query(
      `SELECT id, fee_id, amount, payment_method, reference_no,
              DATE_FORMAT(paid_at, '%Y-%m-%d') AS paid_at
       FROM fee_payments
       WHERE fee_id IN (${ids.map(() => "?").join(",")})
       ORDER BY paid_at DESC, id DESC`,
      ids,
      (paymentErr, payments) => {
        if (paymentErr) {
          console.error(paymentErr);
          return res.status(500).json({ error: errorMessage });
        }

        const paymentMap = new Map();

        payments.forEach((payment) => {
          if (!paymentMap.has(payment.fee_id)) {
            paymentMap.set(payment.fee_id, []);
          }

          paymentMap.get(payment.fee_id).push(payment);
        });

        res.json(
          invoices.map((invoice) => {
            const amount = Number(invoice.amount);
            const paid = Number(invoice.paid_amount);
            const due = Math.max(0, amount - paid);

            return {
              id: invoice.id,
              invoiceNo: invoice.invoice_no,
              studentId: invoice.student_id,
              studentName: invoice.student_name,
              title: invoice.title,
              amount,
              paid,
              due,
              dueDate: invoice.due_date,
              notes: invoice.notes || "",
              status: due <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
              payments: paymentMap.get(invoice.id) || [],
            };
          })
        );
      }
    );
  });
}

// Staff: view all fee invoices.
function getAllFees(req, res) {
  loadFeeInvoices("", [], res, "Could not load fee invoices");
}

// Staff: create a fee invoice.
function createFee(req, res) {
  const { studentId, title, amount, dueDate, notes } = req.body || {};
  const numericAmount = Number(amount);
  const cleanTitle = String(title || "").trim();

  if (
    !studentId ||
    !cleanTitle ||
    cleanTitle.length > 180 ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !isRealDate(dueDate)
  ) {
    return res.status(400).json({
      error: "Provide a student, description, valid amount and due date",
    });
  }

  db.query(
    "SELECT student_id FROM students WHERE student_id = ?",
    [studentId],
    (studentErr, students) => {
      if (studentErr) {
        console.error(studentErr);
        return res.status(500).json({ error: "Could not verify student" });
      }

      if (!students.length) {
        return res.status(404).json({ error: "Student not found" });
      }

      const invoiceNo = `INV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

      db.query(
        `INSERT INTO fee_invoices
          (invoice_no, student_id, title, amount, due_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceNo,
          studentId,
          cleanTitle,
          numericAmount,
          dueDate,
          String(notes || "").trim(),
        ],
        (insertErr, result) => {
          if (insertErr) {
            console.error(insertErr);
            return res.status(500).json({
              error: "Could not create fee invoice",
            });
          }

          writeAuditLog(req, {
            action: "FEE_INVOICE_CREATED",
            entityType: "fee_invoice",
            entityId: result.insertId,
            newValues: {
              invoiceNo,
              studentId,
              title: cleanTitle,
              amount: numericAmount,
              dueDate,
              notes: String(notes || "").trim(),
            },
          });

          res.status(201).json({
            success: true,
            id: result.insertId,
            invoiceNo,
            message: "Fee invoice created successfully",
          });
        }
      );
    }
  );
}

// Staff: record a payment against an invoice.
function recordFeePayment(req, res) {
  const feeId = Number(req.params.id);
  const { amount, paymentMethod, referenceNo, paidAt } = req.body || {};
  const numericAmount = Number(amount);
  const method = String(paymentMethod || "Cash").trim();

  if (
    !Number.isInteger(feeId) ||
    feeId <= 0 ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !method ||
    method.length > 40 ||
    !isRealDate(paidAt)
  ) {
    return res.status(400).json({
      error: "Provide valid payment information",
    });
  }

  db.getConnection((connectionErr, connection) => {
    if (connectionErr) {
      console.error(connectionErr);
      return res.status(500).json({
        error: "Could not start payment transaction",
      });
    }

    connection.beginTransaction((beginErr) => {
      if (beginErr) {
        connection.release();
        return res.status(500).json({
          error: "Could not start payment transaction",
        });
      }

      connection.query(
        `SELECT f.amount, f.invoice_no, f.student_id,
                (SELECT COALESCE(SUM(p.amount), 0)
                 FROM fee_payments p WHERE p.fee_id = f.id) AS paid
         FROM fee_invoices f
         WHERE f.id = ?
         FOR UPDATE`,
        [feeId],
        (selectErr, rows) => {
          if (selectErr || !rows.length) {
            return connection.rollback(() => {
              connection.release();

              if (selectErr) console.error(selectErr);

              res.status(selectErr ? 500 : 404).json({
                error: selectErr
                  ? "Could not verify invoice"
                  : "Invoice not found",
              });
            });
          }

          const invoice = rows[0];
          const oldPaidAmount = Number(invoice.paid);
          const due = Number(invoice.amount) - oldPaidAmount;

          if (numericAmount > due + 0.001) {
            return connection.rollback(() => {
              connection.release();
              res.status(400).json({
                error: "Payment cannot exceed the outstanding balance",
              });
            });
          }

          connection.query(
            `INSERT INTO fee_payments
              (fee_id, amount, payment_method, reference_no, paid_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              feeId,
              numericAmount,
              method,
              String(referenceNo || "").trim() || null,
              paidAt,
            ],
            (insertErr, paymentResult) => {
              if (insertErr) {
                return connection.rollback(() => {
                  connection.release();
                  console.error(insertErr);
                  res.status(500).json({
                    error: "Could not record payment",
                  });
                });
              }

              connection.commit((commitErr) => {
                if (commitErr) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({
                      error: "Could not save payment",
                    });
                  });
                }

                connection.release();

                writeAuditLog(req, {
                  action: "FEE_PAYMENT_RECORDED",
                  entityType: "fee_payment",
                  entityId: paymentResult.insertId,
                  oldValues: {
                    feeId,
                    invoiceNo: invoice.invoice_no,
                    studentId: invoice.student_id,
                    paidAmount: oldPaidAmount,
                    dueAmount: due,
                  },
                  newValues: {
                    feeId,
                    invoiceNo: invoice.invoice_no,
                    studentId: invoice.student_id,
                    paymentAmount: numericAmount,
                    paymentMethod: method,
                    referenceNo: String(referenceNo || "").trim() || null,
                    paidAt,
                    paidAmount: oldPaidAmount + numericAmount,
                    dueAmount: Math.max(0, due - numericAmount),
                  },
                });

                res.status(201).json({
                  success: true,
                  message: "Payment recorded successfully",
                });
              });
            }
          );
        }
      );
    });
  });
}

// Staff: delete an invoice and its payment history.
function deleteFee(req, res) {
  const feeId = Number(req.params.id);

  if (!Number.isInteger(feeId) || feeId <= 0) {
    return res.status(400).json({ error: "Invalid invoice ID" });
  }

  db.query(
    `SELECT id, invoice_no, student_id, title, amount, due_date, notes
     FROM fee_invoices
     WHERE id = ?`,
    [feeId],
    (selectErr, rows) => {
      if (selectErr) {
        console.error(selectErr);
        return res.status(500).json({
          error: "Could not load fee invoice",
        });
      }

      if (!rows.length) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const oldInvoice = rows[0];

      db.query(
        "DELETE FROM fee_invoices WHERE id = ?",
        [feeId],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({
              error: "Could not delete fee invoice",
            });
          }

          if (!result.affectedRows) {
            return res.status(404).json({ error: "Invoice not found" });
          }

          writeAuditLog(req, {
            action: "FEE_INVOICE_DELETED",
            entityType: "fee_invoice",
            entityId: feeId,
            oldValues: {
              invoiceNo: oldInvoice.invoice_no,
              studentId: oldInvoice.student_id,
              title: oldInvoice.title,
              amount: oldInvoice.amount,
              dueDate: oldInvoice.due_date,
              notes: oldInvoice.notes,
            },
          });

          res.json({
            success: true,
            message: "Invoice deleted successfully",
          });
        }
      );
    }
  );
}

// Student: view only invoices belonging to the authenticated student.
function getMyFees(req, res) {
  loadFeeInvoices(
    "WHERE f.student_id = ?",
    [req.user.studentId],
    res,
    "Could not load your fee invoices"
  );
}

module.exports = {
  getAllFees,
  createFee,
  recordFeePayment,
  deleteFee,
  getMyFees,
};
