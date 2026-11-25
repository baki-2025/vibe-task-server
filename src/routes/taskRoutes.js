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
    const filter = { required_workers: { $gt: 0 } };
    if (req.user.role === "buyer") filter.buyer_email = req.user.email;
    if (req.query.buyer_email) filter.buyer_email = req.query.buyer_email;
    if (req.query.search) filter.task_title = { $regex: req.query.search, $options: "i" };
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
    if (!requiredWorkers || !payableAmount) return res.status(400).json({ message: "Invalid task amounts" });
    const total = requiredWorkers * payableAmount;
    if (req.user.coin < total) return res.status(400).json({ message: "Insufficient coin" });

    req.user.coin -= total;
    await req.user.save();
    const created = await Task.create({
      task_title: task.task_title,
      task_detail: task.task_detail,
      required_workers: requiredWorkers,
      payable_amount: payableAmount,
      completion_date: task.completion_date,
      submission_info: task.submission_info,
      task_image_url: task.task_image_url || "",
      buyer_email: req.user.email,
      buyer_name: req.user.name
    });
    res.status(201).json(created);
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
    const task = await Task.findOne(filter);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const refund = task.required_workers * task.payable_amount;
    const buyer = await User.findOne({ email: task.buyer_email });
    if (buyer) {
      buyer.coin += refund;
      await buyer.save();
    }
    await Submission.deleteMany({ task_id: task._id });
    await Task.deleteOne({ _id: task._id });
    res.json({ message: "Task deleted", refunded: refund });
  } catch (error) { next(error); }
});

router.post("/:id/submissions", requireRole("worker"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (task.required_workers < 1) return res.status(400).json({ message: "No workers required" });
    if (!req.body.submission_details) return res.status(400).json({ message: "Submission details are required" });

    const submission = await Submission.create({
      task_id: task._id,
      task_title: task.task_title,
      payable_amount: task.payable_amount,
      worker_email: req.user.email,
      worker_name: req.user.name,
      buyer_name: task.buyer_name,
      buyer_email: task.buyer_email,
      submission_details: req.body.submission_details,
      status: "pending"
    });
    task.required_workers -= 1;
    await task.save();
    await Notification.create({
      message: `${req.user.name} submitted a task: ${task.task_title}`,
      toEmail: task.buyer_email,
      actionRoute: "/dashboard/buyer-home"
    });
    res.status(201).json(submission);
  } catch (error) { next(error); }
});

module.exports = router;
