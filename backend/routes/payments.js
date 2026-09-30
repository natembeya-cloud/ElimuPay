const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/schools/:schoolId/payments — admin only
router.get('/schools/:schoolId/payments', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  res.json(db.listPayments(schoolId));
});

// POST /api/schools/:schoolId/payments/:paymentId/reconcile — admin only
// Manually attach an unmatched payment to a student (admin review queue action).
router.post('/schools/:schoolId/payments/:paymentId/reconcile', requireAuth, (req, res) => {
  const schoolId = Number(req.params.schoolId);
  const { studentId } = req.body || {};
  if (!studentId) return res.status(400).json({ error: 'studentId is required.' });

  const payment = db.reconcilePaymentManually(schoolId, req.params.paymentId, studentId);
  if (!payment) return res.status(404).json({ error: 'Payment or student not found.' });
  res.json(payment);
});

// POST /api/mpesa/callback
// Stand-in for Safaricom's Daraja C2B confirmation callback. In production this
// URL is registered with Daraja and Safaricom calls it after every payment to
// the school's Till/Paybill. BillRefNumber carries whatever the payer typed as
// the account number — schools should ask parents to use the student's
// admission number so this endpoint can match automatically.
//
// Body shape mirrors Daraja's C2B payload, trimmed to what we use:
// { schoolId, TransAmount, MSISDN, BillRefNumber }
router.post('/mpesa/callback', (req, res) => {
  const { schoolId, TransAmount, MSISDN, BillRefNumber } = req.body || {};
  if (!schoolId || !TransAmount || !BillRefNumber) {
    return res.status(400).json({ error: 'schoolId, TransAmount and BillRefNumber are required.' });
  }
  const school = db.getSchool(schoolId);
  if (!school) return res.status(404).json({ error: 'School not found.' });
  if (school.status === 'suspended') {
    return res.status(403).json({ error: 'This school is not currently accepting payments through ElimuPay.' });
  }

  const payment = db.receivePayment(Number(schoolId), {
    reference: BillRefNumber,
    payerPhone: MSISDN,
    amount: TransAmount,
  });

  res.status(201).json(payment);
});

// POST /api/mpesa/stk-push
// Stand-in for Daraja's STK Push (Lipa Na M-Pesa Online) request, used by the
// "Pay balance via M-Pesa" button in the parent portal. A real integration
// calls Safaricom here and the actual payment arrives later via /mpesa/callback.
// This mock completes the loop immediately so the demo works end-to-end
// without live Daraja credentials.
router.post('/mpesa/stk-push', (req, res) => {
  const { schoolId, admissionNo, phone, amount } = req.body || {};
  if (!schoolId || !admissionNo || !phone || !amount) {
    return res.status(400).json({ error: 'schoolId, admissionNo, phone and amount are required.' });
  }
  const school = db.getSchool(schoolId);
  if (!school) return res.status(404).json({ error: 'School not found.' });
  if (school.status === 'suspended') {
    return res.status(403).json({ error: 'This school is not currently accepting payments through ElimuPay.' });
  }

  const payment = db.receivePayment(Number(schoolId), {
    reference: admissionNo,
    payerPhone: phone,
    amount,
  });

  res.status(201).json({
    message: `A payment request for KSh ${amount} has been sent to ${phone}. Enter your M-Pesa PIN to complete it.`,
    payment,
  });
});

module.exports = router;
