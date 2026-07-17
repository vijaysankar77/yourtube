import Razorpay from "razorpay";
import nodemailer from "nodemailer";
import crypto from "crypto";
import User from "../Modals/Auth.js";

const PLANS = {
  bronze: { name: "Bronze", price: 9900, downloads: 5 },   // ₹99
  silver: { name: "Silver", price: 19900, downloads: 20 },  // ₹199
  gold:   { name: "Gold",   price: 49900, downloads: 999 }, // ₹499
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder",
});

// Create Razorpay order
export const createOrder = async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ message: "Invalid plan" });

  try {
    const order = await razorpay.orders.create({
      amount: PLANS[plan].price,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { plan },
    });
    return res.status(200).json({ orderId: order.id, amount: PLANS[plan].price, plan });
  } catch (error) {
    console.error("Razorpay error:", error);
    return res.status(500).json({ message: "Could not create payment order" });
  }
};

// Verify payment and update user plan
export const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, plan } = req.body;

  try {
    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "placeholder")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Update user plan
    const user = await User.findByIdAndUpdate(userId, { plan }, { new: true });

    // Send confirmation email
    await sendConfirmationEmail(user, plan, razorpay_payment_id);

    return res.status(200).json({ message: "Plan upgraded successfully", plan, user });
  } catch (error) {
    console.error("Verify error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Get user plan
export const getUserPlan = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ plan: user.plan || "free" });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

async function sendConfirmationEmail(user, plan, paymentId) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const planDetails = PLANS[plan];
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: `YourTube ${planDetails.name} Plan - Payment Confirmation`,
    html: `
      <h2>Thank you for upgrading to ${planDetails.name} Plan!</h2>
      <p>Hi ${user.name},</p>
      <p>Your payment was successful. Here are your plan details:</p>
      <table style="border-collapse:collapse;">
        <tr><td><b>Plan:</b></td><td>${planDetails.name}</td></tr>
        <tr><td><b>Amount Paid:</b></td><td>₹${planDetails.price / 100}</td></tr>
        <tr><td><b>Downloads/day:</b></td><td>${planDetails.downloads}</td></tr>
        <tr><td><b>Payment ID:</b></td><td>${paymentId}</td></tr>
        <tr><td><b>Date:</b></td><td>${new Date().toLocaleDateString()}</td></tr>
      </table>
      <p>Enjoy your premium experience on YourTube!</p>
    `,
  });
}
