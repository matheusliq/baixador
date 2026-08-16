import { NextResponse } from "next/server";
import ytSearch from "yt-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const r = await ytSearch(q);
    const videos = r.videos.slice(0, 10);

    const results = videos.map((video) => ({
      id: video.videoId,
      title: video.title,
      thumbnail: video.thumbnail || video.image || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      duration: video.timestamp,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("YouTube Search Error:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
