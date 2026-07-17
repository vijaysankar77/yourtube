"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Settings,
  SkipForward,
  Loader2,
} from "lucide-react";

interface Video {
  _id: string;
  videotitle: string;
  filepath: string;
}

interface VideoPlayerProps {
  video: Video;
  nextVideo?: Video | null;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(secs: number) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({ video, nextVideo }: VideoPlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef({ left: 0, right: 0 });

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [pip, setPip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkipAnim, setShowSkipAnim] = useState<"left" | "right" | null>(null);
  const [showNextBanner, setShowNextBanner] = useState(false);

  // ── Playback ─────────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  // ── Seek 10s ──────────────────────────────────────────────────────────────────
  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + seconds, v.duration));
  }, []);

  // ── Volume ────────────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    setVolume(val);
    setMuted(val === 0);
  };

  // ── Seek bar ──────────────────────────────────────────────────────────────────
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
  };

  // ── Speed ─────────────────────────────────────────────────────────────────────
  const setPlaybackSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  // ── Picture-in-Picture ────────────────────────────────────────────────────────
  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); setPip(false); }
      else { await v.requestPictureInPicture(); setPip(true); }
    } catch { /* not supported */ }
  };

  // ── Next video ────────────────────────────────────────────────────────────────
  const goToNext = useCallback(() => {
    if (nextVideo) router.push(`/watch/${nextVideo._id}`);
  }, [nextVideo, router]);

  // ── Auto-hide controls ────────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  // ── Double-tap gesture (mobile) ───────────────────────────────────────────────
  const handleTap = useCallback((side: "left" | "right") => {
    tapCount.current[side]++;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      if (tapCount.current[side] >= 2) {
        const secs = side === "right" ? 10 : -10;
        seek(secs);
        setShowSkipAnim(side);
        setTimeout(() => setShowSkipAnim(null), 700);
      } else {
        togglePlay();
      }
      tapCount.current = { left: 0, right: 0 };
    }, 250);
  }, [seek, togglePlay]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); seek(10); break;
        case "ArrowLeft": e.preventDefault(); seek(-10); break;
        case "ArrowUp": v.volume = Math.min(v.volume + 0.1, 1); setVolume(v.volume); break;
        case "ArrowDown": v.volume = Math.max(v.volume - 0.1, 0); setVolume(v.volume); break;
        case "m": toggleMute(); break;
        case "f": toggleFullscreen(); break;
        case "n": goToNext(); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, seek, toggleMute, toggleFullscreen, goToNext]);

  // ── Video events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDuration = () => setDuration(v.duration);
    const onPlay = () => { setPlaying(true); setIsLoading(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onEnded = () => {
      setPlaying(false);
      if (nextVideo) setShowNextBanner(true);
    };
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDuration);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("progress", onProgress);
    v.addEventListener("ended", onEnded);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDuration);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("ended", onEnded);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [nextVideo]);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-lg overflow-hidden select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full"
        src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${video?.filepath}`}
        onClick={togglePlay}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Double-tap gesture zones (mobile) */}
      <div className="absolute inset-0 flex pointer-events-none md:pointer-events-none">
        <div
          className="flex-1 h-full pointer-events-auto"
          onTouchEnd={() => handleTap("left")}
        />
        <div className="w-1/5 h-full" /> {/* center — single tap = play/pause */}
        <div
          className="flex-1 h-full pointer-events-auto"
          onTouchEnd={() => handleTap("right")}
        />
      </div>

      {/* Skip animation overlay */}
      {showSkipAnim && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${showSkipAnim === "right" ? "right-8" : "left-8"} pointer-events-none`}>
          <div className="bg-white/20 rounded-full px-4 py-2 text-white font-bold text-lg animate-ping-once">
            {showSkipAnim === "right" ? "+10s ▶▶" : "◀◀ -10s"}
          </div>
        </div>
      )}

      {/* Paused big icon */}
      {!playing && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-5">
            <Play className="w-12 h-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Next video end banner */}
      {showNextBanner && nextVideo && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-20">
          <p className="text-white text-lg font-semibold">Up Next</p>
          <p className="text-gray-300 text-sm px-8 text-center">{nextVideo.videotitle}</p>
          <div className="flex gap-3">
            <button
              onClick={goToNext}
              className="bg-white text-black px-6 py-2 rounded-full font-semibold hover:bg-gray-200"
            >
              Play Now
            </button>
            <button
              onClick={() => setShowNextBanner(false)}
              className="border border-white text-white px-6 py-2 rounded-full hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(transparent 50%, rgba(0,0,0,0.85))" }}
      >
        {/* Seek bar */}
        <div className="px-3 pb-1 relative h-5 flex items-center">
          <div className="absolute left-3 right-3 h-1 bg-white/20 rounded-full pointer-events-none">
            <div className="h-full bg-white/40 rounded-full" style={{ width: `${bufferedPct}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 appearance-none bg-transparent cursor-pointer relative z-10"
            style={{ background: `linear-gradient(to right, #ef4444 ${progress}%, transparent ${progress}%)` }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2 px-3 pb-3">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-red-400">
            {playing ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
          </button>

          {/* Seek -10 / +10 */}
          <button onClick={() => seek(-10)} className="text-white hover:text-red-400 text-xs font-bold" title="Rewind 10s">
            ◀◀10
          </button>
          <button onClick={() => seek(10)} className="text-white hover:text-red-400 text-xs font-bold" title="Forward 10s">
            10▶▶
          </button>

          {/* Volume */}
          <button onClick={toggleMute} className="text-white hover:text-red-400">
            {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={handleVolume}
            className="w-16 h-1 accent-red-500 cursor-pointer"
          />

          {/* Time */}
          <span className="text-white text-xs tabular-nums ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Next video */}
          {nextVideo && (
            <button onClick={goToNext} className="text-white hover:text-red-400" title="Next video (N)">
              <SkipForward className="w-5 h-5" />
            </button>
          )}

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu((p) => !p)}
              className="text-white text-xs font-semibold flex items-center gap-1 hover:text-red-400"
            >
              <Settings className="w-4 h-4" />
              {speed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-8 right-0 bg-gray-900 rounded-lg py-1 z-20 min-w-[80px]">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`block w-full text-right px-4 py-1 text-sm hover:bg-gray-700 ${speed === s ? "text-red-400 font-bold" : "text-white"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
            <button onClick={togglePiP} className="text-white hover:text-red-400">
              <PictureInPicture2 className={`w-5 h-5 ${pip ? "text-red-400" : ""}`} />
            </button>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-red-400">
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="absolute top-3 right-3 opacity-0 hover:opacity-100 transition-opacity">
        <span className="text-white/60 text-xs bg-black/50 rounded px-2 py-1">
          Space · ←→ ±10s · M · F · N
        </span>
      </div>
    </div>
  );
}
