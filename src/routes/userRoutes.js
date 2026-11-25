const express = require("express");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) { next(error); }
});

router.get("/top-workers", async (req, res, next) => {
  try {
    const workers = await User.find({ role: "worker" }).sort({ coin: -1 }).limit(6);
    res.json(workers);
  } catch (error) { next(error); }
});

router.patch("/:email/role", requireRole("admin"), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["worker", "buyer", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    const user = await User.findOneAndUpdate(
      { email: decodeURIComponent(req.params.email).toLowerCase() },
      { role },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) { next(error); }
});

router.delete("/:email", requireRole("admin"), async (req, res, next) => {
  try {
    const user = await User.findOneAndDelete({ email: decodeURIComponent(req.params.email).toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (error) { next(error); }
});

module.exports = router;
