import ChannelHeader from "@/components/ChannelHeader";
import Channeltabs from "@/components/Channeltabs";
import ChannelVideos from "@/components/ChannelVideos";
import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

const ChannelPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = user && channel && String(user._id) === String(channel._id);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch channel owner info
        const userRes = await axiosInstance.get(`/user/${id}`);
        setChannel(userRes.data);

        // Fetch all videos and filter by uploader
        const videoRes = await axiosInstance.get("/video/getall");
        const channelVideos = videoRes.data.filter(
          (v: any) => String(v.uploader) === String(id)
        );
        setVideos(channelVideos);
      } catch (error) {
        console.error("Error fetching channel data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading channel...</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Channel not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-white">
      <div className="max-w-full mx-auto">
        <ChannelHeader channel={channel} user={user} />
        <Channeltabs />

        {/* Only channel owner sees the upload form */}
        {isOwner && (
          <div className="px-4 pb-8">
            <VideoUploader channelId={id} channelName={channel?.channelname} />
          </div>
        )}

        <div className="px-4 pb-8">
          <ChannelVideos videos={videos} />
        </div>
      </div>
    </div>
  );
};

export default ChannelPage;
