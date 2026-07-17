import mongoose from "mongoose";
const userschema = mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  channelname: { type: String },
  description: { type: String },
  image: { type: String },
  joinedon: { type: Date, default: Date.now },
  plan: { type: String, default: "free", enum: ["free", "bronze", "silver", "gold"] },
  theme: { type: String, default: "auto" },
  knownDevices: [{ type: String }],
});

export default mongoose.model("user", userschema);
