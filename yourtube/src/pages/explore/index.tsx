import CategoryTabs from "@/components/category-tabs";
import Videogrid from "@/components/Videogrid";
import { Suspense } from "react";

export default function ExplorePage() {
  return (
    <main className="flex-1 p-4">
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold mb-6">Explore</h1>
        <CategoryTabs />
        <Suspense fallback={<div>Loading videos...</div>}>
          <Videogrid />
        </Suspense>
      </div>
    </main>
  );
}
