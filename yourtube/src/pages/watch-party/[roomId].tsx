import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, Users, MessageSquare, Copy, Check,
  Circle, Square,
} from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

interface Participant { socketId: string; username: string; }
interface ChatMsg { id: number; message: string; username: string; time: string; }

export default function WatchParty() {
  const router = useRouter();
  const { roomId, videoId } = router.query as { roomId: string; videoId: string };
  const { user } = useUser();

  // Refs
  const socketRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const syncLock = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);

  // State
  const [videoSrc, setVideoSrc] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const username = user?.name || "Guest";

  // ── Fetch video info ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;
    axiosInstance.get("/video/getall").then((res) => {
      const v = res.data?.find((vid: any) => vid._id === videoId);
      if (v) {
        setVideoSrc(`${BACKEND}/${v.filepath}`);
        setVideoTitle(v.videotitle);
      }
    }).catch(() => {});
  }, [videoId]);

  // ── Create peer connection ──────────────────────────────────────────────────
  const createPeer = useCallback((socketId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", { candidate: e.candidate, to: socketId });
      }
    };

    // Remote stream
    pc.ontrack = (e) => {
      setRemoteStreams((prev) => ({ ...prev, [socketId]: e.streams[0] }));
    };

    if (initiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socketRef.current?.emit("webrtc-offer", { offer, to: socketId });
      });
    }

    peersRef.current[socketId] = pc;
    return pc;
  }, []);

  // ── Socket.IO setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !videoId) return;

    // Dynamically import socket.io-client
    import("socket.io-client").then(({ io }) => {
      const socket = io(BACKEND, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("join-room", { roomId, username, videoId });
      });

      socket.on("room-state", ({ currentTime, playing, participants: p }: any) => {
        setParticipants(p);
        const v = videoRef.current;
        if (v && currentTime > 1) {
          syncLock.current = true;
          v.currentTime = currentTime;
          if (playing) v.play().catch(() => {});
          setTimeout(() => { syncLock.current = false; }, 500);
        }
      });

      socket.on("participants-updated", (p: Participant[]) => setParticipants(p));

      socket.on("user-joined", ({ socketId, username: name }: any) => {
        setMessages((prev) => [...prev, { id: Date.now(), message: `${name} joined the party!`, username: "System", time: "" }]);
        createPeer(socketId, true);
      });

      socket.on("user-left", ({ socketId }: any) => {
        peersRef.current[socketId]?.close();
        delete peersRef.current[socketId];
        setRemoteStreams((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
      });

      // Video sync
      socket.on("video-sync", ({ currentTime, playing, seeked }: any) => {
        const v = videoRef.current;
        if (!v) return;
        syncLock.current = true;
        if (seeked || Math.abs(v.currentTime - currentTime) > 2) {
          v.currentTime = currentTime;
        }
        if (playing && v.paused) v.play().catch(() => {});
        if (!playing && !v.paused) v.pause();
        setTimeout(() => { syncLock.current = false; }, 500);
      });

      // Chat
      socket.on("chat-message", (msg: ChatMsg) => {
        setMessages((prev) => [...prev, msg]);
      });

      // WebRTC signaling
      socket.on("webrtc-offer", async ({ offer, from }: any) => {
        const pc = createPeer(from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { answer, to: from });
      });

      socket.on("webrtc-answer", async ({ answer, from }: any) => {
        await peersRef.current[from]?.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("ice-candidate", async ({ candidate, from }: any) => {
        try {
          await peersRef.current[from]?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      });

      return () => { socket.disconnect(); };
    });

    // Get local camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }).catch(() => {});

    return () => {
      socketRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach((pc) => pc.close());
    };
  }, [roomId, videoId, username, createPeer]);

  // Attach remote streams to video elements
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([id, stream]) => {
      const el = remoteVideoRefs.current[id];
      if (el && el.srcObject !== stream) el.srcObject = stream;
    });
  }, [remoteStreams]);

  // ── Video sync emission ─────────────────────────────────────────────────────
  const emitSync = useCallback((seeked = false) => {
    if (syncLock.current || !videoRef.current) return;
    socketRef.current?.emit("video-sync", {
      roomId,
      currentTime: videoRef.current.currentTime,
      playing: !videoRef.current.paused,
      seeked,
    });
  }, [roomId]);

  // ── Mic / Camera ────────────────────────────────────────────────────────────
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCameraOn((c) => !c);
  };

  // ── Screen share ────────────────────────────────────────────────────────────
  const shareScreen = async () => {
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(track);
      });
      track.onended = () => {
        const cam = localStreamRef.current?.getVideoTracks()[0];
        if (cam) {
          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            sender?.replaceTrack(cam);
          });
        }
      };
    } catch {}
  };

  // ── Recording ───────────────────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
        const rec = new MediaRecorder(stream);
        recChunks.current = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) recChunks.current.push(e.data); };
        rec.onstop = () => {
          const blob = new Blob(recChunks.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `watch-party-${roomId}.webm`; a.click();
          stream.getTracks().forEach((t: any) => t.stop());
        };
        rec.start();
        recorderRef.current = rec;
        setIsRecording(true);
      } catch {}
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    socketRef.current?.emit("chat-message", { roomId, message: chatInput.trim(), username });
    setChatInput("");
  };

  // ── Copy invite link ────────────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Leave ───────────────────────────────────────────────────────────────────
  const leaveParty = () => {
    socketRef.current?.disconnect();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    router.push(videoId ? `/watch/${videoId}` : "/");
  };

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-1 rounded">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Watch Party</span>
          {videoTitle && <span className="text-gray-400 text-xs hidden sm:block">• {videoTitle}</span>}
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-full"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Invite"}
          </button>
          <button onClick={leaveParty} className="flex items-center gap-1 text-xs bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-full">
            <PhoneOff className="w-3 h-3" /> Leave
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Video + call grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main video */}
          <div className="relative bg-black" style={{ aspectRatio: "16/9", maxHeight: "55vh" }}>
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full"
                controls={false}
                onPlay={() => emitSync()}
                onPause={() => emitSync()}
                onSeeked={() => emitSync(true)}
                onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">Loading video...</div>
            )}
            {/* Simple play overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3">
              <button
                onClick={() => { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); }}
                className="bg-black/60 hover:bg-black/80 text-white px-4 py-1.5 rounded-full text-sm font-medium"
              >
                Play / Pause (synced)
              </button>
            </div>
          </div>

          {/* Camera grid */}
          <div className="flex gap-2 p-2 bg-gray-900 overflow-x-auto">
            {/* Local */}
            <div className="relative flex-shrink-0 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 px-1 rounded">You</span>
              {!cameraOn && <div className="absolute inset-0 bg-gray-900 flex items-center justify-center"><VideoOff className="w-6 h-6 text-gray-500" /></div>}
            </div>
            {/* Remote peers */}
            {remoteEntries.map(([id]) => (
              <div key={id} className="relative flex-shrink-0 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={(el) => { remoteVideoRefs.current[id] = el; if (el && remoteStreams[id]) el.srcObject = remoteStreams[id]; }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 text-xs bg-black/60 px-1 rounded">
                  {participants.find((p) => p.socketId === id)?.username || "Guest"}
                </span>
              </div>
            ))}
          </div>

          {/* Call controls */}
          <div className="flex items-center justify-center gap-3 py-3 bg-gray-900 border-t border-gray-800">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full ${muted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}`}
              title="Toggle mic"
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full ${!cameraOn ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}`}
              title="Toggle camera"
            >
              {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={shareScreen}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600"
              title="Share screen"
            >
              <Monitor className="w-5 h-5" />
            </button>
            <button
              onClick={toggleRecording}
              className={`p-3 rounded-full ${isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"}`}
              title={isRecording ? "Stop recording" : "Record session"}
            >
              {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </button>
            <button
              onClick={leaveParty}
              className="p-3 rounded-full bg-red-700 hover:bg-red-600"
              title="Leave party"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right panel: Chat / Participants */}
        <div className="w-80 flex flex-col bg-gray-900 border-l border-gray-800">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-sm ${activeTab === "chat" ? "border-b-2 border-red-500 text-white" : "text-gray-400"}`}
            >
              <MessageSquare className="w-4 h-4" /> Chat
            </button>
            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-sm ${activeTab === "participants" ? "border-b-2 border-red-500 text-white" : "text-gray-400"}`}
            >
              <Users className="w-4 h-4" /> {participants.length}
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-gray-500 text-xs text-center mt-4">No messages yet. Say hi!</p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`text-sm ${msg.username === "System" ? "text-center text-gray-500 italic text-xs" : ""}`}>
                    {msg.username !== "System" && (
                      <div className="flex items-baseline gap-2">
                        <span className={`font-semibold text-xs ${msg.username === username ? "text-red-400" : "text-blue-400"}`}>
                          {msg.username}
                        </span>
                        <span className="text-gray-500 text-xs">{msg.time}</span>
                      </div>
                    )}
                    <p className={msg.username === "System" ? "" : "text-gray-200"}>{msg.message}</p>
                  </div>
                ))}
              </div>
              {/* Input */}
              <div className="p-3 border-t border-gray-800 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-800 rounded-full px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500"
                />
                <button onClick={sendMessage} className="bg-red-600 hover:bg-red-700 rounded-full px-3 py-2 text-sm font-medium">
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-xs text-gray-500 mb-3">{participants.length} participant{participants.length !== 1 ? "s" : ""}</p>
              {participants.map((p) => (
                <div key={p.socketId} className="flex items-center gap-3 py-2 border-b border-gray-800">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {p.username?.[0]?.toUpperCase() || "G"}
                  </div>
                  <span className="text-sm">{p.username}</span>
                  {p.username === username && <span className="text-xs text-gray-500 ml-auto">(you)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
