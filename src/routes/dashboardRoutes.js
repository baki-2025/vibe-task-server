const express = require("express");
const Task = require("../models/Task");
const Submission = require("../models/Submission");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/buyer", requireRole("buyer"), async (req, res, next) => {
  try {
    const [taskCount, tasks, paid, submissions] = await Promise.all([
      Task.countDocuments({ buyer_email: req.user.email }),
      Task.find({ buyer_email: req.user.email }),
      Payment.aggregate([
        { $match: { buyer_email: req.user.email, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Submission.find({ buyer_email: req.user.email, status: "pending" }).sort({ createdAt: -1 })
    ]);
    const pendingTasks = tasks.reduce((sum, task) => sum + task.required_workers, 0);
    res.json({
      totalTaskCount: taskCount,
      pendingTaskCount: pendingTasks,
      totalPayment: paid[0]?.total || 0,
      pendingSubmissions: submissions
    });
  } catch (error) { next(error); }
});

router.get("/worker", requireRole("worker"), async (req, res, next) => {
  try {
    const [totalSubmission, pendingSubmission, approvedSubmissions] = await Promise.all([
      Submission.countDocuments({ worker_email: req.user.email }),
      Submission.countDocuments({ worker_email: req.user.email, status: "pending" }),
      Submission.find({ worker_email: req.user.email, status: "approved" }).sort({ createdAt: -1 })
    ]);
    const totalEarning = approvedSubmissions.reduce((sum, item) => sum + item.payable_amount, 0);
    res.json({ totalSubmission, pendingSubmission, totalEarning, approvedSubmissions });
  } catch (error) { next(error); }
});

router.get("/admin", requireRole("admin"), async (req, res, next) => {
  try {
    const [workers, buyers, coins, payments, withdrawals] = await Promise.all([
      User.countDocuments({ role: "worker" }),
      User.countDocuments({ role: "buyer" }),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$coin" } } }]),
      Payment.countDocuments({ status: "completed" }),
      Withdrawal.find({ status: "pending" }).sort({ createdAt: -1 })
    ]);
    res.json({
      totalWorker: workers,
      totalBuyer: buyers,
      totalAvailableCoin: coins[0]?.total || 0,
      totalPayment: payments,
      pendingWithdrawals: withdrawals
    });
  } catch (error) { next(error); }
});

module.exports = router;
