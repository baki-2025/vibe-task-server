const express = require("express");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.post("/purchase", requireRole("buyer"), async (req, res, next) => {
  try {
    const { amount, coins, transaction_id } = req.body;
    const numericAmount = Number(amount);
    const numericCoins = Number(coins);
    if (!numericAmount || !numericCoins) return res.status(400).json({ message: "Amount and coins are required" });

    req.user.coin += numericCoins;
    await req.user.save();
    const payment = await Payment.create({
      buyer_email: req.user.email,
      buyer_name: req.user.name,
      amount: numericAmount,
      coins: numericCoins,
      transaction_id: transaction_id || "",
      status: "completed"
    });
    res.status(201).json({ payment, coin: req.user.coin });
  } catch (error) { next(error); }
});

router.post("/create-checkout-session", requireRole("buyer"), async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: "Stripe is not configured" });
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const { amount, coins } = req.body;
    const numericAmount = Number(amount);
    const numericCoins = Number(coins);
    if (!numericAmount || !numericCoins) return res.status(400).json({ message: "Amount and coins are required" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${numericCoins} task coins` },
          unit_amount: Math.round(numericAmount * 100)
        },
        quantity: 1
      }],
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/payment-history?success=true`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/purchase-coin?canceled=true`,
      metadata: { buyer_email: req.user.email, buyer_name: req.user.name, coins: String(numericCoins) }
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});

router.get("/history", requireRole("buyer"), async (req, res, next) => {
  try {
    const payments = await Payment.find({ buyer_email: req.user.email }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) { next(error); }
});

module.exports = router;
