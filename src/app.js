require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Payment = require("./models/Payment");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const errorHandler = require("./middleware/error");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : true,
  credentials: true
}));

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ message: "Stripe webhook is not configured" });
    }
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.metadata?.buyer_email;
      const coins = Number(session.metadata?.coins || 0);
      if (email && coins) {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          await Payment.updateOne(
            { transaction_id: session.id },
            {
              $setOnInsert: {
                buyer_email: email,
                buyer_name: session.metadata?.buyer_name || "",
                amount: (session.amount_total || 0) / 100,
                coins,
                currency: session.currency || "usd",
                transaction_id: session.id,
                status: "completed"
              }
            },
            { upsert: true }
          );
          user.coin += coins;
          await user.save();
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ name: "Micro-Task and Earning Platform API", status: "online" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(errorHandler);

module.exports = app;
