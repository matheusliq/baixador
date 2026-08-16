const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Criar um SVG base em memoria (quadrado verde com nota musical no centro)
const svgBuffer = Buffer.from(`
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#22c55e" rx="100" />
  <text x="50%" y="55%" font-size="250" font-family="sans-serif" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">🎵</text>
</svg>
`);

async function generate() {
  console.log("Gerando icones PWA...");
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
    console.log(`✅ Gerado: icon-${size}x${size}.png`);
  }
}

generate().catch(console.error);
