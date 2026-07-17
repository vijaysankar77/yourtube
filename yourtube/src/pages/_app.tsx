import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { UserProvider } from "../lib/AuthContext";

// Pages that use their own full-screen layout (no Header/Sidebar)
const FULLSCREEN_PAGES = ["/watch-party/[roomId]"];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isFullscreen = FULLSCREEN_PAGES.some((p) =>
    router.pathname.startsWith(p.replace("[roomId]", ""))
  );

  return (
    <UserProvider>
      {isFullscreen ? (
        <div className="min-h-screen bg-gray-950 text-white">
          <Toaster />
          <Component {...pageProps} />
        </div>
      ) : (
        <div className="min-h-screen bg-white dark:bg-gray-950 dark:text-white text-black">
          <title>Your-Tube Clone</title>
          <Header />
          <Toaster />
          <div className="flex">
            <Sidebar />
            <Component {...pageProps} />
          </div>
        </div>
      )}
    </UserProvider>
  );
}
