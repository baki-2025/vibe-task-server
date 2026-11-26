const express = require("express");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { authenticate, requireRole } = require("../middleware/auth");
const { findPaymentPackage } = require("../utils/paymentPackages");

const router = express.Router();
router.use(authenticate);

router.post("/purchase", requireRole("buyer"), async (req, res, next) => {
  try {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({ message: "Demo payments are only available in development" });
    }
    const paymentPackage = findPaymentPackage(req.body.amount, req.body.coins);
    if (!paymentPackage) return res.status(400).json({ message: "Choose a valid coin package" });

    const buyer = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { coin: paymentPackage.coins } },
      { new: true }
    );
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });
    const payment = await Payment.create({
      buyer_email: buyer.email,
      buyer_name: buyer.name,
      amount: paymentPackage.amount,
      coins: paymentPackage.coins,
      transaction_id: `demo_${require("node:crypto").randomUUID()}`,
      status: "completed"
    });
    res.status(201).json({ payment, coin: buyer.coin });
  } catch (error) { next(error); }
});

router.post("/create-checkout-session", requireRole("buyer"), async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: "Stripe is not configured" });
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const paymentPackage = findPaymentPackage(req.body.amount, req.body.coins);
    if (!paymentPackage) return res.status(400).json({ message: "Choose a valid coin package" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${paymentPackage.coins} task coins` },
          unit_amount: paymentPackage.amount * 100
        },
        quantity: 1
      }],
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/payment-history?success=true`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/purchase-coin?canceled=true`,
      metadata: {
        buyer_email: req.user.email,
        buyer_name: req.user.name,
        coins: String(paymentPackage.coins),
        amount: String(paymentPackage.amount)
      }
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
