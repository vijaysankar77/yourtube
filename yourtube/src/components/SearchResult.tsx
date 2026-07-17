import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axiosInstance from "@/lib/axiosinstance";

const SearchResult = ({ query }: any) => {
  const [video, setvideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query?.trim()) return;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/video/getall");
        const results = res.data.filter(
          (vid: any) =>
            vid.videotitle.toLowerCase().includes(query.toLowerCase()) ||
            vid.videochanel.toLowerCase().includes(query.toLowerCase())
        );
        setvideos(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query]);

  if (!query?.trim()) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          Enter a search term to find videos and channels.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Searching...</div>;
  }

  if (video.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-gray-600">
          Try different keywords or remove search filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {video.map((vid: any) => (
          <div key={vid._id} className="flex gap-4 group">
            <Link href={`/watch/${vid._id}`} className="flex-shrink-0">
              <div className="relative w-80 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <video
                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/${vid.filepath}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  preload="metadata"
                  muted
                />
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">
                  video
                </div>
              </div>
            </Link>

            <div className="flex-1 min-w-0 py-1">
              <Link href={`/watch/${vid._id}`}>
                <h3 className="font-medium text-lg line-clamp-2 group-hover:text-blue-600 mb-2">
                  {vid.videotitle}
                </h3>
              </Link>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span>{(vid.views || 0).toLocaleString()} views</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(vid.createdAt))} ago</span>
              </div>

              <Link
                href={`/channel/${vid.uploader}`}
                className="flex items-center gap-2 mb-2 hover:text-blue-600"
              >
                <Avatar className="w-6 h-6">
                  <AvatarImage src="/placeholder.svg?height=24&width=24" />
                  <AvatarFallback className="text-xs">
                    {vid.videochanel?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-600">{vid.videochanel}</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-8">
        <p className="text-gray-600">
          Showing {video.length} results for &quot;{query}&quot;
        </p>
      </div>
    </div>
  );
};

export default SearchResult;
