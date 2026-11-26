const jwt = require("jsonwebtoken");
const getFirebaseAdmin = require("../config/firebase");
const User = require("../models/User");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Bearer token is required" });

    let payload;
    const firebase = getFirebaseAdmin();
    if (firebase) {
      try {
        const decoded = await firebase.auth().verifyIdToken(token);
        payload = { email: decoded.email, firebaseUid: decoded.uid };
      } catch (_) {}
    }
    if (!payload) {
      if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: "Authentication is not configured" });
      }
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (_) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
    }

    if (typeof payload.email !== "string" || !payload.email) {
      return res.status(401).json({ message: "Token does not identify a user" });
    }
    const user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "User is not registered" });
    req.user = user;
  } catch (error) {
    return next(error);
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
