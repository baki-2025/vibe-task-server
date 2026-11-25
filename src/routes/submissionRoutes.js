const express = require("express");
const mongoose = require("mongoose");
const Submission = require("../models/Submission");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Math.min(Number(req.query.limit) || 10, 100), 1);
    const filter = {};
    if (req.query.worker_email) filter.worker_email = req.query.worker_email;
    if (req.query.buyer_email) filter.buyer_email = req.query.buyer_email;
    if (req.query.status) filter.status = req.query.status;
    if (req.user.role === "worker") filter.worker_email = req.user.email;
    if (req.user.role === "buyer") filter.buyer_email = req.user.email;

    const [items, total] = await Promise.all([
      Submission.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Submission.countDocuments(filter)
    ]);
    res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
});

router.patch("/:id/approve", requireRole("buyer"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid submission id" });
    const submission = await Submission.findOne({ _id: req.params.id, buyer_email: req.user.email });
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (submission.status !== "pending") return res.status(400).json({ message: "Submission already reviewed" });

    const worker = await User.findOne({ email: submission.worker_email });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    worker.coin += submission.payable_amount;
    await worker.save();
    submission.status = "approved";
    await submission.save();
    await Notification.create({
      message: `You have earned ${submission.payable_amount} coins from ${submission.buyer_name} for completing ${submission.task_title}`,
      toEmail: submission.worker_email,
      actionRoute: "/dashboard/worker-home"
    });
    res.json(submission);
  } catch (error) { next(error); }
});

router.patch("/:id/reject", requireRole("buyer"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid submission id" });
    const submission = await Submission.findOne({ _id: req.params.id, buyer_email: req.user.email });
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    if (submission.status !== "pending") return res.status(400).json({ message: "Submission already reviewed" });

    submission.status = "rejected";
    await submission.save();
    await Task.updateOne({ _id: submission.task_id }, { $inc: { required_workers: 1 } });
    await Notification.create({
      message: `Your submission for ${submission.task_title} was rejected by ${submission.buyer_name}`,
      toEmail: submission.worker_email,
      actionRoute: "/dashboard/my-submissions"
    });
    res.json(submission);
  } catch (error) { next(error); }
});

module.exports = router;
