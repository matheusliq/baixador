import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';

const COOKIE_SOCS = 'SOCS=CAESEwgDEgk2OTcyMTY5MzAaAmVuIAEaBgiA_L20Bg; CONSENT=YES+cb.20210328-17-p0.en+FX+417';

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
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://www.youtube.com/',
      Cookie: COOKIE_SOCS,
    };

    if (rangeHeader) {
      youtubeHeaders['Range'] = rangeHeader;
    }

    const youtubeResponse = await fetch(audioUrl, {
      headers: youtubeHeaders,
      redirect: 'follow',
    });

    if (!youtubeResponse.ok && youtubeResponse.status !== 206) {
      console.error(`[Audio Proxy] YouTube returned status ${youtubeResponse.status}`);
      return NextResponse.json(
        { error: `Falha ao buscar áudio do YouTube (${youtubeResponse.status})` },
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

    const originalType = youtubeResponse.headers.get('content-type');
    responseHeaders.set('Content-Type', originalType || 'audio/webm');
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

async function getAudioUrl(videoId: string): Promise<string | null> {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // 1. Tenta extrair via @distube/ytdl-core com Cookie SOCS do Google (100% JS puro)
  try {
    const info = await ytdl.getInfo(ytUrl, {
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          Cookie: COOKIE_SOCS,
        },
      },
    });

    const format =
      ytdl.chooseFormat(info.formats, { quality: 'highestaudio' }) ||
      info.formats.find((f) => f.hasAudio && f.url);

    if (format && format.url) {
      return format.url;
    }
  } catch (err) {
    console.warn('ytdl-core falhou com cookie, tentando fallback sem opções...', err);
    try {
      const info = await ytdl.getInfo(ytUrl);
      const format =
        ytdl.chooseFormat(info.formats, { quality: 'highestaudio' }) ||
        info.formats.find((f) => f.hasAudio && f.url);
      if (format && format.url) {
        return format.url;
      }
    } catch (e2) {
      console.warn('ytdl-core fallback 2 falhou:', e2);
    }
  }

  // 2. Fallback local Python
  try {
    return await new Promise((resolve) => {
      const ytDlp = spawn('python', [
        '-m',
        'yt_dlp',
        '--get-url',
        '-f',
        'bestaudio',
        '--no-warnings',
        ytUrl,
      ]);

      let stdout = '';
      ytDlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      ytDlp.on('close', () => {
        const url = stdout
          .trim()
          .split('\n')
          .find((line) => line.trim().startsWith('http'));
        resolve(url || null);
      });
      ytDlp.on('error', () => resolve(null));
      setTimeout(() => {
        ytDlp.kill();
        resolve(null);
      }, 10000);
    });
  } catch (e) {
    return null;
  }
}