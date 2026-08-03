const pngToIco = require('png-to-ico');
const fs = require('fs');
const files = ['favicon-16x16.png', 'favicon-32x32.png'];
pngToIco(files)
  .then((buf) => fs.writeFileSync('favicon.ico', buf))
  .then(() => console.log('wrote favicon.ico'))
  .catch((err) => {
    console.error('favicon generation failed:', err);
    process.exit(1);
  });
