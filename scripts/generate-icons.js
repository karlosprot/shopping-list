// Run: node scripts/generate-icons.js
// Creates minimal PWA placeholder icons (valid 1x1 PNG)

const fs = require("fs");
const path = require("path");

const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const publicDir = path.join(__dirname, "..", "public");
[192, 512].forEach((size) => {
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), minimalPng);
  console.log(`Created icon-${size}.png`);
});
