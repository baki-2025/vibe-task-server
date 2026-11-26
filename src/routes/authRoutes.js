const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const {
  hashPassword,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
  verifyPassword
} = require("../utils/auth");

const router = express.Router();

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, displayName, email, photoURL, profilePictureURL, role, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = typeof (name || displayName) === "string" ? (name || displayName).trim() : "";
    const normalizedRole = role || "worker";

    if (!normalizedName || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "A valid name and email are required" });
    }
    if (!["worker", "buyer"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Role must be worker or buyer" });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: "Password must be at least 8 characters and contain letters and numbers" });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      photoURL: photoURL || profilePictureURL || "",
      role: normalizedRole,
      coin: normalizedRole === "buyer" ? 50 : 10,
      passwordHash: await hashPassword(password)
    });
    res.status(201).json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email) || typeof req.body.password !== "string") {
      return res.status(400).json({ message: "A valid email and password are required" });
    }
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/jwt", authenticate, (req, res) => {
  res.json({ token: createToken(req.user) });
});

router.get("/me", authenticate, (req, res) => res.json(req.user));

module.exports = router;
