const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  worker_email: { type: String, required: true, lowercase: true },
  worker_name: { type: String, required: true },
  withdrawal_coin: { type: Number, required: true, min: 200 },
  withdrawal_amount: { type: Number, required: true, min: 0 },
  payment_system: { type: String, required: true },
  account_number: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
