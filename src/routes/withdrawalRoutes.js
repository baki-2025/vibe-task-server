const express = require("express");
const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.post("/", requireRole("worker"), async (req, res, next) => {
  try {
    const withdrawalCoin = Number(req.body.withdrawal_coin);
    const paymentSystem = req.body.payment_system;
    const accountNumber = req.body.account_number;
    if (withdrawalCoin < 200) return res.status(400).json({ message: "Minimum withdrawal is 200 coins" });
    if (withdrawalCoin > req.user.coin) return res.status(400).json({ message: "Insufficient coin" });
    if (!paymentSystem || !accountNumber) return res.status(400).json({ message: "Payment system and account number are required" });

    const withdrawal = await Withdrawal.create({
      worker_email: req.user.email,
      worker_name: req.user.name,
      withdrawal_coin: withdrawalCoin,
      withdrawal_amount: withdrawalCoin / 20,
      payment_system: paymentSystem,
      account_number: accountNumber
    });
    res.status(201).json(withdrawal);
  } catch (error) { next(error); }
});

router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const withdrawals = await Withdrawal.find(filter).sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (error) { next(error); }
});

router.patch("/:id/approve", requireRole("admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid withdrawal id" });
    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    if (withdrawal.status !== "pending") return res.status(400).json({ message: "Withdrawal already reviewed" });

    const worker = await User.findOne({ email: withdrawal.worker_email });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    if (worker.coin < withdrawal.withdrawal_coin) return res.status(400).json({ message: "Worker has insufficient coin" });
    worker.coin -= withdrawal.withdrawal_coin;
    await worker.save();
    withdrawal.status = "approved";
    await withdrawal.save();
    await Notification.create({
      message: `Your withdrawal of ${withdrawal.withdrawal_amount} dollars was approved`,
      toEmail: withdrawal.worker_email,
      actionRoute: "/dashboard/worker-home"
    });
    res.json(withdrawal);
  } catch (error) { next(error); }
});

module.exports = router;
