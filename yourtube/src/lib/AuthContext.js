import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, useEffect, useContext, createContext, useCallback } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";

const UserContext = createContext();

// Get IST hour (UTC+5:30)
function getISTHour() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  return ist.getHours();
}

// Get theme based on time: 10AM-12PM IST = light, else dark
function getTimeBasedTheme() {
  const hour = getISTHour();
  return hour >= 10 && hour < 12 ? "light" : "dark";
}

// Apply theme to document
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("yt-theme", theme);
}

// Simple device fingerprint
function getDeviceFingerprint() {
  const raw = navigator.userAgent + screen.width + screen.height + navigator.language;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState("light");
  const [otpPending, setOtpPending] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [pendingUserData, setPendingUserData] = useState(null);

  const login = (userdata) => {
    setUser(userdata);
    localStorage.setItem("user", JSON.stringify(userdata));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  const setTheme = useCallback((t) => {
    setThemeState(t);
    applyTheme(t);
    // Save to backend if user is logged in
    if (user?._id) {
      axiosInstance.patch(`/user/update/${user._id}`, { theme: t }).catch(() => {});
    }
  }, [user]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const handlegooglesignin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;
      const payload = {
        email: firebaseuser.email,
        name: firebaseuser.displayName,
        image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      };
      const response = await axiosInstance.post("/user/login", payload);
      const userData = response.data.result;

      // Apply saved theme or time-based theme
      const savedTheme = userData.theme && userData.theme !== "auto"
        ? userData.theme
        : getTimeBasedTheme();
      setThemeState(savedTheme);
      applyTheme(savedTheme);

      // Check device fingerprint for OTP
      const fingerprint = getDeviceFingerprint();
      const otpRes = await axiosInstance.post("/otp/send", {
        userId: userData._id,
        deviceFingerprint: fingerprint,
      });

      if (otpRes.data.verified) {
        // Known device — log in directly
        login(userData);
      } else {
        // New device — require OTP
        setPendingUserData(userData);
        setOtpPending(true);
      }
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      console.error("Sign in error:", error.message);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpInput || otpInput.length !== 6) {
      setOtpError("Please enter the 6-digit OTP");
      return;
    }
    try {
      const fingerprint = getDeviceFingerprint();
      await axiosInstance.post("/otp/verify", {
        userId: pendingUserData._id,
        otp: otpInput,
        deviceFingerprint: fingerprint,
      });
      login(pendingUserData);
      setOtpPending(false);
      setOtpInput("");
      setOtpError("");
      setPendingUserData(null);
    } catch (err) {
      setOtpError(err?.response?.data?.message || "Invalid OTP. Try again.");
    }
  };

  useEffect(() => {
    // Restore saved user
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
      } catch { localStorage.removeItem("user"); }
    }

    // Apply saved or time-based theme
    const savedTheme = localStorage.getItem("yt-theme") || getTimeBasedTheme();
    setThemeState(savedTheme);
    applyTheme(savedTheme);

    const unsubscribe = onAuthStateChanged(auth, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, handlegooglesignin, loading, theme, toggleTheme }}>
      {children}

      {/* OTP Verification Modal */}
      {otpPending && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-2">New Device Detected</h2>
            <p className="text-gray-500 text-sm mb-4">
              An OTP has been sent to <b>{pendingUserData?.email}</b>. Enter it below to verify.
            </p>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest mb-3 dark:bg-gray-800 dark:border-gray-600"
            />
            {otpError && <p className="text-red-500 text-sm mb-3">{otpError}</p>}
            <button
              onClick={handleVerifyOTP}
              className="w-full bg-red-600 text-white rounded-lg py-3 font-semibold hover:bg-red-700"
            >
              Verify OTP
            </button>
            <button
              onClick={() => { setOtpPending(false); setOtpInput(""); setPendingUserData(null); }}
              className="w-full mt-2 text-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
