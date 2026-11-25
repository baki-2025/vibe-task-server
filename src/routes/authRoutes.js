const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, displayName, email, photoURL, profilePictureURL, role, firebaseUid } = req.body;
    if (!email || !(name || displayName)) return res.status(400).json({ message: "Name and email are required" });
    const normalizedRole = role === "buyer" ? "buyer" : "worker";
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({
        name: name || displayName,
        email: email.toLowerCase(),
        photoURL: photoURL || profilePictureURL || "",
        role: normalizedRole,
        coin: normalizedRole === "buyer" ? 50 : 10,
        firebaseUid: firebaseUid || ""
      });
    }
    res.status(user.createdAt ? 201 : 200).json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/jwt", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ token: createToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, (req, res) => res.json(req.user));

module.exports = router;
