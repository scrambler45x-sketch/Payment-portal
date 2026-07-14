const mongoose = require("mongoose");

// Mirrors the record shape already produced by the frontend's runPayment().
// Keeping field names identical means no remapping is needed when you swap
// window.storage calls for fetch() calls to this API.
const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true }, // pay_xxxxx
    orderId: { type: String, required: true }, // order_xxxxx
    amount: { type: Number, required: true }, // total charged, in paise
    subtotal: { type: Number, required: true }, // pre-GST, in paise
    tax: { type: Number, required: true }, // GST, in paise
    currency: { type: String, default: "INR" },
    plan: { type: String, required: true }, // Pulse | Core | Apex | Custom
    customer: { type: String, required: true },
    email: { type: String, required: true },
    status: {
      type: String,
      enum: ["captured", "failed", "refunding", "refunded"],
      default: "captured",
    },
    method: { type: String, enum: ["card", "upi", "netbanking"], required: true },
    last4: String, // card
    upiId: String, // upi
    bank: String, // netbanking
    mode: { type: String, default: "test" },
    timestamp: { type: Number, required: true }, // ms epoch, matches Date.now() from frontend
    refundedAt: Number,
  },
  { timestamps: true } // adds createdAt/updatedAt for free
);

module.exports = mongoose.model("Payment", paymentSchema);
