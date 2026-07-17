import {
  Home,
  Compass,
  PlaySquare,
  Clock,
  ThumbsUp,
  History,
  User,
  Crown,
  Download,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { Button } from "./ui/button";
import Channeldialogue from "./channeldialogue";
import { useUser } from "@/lib/AuthContext";

const Sidebar = () => {
  const { user } = useUser();

  const [isdialogeopen, setisdialogeopen] = useState(false);
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r dark:border-gray-700 min-h-screen p-2">
      <nav className="space-y-1">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Home className="w-5 h-5 mr-3" />
            Home
          </Button>
        </Link>
        <Link href="/explore">
          <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Compass className="w-5 h-5 mr-3" />
            Explore
          </Button>
        </Link>
        <Link href="/subscriptions">
          <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
            <PlaySquare className="w-5 h-5 mr-3" />
            Subscriptions
          </Button>
        </Link>

        {user && (
          <>
            <div className="border-t dark:border-gray-700 pt-2 mt-2">
              <Link href="/history">
                <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <History className="w-5 h-5 mr-3" />
                  History
                </Button>
              </Link>
              <Link href="/liked">
                <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ThumbsUp className="w-5 h-5 mr-3" />
                  Liked videos
                </Button>
              </Link>
              <Link href="/watch-later">
                <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Clock className="w-5 h-5 mr-3" />
                  Watch later
                </Button>
              </Link>
              <Link href="/downloads">
                <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Download className="w-5 h-5 mr-3" />
                  Downloads
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" className="w-full justify-start text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Crown className="w-5 h-5 mr-3" />
                  Upgrade Plan
                </Button>
              </Link>
              {user?.channelname ? (
                <Link href={`/channel/${user._id}`}>
                  <Button variant="ghost" className="w-full justify-start text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <User className="w-5 h-5 mr-3" />
                    Your channel
                  </Button>
                </Link>
              ) : (
                <div className="px-2 py-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    onClick={() => setisdialogeopen(true)}
                  >
                    Create Channel
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </nav>
      <Channeldialogue
        isopen={isdialogeopen}
        onclose={() => setisdialogeopen(false)}
        mode="create"
      />
    </aside>
  );
};

export default Sidebar;
