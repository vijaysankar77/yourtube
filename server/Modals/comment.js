import mongoose from "mongoose";

const commentschema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    commentbody: { type: String, required: true },
    usercommented: { type: String },
    commentedon: { type: Date, default: Date.now },

    // Language the comment was written in
    language: { type: String, default: "en" },

    // Optional location (user controls visibility)
    location: { type: String, default: "" },
    showLocation: { type: Boolean, default: false },

    // Like / Dislike
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],

    // Reports — flagged for review, NOT auto-deleted
    reports: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        reason: { type: String, default: "Inappropriate content" },
      },
    ],
    isReported: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },

    // Moderation
    isBlocked: { type: Boolean, default: false },

    // Cached translations: { "hi": "translated text", "fr": "..." }
    translations: { type: Map, of: String, default: {} },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("comment", commentschema);
