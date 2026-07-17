import mongoose from "mongoose";

const downloadSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: "video", required: true },
  downloadDate: { type: Date, default: Date.now },
  userPlan: { type: String, default: "free" },
});

export default mongoose.model("download", downloadSchema);
