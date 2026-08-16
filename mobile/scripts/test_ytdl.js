const ytdl = require('@distube/ytdl-core');

async function testYtdl() {
  const url = 'https://www.youtube.com/watch?v=yjs-2rxX_Ww';
  console.log("Getting info via @distube/ytdl-core...");
  const info = await ytdl.getInfo(url);
  const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
  console.log("Extracted format URL successfully:", !!format?.url);
  if (format?.url) {
    console.log("Sample URL:", format.url.substring(0, 120));
  }
}

testYtdl().catch(console.error);
