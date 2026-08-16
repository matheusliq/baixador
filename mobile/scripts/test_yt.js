const cookie = 'SOCS=CAESEwgDEgk2OTcyMTY5MzAaAmVuIAEaBgiA_L20Bg; CONSENT=YES+cb.20210328-17-p0.en+FX+417';

async function testAudio() {
  const htmlRes = await fetch('https://www.youtube.com/watch?v=yjs-2rxX_Ww', {
    headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await htmlRes.text();
  const apiKey = html.split('INNERTUBE_API_KEY":"')[1]?.split('"')[0];
  console.log("API Key extracted:", apiKey);

  const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      videoId: 'yjs-2rxX_Ww',
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.02.39',
          androidSdkVersion: 34
        }
      }
    })
  });

  const data = await playerRes.json();
  const formats = data?.streamingData?.adaptiveFormats || [];
  const audioFormat = formats.find(f => f.mimeType && f.mimeType.includes('audio') && f.url);
  console.log("Audio URL extracted successfully:", !!audioFormat?.url);
  if (audioFormat?.url) {
    console.log("Sample URL:", audioFormat.url.substring(0, 120));
  }
}

testAudio().catch(console.error);
