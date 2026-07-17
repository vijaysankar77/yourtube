import Download from "../Modals/download.js";
import Video from "../Modals/video.js";
import User from "../Modals/Auth.js";

// Free users: 1 download/day, Premium: unlimited
const DAILY_LIMIT = { free: 1, premium: 100 };

export const downloadVideo = async (req, res) => {
  const { userId, userPlan = "free" } = req.body;
  const { videoId } = req.params;

  try {
    // Count today's downloads for this user
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await Download.countDocuments({
      userId,
      downloadDate: { $gte: startOfDay },
    });

    const limit = DAILY_LIMIT[userPlan] || 1;

    if (todayCount >= limit) {
      return res.status(429).json({
        message:
          userPlan === "free"
            ? "Free users can only download 1 video per day. Upgrade to premium for more."
            : "Daily download limit reached.",
        limit,
        used: todayCount,
      });
    }

    // Record the download
    const record = new Download({ userId, videoId, userPlan });
    await record.save();

    // Get the video filepath to return the download URL
    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: "Video not found" });

    return res.status(200).json({
      message: "Download allowed",
      filepath: video.filepath,
      used: todayCount + 1,
      limit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getDownloadHistory = async (req, res) => {
  const { userId } = req.params;
  try {
    const downloads = await Download.find({ userId })
      .populate("videoId")
      .sort({ downloadDate: -1 });
    return res.status(200).json(downloads);
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getDownloadCount = async (req, res) => {
  const { userId } = req.params;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await Download.countDocuments({
      userId,
      downloadDate: { $gte: startOfDay },
    });
    return res.status(200).json({ todayCount });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
