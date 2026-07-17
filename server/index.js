import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import downloadroutes from "./routes/download.js";
import subscriptionroutes from "./routes/subscription.js";
import otproutes from "./routes/otp.js";

dotenv.config();

// Create uploads folder if it doesn't exist (needed on Render)
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map();

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, username, videoId }) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { videoId, currentTime: 0, playing: false, participants: new Map() });
    }
    const room = rooms.get(roomId);
    room.participants.set(socket.id, { socketId: socket.id, username });
    socket.emit("room-state", {
      videoId: room.videoId,
      currentTime: room.currentTime,
      playing: room.playing,
      participants: [...room.participants.values()],
    });
    socket.to(roomId).emit("user-joined", { socketId: socket.id, username });
    io.to(roomId).emit("participants-updated", [...room.participants.values()]);
  });

  socket.on("video-sync", ({ roomId, currentTime, playing, seeked }) => {
    const room = rooms.get(roomId);
    if (room) { room.currentTime = currentTime; room.playing = playing; }
    socket.to(roomId).emit("video-sync", { currentTime, playing, seeked });
  });

  socket.on("chat-message", ({ roomId, message, username }) => {
    io.to(roomId).emit("chat-message", {
      id: Date.now(),
      message,
      username,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  socket.on("webrtc-offer", ({ offer, to }) => {
    io.to(to).emit("webrtc-offer", { offer, from: socket.id });
  });
  socket.on("webrtc-answer", ({ answer, to }) => {
    io.to(to).emit("webrtc-answer", { answer, from: socket.id });
  });
  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.participants.delete(socket.id);
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        io.to(roomId).emit("participants-updated", [...room.participants.values()]);
        if (room.participants.size === 0) rooms.delete(roomId);
      }
    }
  });
});

// ── CORS — must be FIRST before any routes ──────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join("uploads")));

app.get("/", (req, res) => {
  res.send("YourTube backend is working");
});

app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/download", downloadroutes);
app.use("/subscription", subscriptionroutes);
app.use("/otp", otproutes);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

const DBURL = process.env.DB_URL;
mongoose
  .connect(DBURL)
  .then(() => console.log("Mongodb connected"))
  .catch((error) => console.log(error));
