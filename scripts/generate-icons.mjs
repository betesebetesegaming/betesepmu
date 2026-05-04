import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// SVG icon: green rounded square, white B, yellow BETESEPMU text
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="200" fill="#008000"/>
  <text x="512" y="540" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="580" fill="white" text-anchor="middle" dominant-baseline="middle">B</text>
  <rect x="80" y="730" width="864" height="6" fill="#FFFF00" rx="3"/>
  <text x="512" y="910" font-family="Arial, sans-serif" font-weight="700" font-size="90" fill="#FFFF00" text-anchor="middle" letter-spacing="8">BETESEPMU</text>
</svg>`;

// Write master SVG
fs.writeFileSync(path.join(root, 'icon.svg'), svgIcon);
console.log('✓ icon.svg written to project root');

// Android mipmap folder sizes
const androidSizes = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

// Write sized SVGs as placeholders — swap with real PNGs after installing sharp
for (const { folder, size } of androidSizes) {
  const dir = path.join(resDir, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const sized = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <rect width="1024" height="1024" rx="200" fill="#008000"/>
  <text x="512" y="540" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="580" fill="white" text-anchor="middle" dominant-baseline="middle">B</text>
  <rect x="80" y="730" width="864" height="6" fill="#FFFF00" rx="3"/>
  <text x="512" y="910" font-family="Arial, sans-serif" font-weight="700" font-size="90" fill="#FFFF00" text-anchor="middle" letter-spacing="8">BETESEPMU</text>
</svg>`;
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.svg'), sized);
}

console.log('✓ Android SVG icons written to all mipmap folders');
console.log('');
console.log('Next step: Open icon.svg in any image editor (Inkscape/Illustrator/Canva)');
console.log('Export as PNG at 1024x1024, then use Android Studio Image Asset Studio to generate all sizes.');
