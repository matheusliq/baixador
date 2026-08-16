import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

const ALLOWED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'content-range',
  'etag',
  'last-modified',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;

  if (!videoId || typeof videoId !== 'string') {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const audioUrl = await getAudioUrl(videoId);

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Não foi possível extrair a URL de áudio' },
        { status: 502 }
      );
    }

    const rangeHeader = request.headers.get('range');
    const youtubeHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: '*/*',
      Referer: 'https://www.youtube.com/',
    };

    if (rangeHeader) {
      youtubeHeaders['Range'] = rangeHeader;
    }

    const youtubeResponse = await fetch(audioUrl, {
      headers: youtubeHeaders,
    });

    if (!youtubeResponse.ok && youtubeResponse.status !== 206) {
      return NextResponse.json(
        { error: 'Falha ao buscar áudio do YouTube' },
        { status: 502 }
      );
    }

    const responseHeaders = new Headers();
    ALLOWED_RESPONSE_HEADERS.forEach((header) => {
      const value = youtubeResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    // YouTube returns webm/opus usually when we ask for bestaudio.
    // It's safer to let the browser figure it out or pass the original header.
    const originalType = youtubeResponse.headers.get('content-type');
    responseHeaders.set('Content-Type', originalType || 'audio/webm');
    
    // Ensure accept-ranges is present for seekability
    responseHeaders.set('Accept-Ranges', 'bytes');

    return new NextResponse(youtubeResponse.body, {
      status: youtubeResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Audio Proxy Error]', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor de áudio' },
      { status: 500 }
    );
  }
}

function getAudioUrl(videoId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const ytDlp = spawn('python', [
      '-m',
      'yt_dlp',
      '--get-url',
      '-f',
      'bestaudio',
      '--no-warnings',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    let stdout = '';
    let stderr = '';

    ytDlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytDlp.on('close', (code) => {
      // Ignoramos código != 0 se o stdout conter a URL válida
      if (code !== 0) {
        console.warn('[yt-dlp stderr ignored]:', stderr.trim());
      }
      const url = stdout.trim().split('\n').find(line => line.trim().startsWith('http'));
      if (url) {
        resolve(url);
      } else {
        resolve(null);
      }
    });

    ytDlp.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      ytDlp.kill();
      reject(new Error('Timeout ao extrair URL de áudio'));
    }, 15000);
  });
}