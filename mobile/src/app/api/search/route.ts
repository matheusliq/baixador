import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const results = await searchYouTubeDirect(q);
    return NextResponse.json(results);
  } catch (error) {
    console.error("YouTube Search Error:", error);
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
      "Cookie": "SOCS=CAESEwgDEgk2OTcyMTY5MzAaAmVuIAEaBgiA_L20Bg; CONSENT=YES+cb.20210328-17-p0.en+FX+417",
    },
  });

  if (!res.ok) return [];
  const html = await res.text();

  // Nível 1: Extração via JSON ytInitialData
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
    // Ignora erro de JSON e tenta Regex
  }

  // Nível 2: Extração via Regex no HTML cru
  const videoIdMatches = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g));
  const uniqueIds = Array.from(new Set(videoIdMatches.map((m) => m[1])));

  return uniqueIds.slice(0, 10).map((id) => ({
    id,
    title: "Louvor YouTube",
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: "",
  }));
}
