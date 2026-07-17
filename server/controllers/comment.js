import comment from "../Modals/comment.js";
import mongoose from "mongoose";

// ─── Content Moderation ────────────────────────────────────────────────────────
const ABUSIVE_WORDS = [
  "fuck", "shit", "bitch", "bastard", "cunt", "asshole", "idiot",
  "moron", "loser", "slut", "whore", "dick", "cock", "pussy", "nigger",
  "faggot", "retard", "asshat", "dumbass", "douchebag", "fuckwad",
  "motherfucker", "prick", "shithole", "twat",
];

// Regex to detect URLs for spam checking
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

const isAbusive = (text) => {
  return ABUSIVE_WORDS.some((word) =>
    new RegExp(`\\b${word}\\b`, "i").test(text)
  );
};

const isSpam = (text) => {
  // Repeated special characters (4+ in a row)
  if (/([!@#$%^&*()\-=[\]{};':"\\|,.<>/?])\1{3,}/.test(text)) return true;
  // More than 60% special characters
  const specialCount = (text.match(/[^a-zA-Z0-9\sऀ-ॿ஀-௿]/g) || []).length;
  if (text.length > 5 && specialCount / text.length > 0.6) return true;
  // Repeated words (same word more than 5 times)
  const words = text.trim().split(/\s+/);
  if (words.length > 4) {
    const freq = {};
    words.forEach((w) => { freq[w.toLowerCase()] = (freq[w.toLowerCase()] || 0) + 1; });
    if (Math.max(...Object.values(freq)) > 5) return true;
  }
  // Suspicious URL spam (too many URLs or only URLs)
  const urls = text.match(URL_PATTERN) || [];
  if (urls.length > 2) return true;
  if (urls.length > 0 && text.trim().split(/\s+/).length <= urls.length * 2) return true;
  
  return false;
};

// ─── Post Comment ──────────────────────────────────────────────────────────────
export const postcomment = async (req, res) => {
  const { commentbody, language, location, showLocation, ...rest } = req.body;

  if (!commentbody || !commentbody.trim()) {
    return res.status(400).json({ message: "Comment cannot be empty." });
  }
  if (isAbusive(commentbody)) {
    return res.status(400).json({
      message: "Your comment contains abusive language and cannot be posted.",
      blocked: true,
    });
  }
  if (isSpam(commentbody)) {
    return res.status(400).json({
      message: "Your comment appears to be spam and cannot be posted.",
      blocked: true,
    });
  }

  const newComment = new comment({
    ...rest,
    commentbody,
    language: language || "en",
    location: location || "",
    showLocation: showLocation || false,
  });

  try {
    const saved = await newComment.save();
    return res.status(200).json({ comment: true, data: saved });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Get All Comments ──────────────────────────────────────────────────────────
export const getallcomment = async (req, res) => {
  const { videoid } = req.params;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = await comment
      .find({ videoid, isBlocked: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await comment.countDocuments({ videoid, isBlocked: false });
    
    return res.status(200).json({
      comments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Delete Comment ────────────────────────────────────────────────────────────
export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  try {
    await comment.findByIdAndDelete(_id);
    return res.status(200).json({ comment: true });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Edit Comment ──────────────────────────────────────────────────────────────
export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send("comment unavailable");
  }
  if (isAbusive(commentbody)) {
    return res.status(400).json({ message: "Comment contains abusive language.", blocked: true });
  }
  if (isSpam(commentbody)) {
    return res.status(400).json({ message: "Comment appears to be spam.", blocked: true });
  }
  try {
    const updated = await comment.findByIdAndUpdate(
      _id,
      { $set: { commentbody } },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Like Comment ──────────────────────────────────────────────────────────────
export const likecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { userId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) return res.status(404).send("comment unavailable");
  try {
    const existing = await comment.findById(_id);
    if (!existing) return res.status(404).json({ message: "Comment not found" });

    // Prevent users from liking their own comments
    if (String(existing.userid) === String(userId)) {
      return res.status(400).json({ message: "You cannot like your own comment." });
    }

    const alreadyLiked = existing.likedBy.map(String).includes(String(userId));
    const alreadyDisliked = existing.dislikedBy.map(String).includes(String(userId));

    if (alreadyLiked) {
      await comment.findByIdAndUpdate(_id, {
        $pull: { likedBy: userId },
        $inc: { likes: -1 },
      });
      return res.status(200).json({ liked: false });
    } else {
      const update = {
        $addToSet: { likedBy: userId },
        $inc: { likes: 1 },
      };
      if (alreadyDisliked) {
        await comment.findByIdAndUpdate(_id, { $pull: { dislikedBy: userId }, $inc: { dislikes: -1 } });
      }
      await comment.findByIdAndUpdate(_id, update);
      return res.status(200).json({ liked: true });
    }
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Dislike Comment ───────────────────────────────────────────────────────────
export const dislikecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { userId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) return res.status(404).send("comment unavailable");
  try {
    const existing = await comment.findById(_id);
    if (!existing) return res.status(404).json({ message: "Comment not found" });

    // Prevent users from disliking their own comments
    if (String(existing.userid) === String(userId)) {
      return res.status(400).json({ message: "You cannot dislike your own comment." });
    }

    const alreadyDisliked = existing.dislikedBy.map(String).includes(String(userId));
    const alreadyLiked = existing.likedBy.map(String).includes(String(userId));

    if (alreadyDisliked) {
      await comment.findByIdAndUpdate(_id, {
        $pull: { dislikedBy: userId },
        $inc: { dislikes: -1 },
      });
      return res.status(200).json({ disliked: false });
    } else {
      if (alreadyLiked) {
        await comment.findByIdAndUpdate(_id, { $pull: { likedBy: userId }, $inc: { likes: -1 } });
      }
      await comment.findByIdAndUpdate(_id, {
        $addToSet: { dislikedBy: userId },
        $inc: { dislikes: 1 },
      });
      return res.status(200).json({ disliked: true });
    }
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Report Comment ────────────────────────────────────────────────────────────
export const reportcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { userId, reason } = req.body;
  
  if (!mongoose.Types.ObjectId.isValid(_id)) return res.status(404).send("comment unavailable");
  
  // Validate report reason
  const VALID_REASONS = [
    "Spam or misleading",
    "Hateful or abusive content",
    "Harassment or bullying",
    "Sexual content",
    "Misinformation",
    "Other",
  ];
  
  if (reason && !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Invalid report reason." });
  }
  
  try {
    const existing = await comment.findById(_id);
    if (!existing) return res.status(404).json({ message: "Comment not found" });

    const alreadyReported = existing.reports.some(
      (r) => String(r.userId) === String(userId)
    );
    if (alreadyReported) {
      return res.status(400).json({ message: "You have already reported this comment." });
    }

    const updated = await comment.findByIdAndUpdate(
      _id,
      {
        $push: { reports: { userId, reason: reason || "Inappropriate content" } },
        $inc: { reportCount: 1 },
        $set: { isReported: true },
      },
      { new: true }
    );
    return res.status(200).json({ reported: true, reportCount: updated.reportCount });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Translate Comment (uses free MyMemory API — no key needed) ───────────────
export const translatecomment = async (req, res) => {
  const { id: _id } = req.params;
  const { targetLang } = req.body;

  if (!mongoose.Types.ObjectId.isValid(_id))
    return res.status(404).send("comment unavailable");

  if (!targetLang)
    return res.status(400).json({ message: "targetLang is required." });

  try {
    const existing = await comment.findById(_id);
    if (!existing) return res.status(404).json({ message: "Comment not found" });

    const target = targetLang.toLowerCase();

    // ── Return cached translation if already done ──────────────────────────
    if (existing.translations && existing.translations.get(target)) {
      return res.status(200).json({
        translated: existing.translations.get(target),
        cached: true,
      });
    }

    // ── Call MyMemory free translation API (no API key needed) ─────────────
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      existing.commentbody
    )}&langpair=auto|${target}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(502).json({ message: "Translation service unavailable. Try again." });
    }

    const data = await resp.json();

    if (data.responseStatus !== 200) {
      return res.status(500).json({ message: "Translation failed. Please try again." });
    }

    const translated = data.responseData?.translatedText;
    if (!translated) {
      return res.status(500).json({ message: "Empty translation response." });
    }

    // ── Cache translation in DB so same language isn't fetched again ────────
    await comment.findByIdAndUpdate(_id, {
      $set: { [`translations.${target}`]: translated },
    });

    return res.status(200).json({ translated, cached: false });
  } catch (error) {
    console.error("translate error:", error);
    return res.status(500).json({ message: "Something went wrong during translation." });
  }
};

// ─── Get Reported Comments (Admin) ──────────────────────────────────────────
export const getreportedcomments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reportedComments = await comment
      .find({ isReported: true })
      .sort({ reportCount: -1, updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userid", "name email");
    
    const total = await comment.countDocuments({ isReported: true });
    
    return res.status(200).json({
      comments: reportedComments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Block Comment (Admin) ──────────────────────────────────────────────────
export const blockcomment = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) return res.status(404).send("comment unavailable");
  try {
    const updated = await comment.findByIdAndUpdate(
      _id,
      { $set: { isBlocked: true, isReported: false } },
      { new: true }
    );
    return res.status(200).json({ blocked: true, comment: updated });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─── Clear Report Flag (Admin) ──────────────────────────────────────────────
export const clearreportflag = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) return res.status(404).send("comment unavailable");
  try {
    const updated = await comment.findByIdAndUpdate(
      _id,
      { $set: { isReported: false, reportCount: 0, reports: [] } },
      { new: true }
    );
    return res.status(200).json({ cleared: true, comment: updated });
  } catch (error) {
    console.error("error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
