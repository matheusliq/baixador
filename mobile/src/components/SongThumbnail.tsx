'use client';

import { useState } from 'react';

interface SongThumbnailProps {
  videoId?: string;
  src?: string;
  alt: string;
  className?: string;
}

export default function SongThumbnail({ videoId, src, alt, className = '' }: SongThumbnailProps) {
  const [attempt, setAttempt] = useState(0);

  const id = videoId || (src ? src.match(/\/vi\/([^/]+)\//)?.[1] : null);

  const urls: string[] = [];

  if (id) {
    // 1. Nossa API Proxy no servidor (sem CORS, sem AdBlock, valida tamanho de imagem)
    urls.push(`/api/thumbnail/${id}`);
    // 2. Fallbacks diretos caso necessário
    urls.push(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    urls.push(`https://i.ytimg.com/vi/${id}/0.jpg`);
  } else if (src) {
    urls.push(src);
  }

  const currentUrl = urls[attempt];

  if (!currentUrl || attempt >= urls.length) {
    return (
      <div className={`bg-zinc-200 flex items-center justify-center text-zinc-400 rounded-xl ${className}`}>
        <span className="text-2xl">🎵</span>
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={alt}
      loading="lazy"
      className={`${className} bg-zinc-200 object-cover`}
      onError={() => setAttempt((prev) => prev + 1)}
    />
  );
}
