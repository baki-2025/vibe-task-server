const express = require("express");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const notifications = await Notification.find({ toEmail: req.user.email }).sort({ time: -1, createdAt: -1 });
    res.json(notifications);
  } catch (error) { next(error); }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, toEmail: req.user.email },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (error) { next(error); }
});

module.exports = router;
