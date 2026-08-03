const sharp = require('sharp');
const sizes = [16, 32, 64, 128, 192, 256, 512];
const svgPath = 'app-icon.svg';
(async () => {
  for (const size of sizes) {
    const out = size === 16 ? 'favicon-16x16.png' : size === 32 ? 'favicon-32x32.png' : size === 512 ? 'icon-512x512.png' : `icon-${size}x${size}.png`;
    await sharp(svgPath).resize(size, size).png({ quality: 100 }).toFile(out);
    console.log('wrote', out);
  }
  await sharp(svgPath).resize(180, 180).png({ quality: 100 }).toFile('apple-touch-icon.png');
  console.log('wrote apple-touch-icon.png');
})();
