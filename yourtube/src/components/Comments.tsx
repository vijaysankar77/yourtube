import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  Globe,
  MapPin,
  Languages,
  AlertTriangle,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  commentbody: string;
  usercommented: string;
  commentedon: string;
  language: string;
  location: string;
  showLocation: boolean;
  likes: number;
  dislikes: number;
  likedBy: string[];
  dislikedBy: string[];
  isReported: boolean;
  reportCount: number;
  translations?: Record<string, string>;
  isBlocked?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "bn", name: "Bengali" },
  { code: "gu", name: "Gujarati" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
];

const REPORT_REASONS = [
  "Spam or misleading",
  "Hateful or abusive content",
  "Harassment or bullying",
  "Sexual content",
  "Misinformation",
  "Other",
];

// ─── Moderation (client-side pre-check) ───────────────────────────────────────
const ABUSIVE_WORDS = [
  "fuck", "shit", "bitch", "bastard", "cunt", "asshole", "idiot",
  "moron", "loser", "slut", "whore", "dick", "cock", "pussy",
];
const hasAbusiveWords = (text: string) =>
  ABUSIVE_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

const isSpamComment = (text: string) => {
  // Repeated characters (5+ in a row)
  if (/(.)\1{4,}/.test(text.replace(/\s/g, ""))) return true;
  // More than 60% special characters
  const special = (text.match(/[^a-zA-Z0-9\sऀ-ॿ஀-௿]/g) || []).length;
  if (text.length > 5 && special / text.length > 0.6) return true;
  // Suspicious URL spam (too many URLs)
  const urls = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (urls.length > 2) return true;
  if (urls.length > 0 && text.trim().split(/\s+/).length <= urls.length * 2) return true;
  return false;
};

// ─── Translation helper (server-backed) ─────────────────────────────────────
const translateText = async (commentId: string, targetLang: string): Promise<string> => {
  const res = await axiosInstance.post(`/comment/translate/${commentId}`, { targetLang });
  return res.data.translated;
};

