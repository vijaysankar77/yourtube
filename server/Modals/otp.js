import mongoose from "mongoose";

const otpSchema = mongoose.Schema({
  userId: { type: String, required: true },
  otp: { type: String, required: true },
  deviceFingerprint: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // expires in 5 min
});

export default mongoose.model("otp", otpSchema);
