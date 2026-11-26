const express = require("express");
const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const PAYMENT_SYSTEMS = ["stripe", "bkash", "rocket", "nagad"];
router.use(authenticate);

router.post("/", requireRole("worker"), async (req, res, next) => {
  try {
    const withdrawalCoin = Number(req.body.withdrawal_coin);
    const paymentSystem = typeof req.body.payment_system === "string"
      ? req.body.payment_system.trim().toLowerCase()
      : "";
    const accountNumber = typeof req.body.account_number === "string"
      ? req.body.account_number.trim()
      : "";
    if (!Number.isSafeInteger(withdrawalCoin) || withdrawalCoin < 200) {
      return res.status(400).json({ message: "Minimum withdrawal is 200 whole coins" });
    }
    if (!PAYMENT_SYSTEMS.includes(paymentSystem) || !accountNumber || accountNumber.length > 100) {
      return res.status(400).json({ message: "A valid payment system and account number are required" });
    }

    const worker = await User.findOneAndUpdate(
      { _id: req.user._id, coin: { $gte: withdrawalCoin } },
      { $inc: { coin: -withdrawalCoin } },
      { new: true }
    );
    if (!worker) return res.status(400).json({ message: "Insufficient coin" });

    let withdrawal;
    try {
      withdrawal = await Withdrawal.create({
        worker_email: worker.email,
        worker_name: worker.name,
        withdrawal_coin: withdrawalCoin,
        withdrawal_amount: withdrawalCoin / 20,
        payment_system: paymentSystem,
        account_number: accountNumber
      });
    } catch (error) {
      await User.updateOne({ _id: worker._id }, { $inc: { coin: withdrawalCoin } });
      throw error;
    }
    res.status(201).json(withdrawal);
  } catch (error) { next(error); }
});

router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    if (req.query.status && !["pending", "approved", "rejected"].includes(req.query.status)) {
      return res.status(400).json({ message: "Invalid withdrawal status" });
    }
    const filter = req.query.status ? { status: req.query.status } : {};
    const withdrawals = await Withdrawal.find(filter).sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (error) { next(error); }
});

router.patch("/:id/approve", requireRole("admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid withdrawal id" });
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "approved" } },
      { new: true }
    );
    if (!withdrawal) {
      const exists = await Withdrawal.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "Withdrawal already reviewed" : "Withdrawal not found"
      });
    }
    await Notification.create({
      message: `Your withdrawal of ${withdrawal.withdrawal_amount} dollars was approved`,
      toEmail: withdrawal.worker_email,
      actionRoute: "/dashboard/worker-home"
    });
    res.json(withdrawal);
  } catch (error) { next(error); }
});

module.exports = router;
