const express = require("express");
const Payment = require("../models/Payment");

const router = express.Router();

// GET /api/payments — replaces loadHistory()'s window.storage.list/get loop
router.get("/", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ timestamp: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Failed to load payments", detail: err.message });
  }
});

// POST /api/payments — replaces savePayment()
router.post("/", async (req, res) => {
  try {
    const payment = await Payment.create(req.body);
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: "Failed to save payment", detail: err.message });
  }
});

// PATCH /api/payments/:id — replaces updatePayment() / refundPayment()
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Payment.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Payment not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Failed to update payment", detail: err.message });
  }
});

module.exports = router;
