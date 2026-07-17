import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Download, Lock } from "lucide-react";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

export default function DownloadsPage() {
  const { user } = useUser();
  const [downloads, setDownloads] = useState<any[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userPlan = user?.plan || "free";
  const dailyLimit = userPlan === "premium" ? 100 : 1;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [histRes, countRes] = await Promise.all([
          axiosInstance.get(`/download/history/${user._id}`),
          axiosInstance.get(`/download/count/${user._id}`),
        ]);
        setDownloads(histRes.data);
        setTodayCount(countRes.data.todayCount);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-20">
        <Download className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold">Sign in to see your downloads</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Downloads</h1>

      {/* Plan + daily usage */}
      <div className="bg-gray-100 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Plan: <span className="font-semibold capitalize">{userPlan}</span>
          </p>
          <p className="text-sm text-gray-600">
            Today: <span className="font-semibold">{todayCount} / {dailyLimit}</span> downloads used
          </p>
        </div>
        {userPlan === "free" && (
          <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
            <Lock className="w-4 h-4" />
            Free plan: 1 download/day
          </div>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : downloads.length === 0 ? (
        <div className="text-center py-12">
          <Download className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No downloads yet</h2>
          <p className="text-gray-600">Videos you download will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((item) => (
            <div key={item._id} className="flex gap-4 items-center border-b pb-4">
              <div className="w-40 aspect-video bg-gray-200 rounded overflow-hidden flex-shrink-0">
                <video
                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${item.videoId?.filepath}`}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium line-clamp-2">{item.videoId?.videotitle}</h3>
                <p className="text-sm text-gray-600">{item.videoId?.videochanel}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Downloaded {formatDistanceToNow(new Date(item.downloadDate))} ago
                </p>
                <p className="text-xs text-gray-500">Plan: {item.userPlan}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
