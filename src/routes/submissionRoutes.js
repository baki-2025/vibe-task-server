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
    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 10;
    const filter = {};
    if (req.query.worker_email) filter.worker_email = req.query.worker_email;
    if (req.query.buyer_email) filter.buyer_email = req.query.buyer_email;
    if (req.query.status) {
      if (!["pending", "approved", "rejected"].includes(req.query.status)) {
        return res.status(400).json({ message: "Invalid submission status" });
      }
      filter.status = req.query.status;
    }
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
    const submission = await Submission.findOneAndUpdate(
      { _id: req.params.id, buyer_email: req.user.email, status: "pending" },
      { $set: { status: "approved" } },
      { new: true }
    );
    if (!submission) {
      const exists = await Submission.exists({ _id: req.params.id, buyer_email: req.user.email });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "Submission already reviewed" : "Submission not found"
      });
    }

    const worker = await User.updateOne(
      { email: submission.worker_email },
      { $inc: { coin: submission.payable_amount } }
    );
    if (worker.matchedCount !== 1) {
      await Submission.updateOne(
        { _id: submission._id, status: "approved" },
        { $set: { status: "pending" } }
      );
      return res.status(404).json({ message: "Worker not found" });
    }
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
    const submission = await Submission.findOneAndUpdate(
      { _id: req.params.id, buyer_email: req.user.email, status: "pending" },
      { $set: { status: "rejected" } },
      { new: true }
    );
    if (!submission) {
      const exists = await Submission.exists({ _id: req.params.id, buyer_email: req.user.email });
      return res.status(exists ? 409 : 404).json({
        message: exists ? "Submission already reviewed" : "Submission not found"
      });
    }
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
