const User = require("../models/User");
const { hashPassword, isStrongPassword, isValidEmail, normalizeEmail } = require("../utils/auth");

module.exports = async function ensureAdminUser() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!isValidEmail(email) || !isStrongPassword(password)) {
    throw new Error("ADMIN_EMAIL and a strong ADMIN_PASSWORD must both be configured");
  }

  let user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    await User.create({
      name: process.env.ADMIN_NAME || "Platform Admin",
      email,
      role: "admin",
      coin: 0,
      passwordHash: await hashPassword(password)
    });
    console.log("Configured administrator account created");
    return;
  }

  user.role = "admin";
  if (!user.passwordHash) user.passwordHash = await hashPassword(password);
  await user.save();
};
