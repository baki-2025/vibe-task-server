const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  task_title: { type: String, required: true, trim: true },
  task_detail: { type: String, required: true },
  required_workers: { type: Number, required: true, min: 1 },
  payable_amount: { type: Number, required: true, min: 1 },
  completion_date: { type: Date, required: true },
  submission_info: { type: String, required: true },
  task_image_url: { type: String, default: "" },
  buyer_email: { type: String, required: true, lowercase: true },
  buyer_name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);
