const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  buyer_email: { type: String, required: true, lowercase: true },
  buyer_name: { type: String, default: "" },
  amount: { type: Number, required: true, min: 0 },
  coins: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "usd" },
  transaction_id: { type: String, trim: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" }
}, { timestamps: true });

paymentSchema.index(
  { transaction_id: 1 },
  { unique: true, partialFilterExpression: { transaction_id: { $gt: "" } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