// ─── Helper to get user initials ────────────────────────────────────────────
const getInitials = (name?: string) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// ─── Component ────────────────────────────────────────────────────────────────
const Comments = ({ videoId }: any) => {
  const { user } = useUser();

  // Comment list state
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // New comment form
  const [newComment, setNewComment] = useState("");
  const [commentLang, setCommentLang] = useState("en");
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Translate
  const [translating, setTranslating] = useState<string | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [translateTarget, setTranslateTarget] = useState<Record<string, string>>({});

  // Report
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    loadComments(1);
  }, [videoId]);

  const loadComments = async (page = 1) => {
    try {
      setError(null);
      const isInitialLoad = page === 1;
      if (isInitialLoad) setLoading(true);
      else setLoadingMore(true);

      const res = await axiosInstance.get(`/comment/${videoId}?page=${page}&limit=20`);
      
      if (isInitialLoad) {
        setComments(res.data.comments);
      } else {
        setComments((prev) => [...prev, ...res.data.comments]);
      }
      
      setCurrentPage(page);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error: any) {
      setError(error?.response?.data?.message || "Failed to load comments");
      console.log(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ── Submit new comment ──────────────────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    if (hasAbusiveWords(newComment)) {
      toast.error("Your comment contains abusive language and cannot be posted.");
      return;
    }
    if (isSpamComment(newComment)) {
      toast.error("Your comment looks like spam. Please write something meaningful.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post("/comment/postcomment", {
        videoid: videoId,
        userid: user._id,
        commentbody: newComment,
        usercommented: user.name,
        language: commentLang,
        location: showLocation ? location : "",
        showLocation,
      });
      if (res.data.comment) {
        const fresh: Comment = {
          _id: res.data.data?._id || Date.now().toString(),
          videoid: videoId,
          userid: user._id,
          commentbody: newComment,
          usercommented: user.name || "Anonymous",
          commentedon: new Date().toISOString(),
          language: commentLang,
          location: showLocation ? location : "",
          showLocation,
          likes: 0,
          dislikes: 0,
          likedBy: [],
          dislikedBy: [],
          isReported: false,
          reportCount: 0,
        };
        setComments([fresh, ...comments]);
        setNewComment("");
        setLocation("");
        setShowLocation(false);
        toast.success("Comment posted!");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error posting comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const handleUpdateComment = async () => {
    if (!editText.trim()) return;
    if (hasAbusiveWords(editText)) { toast.error("Abusive language detected."); return; }
    if (isSpamComment(editText)) { toast.error("Comment looks like spam."); return; }
    try {
      const res = await axiosInstance.post(`/comment/editcomment/${editingId}`, {
        commentbody: editText,
      });
      if (res.data) {
        setComments((prev) =>
          prev.map((c) => c._id === editingId ? { ...c, commentbody: editText } : c)
        );
        setEditingId(null);
        setEditText("");
        toast.success("Comment updated!");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error updating comment.");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`);
      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => c._id !== id));
        toast.success("Comment deleted.");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // ── Like ───────────────────────────────────────────────────────────────────
  const handleLike = async (commentId: string) => {
    if (!user) { toast.error("Please sign in to like comments."); return; }
    try {
      await axiosInstance.post(`/comment/like/${commentId}`, { userId: user._id });
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          const wasLiked = c.likedBy.includes(user._id);
          const wasDisliked = c.dislikedBy.includes(user._id);
          return {
            ...c,
            likes: wasLiked ? c.likes - 1 : c.likes + 1,
            dislikes: !wasLiked && wasDisliked ? c.dislikes - 1 : c.dislikes,
            likedBy: wasLiked
              ? c.likedBy.filter((id) => id !== user._id)
              : [...c.likedBy, user._id],
            dislikedBy: !wasLiked
              ? c.dislikedBy.filter((id) => id !== user._id)
              : c.dislikedBy,
          };
        })
      );
   } catch (error: any) {
     toast.error(error?.response?.data?.message || "Error liking comment");
    }
  };

  // ── Dislike ────────────────────────────────────────────────────────────────
  const handleDislike = async (commentId: string) => {
    if (!user) { toast.error("Please sign in to dislike comments."); return; }
    try {
      await axiosInstance.post(`/comment/dislike/${commentId}`, { userId: user._id });
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          const wasDisliked = c.dislikedBy.includes(user._id);
          const wasLiked = c.likedBy.includes(user._id);
          return {
            ...c,
            dislikes: wasDisliked ? c.dislikes - 1 : c.dislikes + 1,
            likes: !wasDisliked && wasLiked ? c.likes - 1 : c.likes,
            dislikedBy: wasDisliked
              ? c.dislikedBy.filter((id) => id !== user._id)
              : [...c.dislikedBy, user._id],
            likedBy: !wasDisliked
              ? c.likedBy.filter((id) => id !== user._id)
              : c.likedBy,
          };
        })
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error disliking comment");
    }
  };

  // ── Report ─────────────────────────────────────────────────────────────────
  const handleReport = async (commentId: string) => {
    if (!user) { toast.error("Please sign in to report comments."); return; }
    try {
      const res = await axiosInstance.post(`/comment/report/${commentId}`, {
        userId: user._id,
        reason: reportReason,
      });
      if (res.data.reported) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, isReported: true, reportCount: res.data.reportCount }
              : c
          )
        );
        toast.success("Comment reported and flagged for review.");
        setReportingId(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error reporting comment.");
      setReportingId(null);
    }
  };

  // ── Translate ──────────────────────────────────────────────────────────────
  const handleTranslate = async (commentId: string, originalLang: string) => {
    const target = translateTarget[commentId] || "en";
    if (target === originalLang) {
      toast.error("Please select a different language to translate to.");
      return;
    }
    setTranslating(commentId);
    try {
      const translated = await translateText(commentId, target);
      setTranslatedTexts((prev) => ({ ...prev, [commentId]: translated }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Translation failed. Please try again.");
    } finally {
      setTranslating(null);
    }
  };

  const hideTranslation = (commentId: string) => {
    setTranslatedTexts((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{comments.length} Comments</h2>

      {/* ── Post Comment Form ────────────────────────────────────────────── */}
      {user ? (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e: any) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0"
            />

            {/* Language + Location options */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-gray-500">
                <Globe className="w-4 h-4" />
                <span className="text-xs">Language:</span>
                <select
                  value={commentLang}
                  onChange={(e) => setCommentLang(e.target.value)}
                  className="border rounded px-2 py-0.5 text-xs text-gray-600"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="rounded"
                />
                <MapPin className="w-3 h-3" />
                Add location (optional)
              </label>

              {showLocation && (
                <Input
                  placeholder="Your city (e.g. Chennai)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-7 text-xs w-44"
                />
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNewComment(""); setLocation(""); setShowLocation(false); }}
                disabled={!newComment.trim()}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Comment"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Sign in to post a comment.</p>
      )}

      {/* ── Comments List ────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <>
            {comments.map((comment) => (
            <div key={comment._id} className="flex gap-3">
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarFallback>{getInitials(comment.usercommented)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                {/* ── Comment header ─────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{comment.usercommented}</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(comment.commentedon))} ago
                  </span>

                  {/* Optional location */}
                  {comment.showLocation && comment.location && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {comment.location}
                    </span>
                  )}

                  {/* Language badge */}
                  {comment.language && comment.language !== "en" && (
                    <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">
                      {LANGUAGES.find((l) => l.code === comment.language)?.name || comment.language}
                    </span>
                  )}

                  {/* Reported badge */}
                  {comment.isReported && (
                    <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      Under Review
                    </span>
                  )}
                </div>

                {/* ── Edit mode or view mode ─────────────────────────── */}
                {editingId === comment._id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={handleUpdateComment} disabled={!editText.trim()}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(null); setEditText(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Comment text */}
                    <p className="text-sm leading-relaxed">{comment.commentbody}</p>

                    {/* Translated text block */}
                    {translatedTexts[comment._id] && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-md text-sm text-blue-800 relative">
                        <span className="text-xs text-blue-400 block mb-1 font-medium">
                          Translated ({LANGUAGES.find((l) => l.code === (translateTarget[comment._id] || "en"))?.name}):
                        </span>
                        {translatedTexts[comment._id]}
                        <button
                          onClick={() => hideTranslation(comment._id)}
                          className="absolute top-1 right-1 text-blue-300 hover:text-blue-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                     {/* Translate bar */}
                     {!translatedTexts[comment._id] && (
                       <div className="flex items-center gap-2 mt-1.5">
                         <Languages className="w-3 h-3 text-gray-400 flex-shrink-0" />
                         <select
                           value={translateTarget[comment._id] || "en"}
                           onChange={(e) =>
                             setTranslateTarget((prev) => ({ ...prev, [comment._id]: e.target.value }))
                           }
                           className="text-xs border rounded px-1 py-0.5 text-gray-500"
                         >
                           {LANGUAGES.filter((l) => l.code !== comment.language).map((l) => (
                             <option key={l.code} value={l.code}>{l.name}</option>
                           ))}
                         </select>
                         <button
                           onClick={() => handleTranslate(comment._id, comment.language)}
                           disabled={translating === comment._id}
                           className="text-xs text-blue-500 hover:underline disabled:opacity-50"
                         >
                           {translating === comment._id ? "Translating..." : "Translate"}
                         </button>
                       </div>
                     )}

                    {/* ── Actions row ───────────────────────────────── */}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {/* Like */}
                      <button
                        onClick={() => handleLike(comment._id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:bg-gray-100 transition-colors ${
                          comment.likedBy?.includes(user?._id)
                            ? "text-blue-600 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {comment.likes || 0}
                      </button>

                      {/* Dislike */}
                      <button
                        onClick={() => handleDislike(comment._id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:bg-gray-100 transition-colors ${
                          comment.dislikedBy?.includes(user?._id)
                            ? "text-red-500 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        {comment.dislikes || 0}
                      </button>

                      {/* Report (only on other's comments) */}
                      {user && comment.userid !== user._id && (
                        <>
                          {reportingId === comment._id ? (
                            <div className="flex items-center gap-2 ml-1 flex-wrap">
                              <select
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                className="text-xs border rounded px-1 py-0.5 text-gray-600"
                              >
                                {REPORT_REASONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleReport(comment._id)}
                                className="text-xs text-red-500 hover:underline font-medium"
                              >
                                Submit
                              </button>
                              <button
                                onClick={() => setReportingId(null)}
                                className="text-xs text-gray-400 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setReportingId(comment._id)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors ml-1"
                            >
                              <Flag className="w-3 h-3" />
                              Report
                            </button>
                          )}
                        </>
                      )}

                      {/* Edit / Delete (own comments) */}
                      {comment.userid === user?._id && (
                        <div className="flex gap-2 ml-2 text-xs text-gray-400">
                          <button
                            onClick={() => { setEditingId(comment._id); setEditText(comment.commentbody); }}
                            className="hover:text-gray-800 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(comment._id)}
                            className="hover:text-red-500 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
             
             {/* Load More Button */}
             {currentPage < totalPages && (
               <div className="flex justify-center pt-4">
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => loadComments(currentPage + 1)}
                   disabled={loadingMore}
                 >
                   {loadingMore ? "Loading..." : "Load More Comments"}
                 </Button>
               </div>
             )}
           </>
         )}
       </div>
     </div>
   );
 };
 
 export default Comments;
