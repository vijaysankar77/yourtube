import express from "express";
import {
  deletecomment,
  dislikecomment,
  editcomment,
  getallcomment,
  likecomment,
  postcomment,
  reportcomment,
  translatecomment,
  getreportedcomments,
  blockcomment,
  clearreportflag,
} from "../controllers/comment.js";

const routes = express.Router();

// ── Specific routes FIRST (before wildcard /:videoid) ──────────────────────
routes.post("/postcomment", postcomment);
routes.post("/editcomment/:id", editcomment);
routes.post("/like/:id", likecomment);
routes.post("/dislike/:id", dislikecomment);
routes.post("/report/:id", reportcomment);
routes.post("/translate/:id", translatecomment);
routes.delete("/deletecomment/:id", deletecomment);

// ── Admin routes ────────────────────────────────────────────────────────────
routes.get("/admin/reported/list", getreportedcomments);
routes.post("/admin/block/:id", blockcomment);
routes.post("/admin/clearreport/:id", clearreportflag);

// ── Wildcard — must be LAST ─────────────────────────────────────────────────
routes.get("/:videoid", getallcomment);

export default routes;
