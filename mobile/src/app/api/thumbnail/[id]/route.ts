import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;

  if (!videoId || typeof videoId !== "string") {
    return new NextResponse("ID inválido", { status: 400 });
  }

  // URLs em ordem de qualidade e compatibilidade garantida
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/0.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/0.jpg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        // Imagens de erro vazias do YouTube costumam ter menos de 1000 bytes.
        if (arrayBuffer.byteLength > 1000) {
          const contentType = res.headers.get("content-type") || "image/jpeg";
          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          });
        }
      }
    } catch (e) {
      // Tenta a próxima opção silenciosamente
    }
  }

  return new NextResponse("Thumbnail não disponível", { status: 404 });
}
