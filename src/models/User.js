const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  photoURL: { type: String, default: "" },
  role: { type: String, enum: ["worker", "buyer", "admin"], default: "worker" },
  coin: { type: Number, default: 10, min: 0 },
  firebaseUid: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
