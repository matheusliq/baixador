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

  // Lista de URLs para tentar em ordem
  const urls: string[] = [];

  if (src) {
    urls.push(src);
  }

  const id = videoId || (src ? src.match(/\/vi\/([^/]+)\//)?.[1] : null);

  if (id) {
    // Usamos i.ytimg.com (CDN oficial sem cookies do YouTube)
    const base = `https://i.ytimg.com/vi/${id}`;
    const fallbacks = [`${base}/hqdefault.jpg`, `${base}/mqdefault.jpg`, `${base}/sddefault.jpg`, `${base}/default.jpg`];
    for (const fb of fallbacks) {
      if (!urls.includes(fb)) {
        urls.push(fb);
      }
    }
  }

  const currentUrl = urls[attempt];

  if (!currentUrl || attempt >= urls.length) {
    return (
      <div className={`bg-zinc-800 flex items-center justify-center text-zinc-400 ${className}`}>
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
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      className={`${className} bg-zinc-800 object-cover`}
      onError={() => setAttempt((prev) => prev + 1)}
    />
  );
}
