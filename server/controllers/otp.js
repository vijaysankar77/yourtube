import OTP from "../Modals/otp.js";
import User from "../Modals/Auth.js";
import nodemailer from "nodemailer";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp, name) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "YourTube - Login Verification OTP",
    html: `
      <h2>New Device Login Detected</h2>
      <p>Hi ${name},</p>
      <p>We detected a login from a new device or location.</p>
      <h1 style="letter-spacing:8px;color:#FF0000">${otp}</h1>
      <p>This OTP expires in 5 minutes. Do not share it with anyone.</p>
    `,
  });
}

export const sendOTP = async (req, res) => {
  const { userId, deviceFingerprint } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if device is already known
    const knownDevices = user.knownDevices || [];
    if (knownDevices.includes(deviceFingerprint)) {
      return res.status(200).json({ verified: true, message: "Known device" });
    }

    const otp = generateOTP();
    await OTP.deleteMany({ userId }); // remove old OTPs
    await OTP.create({ userId, otp, deviceFingerprint });
    await sendOTPEmail(user.email, otp, user.name);

    return res.status(200).json({ verified: false, message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyOTP = async (req, res) => {
  const { userId, otp, deviceFingerprint } = req.body;
  try {
    const record = await OTP.findOne({ userId, otp });
    if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

    // Add device to known devices
    await User.findByIdAndUpdate(userId, {
      $addToSet: { knownDevices: deviceFingerprint },
    });
    await OTP.deleteMany({ userId });

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
