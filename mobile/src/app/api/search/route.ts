import { NextResponse } from "next/server";
// @ts-ignore
import ytSearch from "yt-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  // Nível 1: yt-search
  try {
    const r = await ytSearch(q);
    if (r && Array.isArray(r.videos) && r.videos.length > 0) {
      const results = r.videos.slice(0, 10).map((video: any) => ({
        id: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail || video.image || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
        duration: video.timestamp || "",
      }));
      return NextResponse.json(results);
    }
  } catch (err) {
    console.warn("yt-search falhou:", err);
  }

  // Nível 2 & 3: Fallback direto no HTML do YouTube
  try {
    const fallbackResults = await searchYouTubeDirect(q);
    return NextResponse.json(fallbackResults);
  } catch (fallbackErr) {
    console.error("Fallback Search Error:", fallbackErr);
    return NextResponse.json([], { status: 200 });
  }
}

async function searchYouTubeDirect(query: string) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  // Tentativa A: ytInitialData JSON
  try {
    const match = html.match(/(?:ytInitialData\s*=\s*)({[\s\S]*?});\s*<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

      const results: any[] = [];
      for (const item of contents) {
        if (item.videoRenderer) {
          const v = item.videoRenderer;
          const videoId = v.videoId;
          const title = v.title?.runs?.[0]?.text || "Louvor";
          const duration = v.lengthText?.simpleText || "";

          if (videoId) {
            results.push({
              id: videoId,
              title,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              duration,
            });
          }
          if (results.length >= 10) break;
        }
      }
      if (results.length > 0) return results;
    }
  } catch (e) {
    // Ignora erro de JSON e tenta Regex B
  }

  // Tentativa B: Regex em HTML cru para videoIds
  const videoIdMatches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g));
  const uniqueIds = Array.from(new Set(videoIdMatches.map(m => m[1])));

  return uniqueIds.slice(0, 10).map((id) => ({
    id,
    title: "Louvor YouTube",
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: "",
  }));
}
