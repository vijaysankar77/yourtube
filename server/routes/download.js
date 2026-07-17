import express from "express";
import { downloadVideo, getDownloadHistory, getDownloadCount } from "../controllers/download.js";

const routes = express.Router();

routes.post("/:videoId", downloadVideo);
routes.get("/history/:userId", getDownloadHistory);
routes.get("/count/:userId", getDownloadCount);

export default routes;
