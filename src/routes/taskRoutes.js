const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Submission = require("../models/Submission");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === "worker") filter.required_workers = { $gt: 0 };
    if (req.user.role === "buyer") filter.buyer_email = req.user.email;
    if (req.user.role === "admin" && req.query.buyer_email) {
      filter.buyer_email = req.query.buyer_email;
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const escapedSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.task_title = { $regex: escapedSearch, $options: "i" };
    }
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (error) { next(error); }
});

router.post("/", requireRole("buyer"), async (req, res, next) => {
  try {
    const task = req.body;
    const requiredWorkers = Number(task.required_workers);
    const payableAmount = Number(task.payable_amount);
    const completionDate = new Date(task.completion_date);
    if (!Number.isSafeInteger(requiredWorkers) || requiredWorkers < 1 ||
        !Number.isSafeInteger(payableAmount) || payableAmount < 1) {
      return res.status(400).json({ message: "Worker count and payable amount must be positive whole numbers" });
    }
    if (!task.task_title || !task.task_detail || !task.submission_info ||
        !Number.isFinite(completionDate.getTime())) {
      return res.status(400).json({ message: "Task title, details, submission instructions, and completion date are required" });
    }
    const total = requiredWorkers * payableAmount;
    if (!Number.isSafeInteger(total)) return res.status(400).json({ message: "Task budget is too large" });
    const buyer = await User.findOneAndUpdate(
      { _id: req.user._id, coin: { $gte: total } },
      { $inc: { coin: -total } },
      { new: true }
    );
    if (!buyer) return res.status(400).json({ message: "Insufficient coin" });

    try {
      const created = await Task.create({
        task_title: task.task_title,
        task_detail: task.task_detail,
        required_workers: requiredWorkers,
        payable_amount: payableAmount,
        completion_date: completionDate,
        submission_info: task.submission_info,
        task_image_url: task.task_image_url || "",
        buyer_email: buyer.email,
        buyer_name: buyer.name
      });
      res.status(201).json(created);
    } catch (error) {
      await User.updateOne({ _id: buyer._id }, { $inc: { coin: total } });
      throw error;
    }
  } catch (error) { next(error); }
});

router.patch("/:id", requireRole("buyer"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const task = await Task.findOne({ _id: req.params.id, buyer_email: req.user.email });
    if (!task) return res.status(404).json({ message: "Task not found" });
    ["task_title", "task_detail", "submission_info"].forEach((key) => {
      if (req.body[key] !== undefined) task[key] = req.body[key];
    });
    await task.save();
    res.json(task);
  } catch (error) { next(error); }
});

router.delete("/:id", requireRole("buyer", "admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const filter = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, buyer_email: req.user.email };
    const task = await Task.findOneAndDelete(filter);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const refund = task.required_workers * task.payable_amount;
    await User.updateOne({ email: task.buyer_email }, { $inc: { coin: refund } });
    await Submission.deleteMany({ task_id: task._id });
    res.json({ message: "Task deleted", refunded: refund });
  } catch (error) { next(error); }
});

router.post("/:id/submissions", requireRole("worker"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    if (typeof req.body.submission_details !== "string" || !req.body.submission_details.trim()) {
      return res.status(400).json({ message: "Submission details are required" });
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, required_workers: { $gt: 0 } },
      { $inc: { required_workers: -1 } },
      { new: true }
    );
    if (!task) {
      const exists = await Task.exists({ _id: req.params.id });
      return res.status(exists ? 400 : 404).json({
        message: exists ? "No workers are currently required" : "Task not found"
      });
    }
    let submission;
    try {
      submission = await Submission.create({
        task_id: task._id,
        task_title: task.task_title,
        payable_amount: task.payable_amount,
        worker_email: req.user.email,
        worker_name: req.user.name,
        buyer_name: task.buyer_name,
        buyer_email: task.buyer_email,
        submission_details: req.body.submission_details.trim(),
        status: "pending"
      });
    } catch (error) {
      await Task.updateOne({ _id: task._id }, { $inc: { required_workers: 1 } });
      throw error;
    }
    await Notification.create({
      message: `${req.user.name} submitted a task: ${task.task_title}`,
      toEmail: task.buyer_email,
      actionRoute: "/dashboard/buyer-home"
    });
    res.status(201).json(submission);
  } catch (error) { next(error); }
});

module.exports = router;
