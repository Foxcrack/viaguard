import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const dir = path.resolve(process.cwd(), "..", "web", "public", "samples");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function createSamples() {
  console.log("Generating sample test images in:", dir);

  // 1. Road Pothole
  const potholeSvg = Buffer.from(`
    <svg width="800" height="600">
      <rect width="800" height="600" fill="#2b303c" />
      <path d="M 0 300 Q 400 280 800 300" stroke="#1f232b" stroke-width="30" fill="none" />
      <line x1="100" y1="300" x2="250" y2="300" stroke="#d1a153" stroke-width="6" stroke-dasharray="30,20" />
      <line x1="350" y1="300" x2="500" y2="300" stroke="#d1a153" stroke-width="6" stroke-dasharray="30,20" />
      <line x1="600" y1="300" x2="750" y2="300" stroke="#d1a153" stroke-width="6" stroke-dasharray="30,20" />
      <ellipse cx="420" cy="380" rx="130" ry="75" fill="#0e1117" stroke="#1a1f29" stroke-width="10" />
      <ellipse cx="415" cy="385" rx="90" ry="50" fill="#07090c" />
      <path d="M 300 370 L 330 390 L 360 375" stroke="#11151d" stroke-width="5" fill="none" />
      <path d="M 530 380 L 570 405 L 610 395" stroke="#11151d" stroke-width="4" fill="none" />
    </svg>
  `);
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 43, g: 48, b: 60 },
    },
  })
    .composite([{ input: potholeSvg }])
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, "road-sample-pothole.jpg"));

  // 2. Road Cracks
  const crackSvg = Buffer.from(`
    <svg width="800" height="600">
      <rect width="800" height="600" fill="#333945" />
      <path d="M 200 150 L 260 220 L 340 210 L 380 290 L 450 310 L 480 400 L 550 430" stroke="#11151c" stroke-width="6" fill="none" />
      <path d="M 260 220 L 290 280 L 380 290" stroke="#11151c" stroke-width="4" fill="none" />
      <path d="M 340 210 L 410 240 L 450 310" stroke="#11151c" stroke-width="5" fill="none" />
      <path d="M 410 240 L 520 250 L 590 320 L 550 430" stroke="#11151c" stroke-width="4" fill="none" />
      <circle cx="680" cy="200" r="50" fill="#474f5d" stroke="#1e232a" stroke-width="8" />
      <circle cx="680" cy="200" r="38" fill="#3e4552" stroke="#1e232a" stroke-width="3" stroke-dasharray="10,8" />
    </svg>
  `);
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 51, g: 57, b: 69 },
    },
  })
    .composite([{ input: crackSvg }])
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, "road-sample-cracks.jpg"));

  // 3. Construction Before
  const constBeforeSvg = Buffer.from(`
    <svg width="800" height="600">
      <rect width="800" height="600" fill="#574332" />
      <polygon points="50,150 750,150 700,550 100,550" fill="#3d2c20" stroke="#261a12" stroke-width="8" />
      <circle cx="250" cy="350" r="30" fill="#6e5540" />
      <circle cx="320" cy="390" r="20" fill="#503d2e" />
      <circle cx="500" cy="420" r="40" fill="#6e5540" />
    </svg>
  `);
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 87, g: 67, b: 50 },
    },
  })
    .composite([{ input: constBeforeSvg }])
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, "construction-before-site.jpg"));

  // 4. Construction After
  const constAfterSvg = Buffer.from(`
    <svg width="800" height="600">
      <rect width="800" height="600" fill="#574332" />
      <polygon points="50,150 750,150 700,550 100,550" fill="#3d2c20" />
      <rect x="150" y="200" width="500" height="240" fill="#9ca3af" stroke="#4b5563" stroke-width="6" />
      <line x1="150" y1="320" x2="650" y2="320" stroke="#6b7280" stroke-width="4" />
      <line x1="180" y1="100" x2="180" y2="450" stroke="#f59e0b" stroke-width="6" />
      <line x1="300" y1="100" x2="300" y2="450" stroke="#f59e0b" stroke-width="6" />
      <line x1="420" y1="100" x2="420" y2="450" stroke="#f59e0b" stroke-width="6" />
      <line x1="540" y1="100" x2="540" y2="450" stroke="#f59e0b" stroke-width="6" />
      <line x1="160" y1="180" x2="560" y2="180" stroke="#f59e0b" stroke-width="5" />
      <line x1="160" y1="280" x2="560" y2="280" stroke="#f59e0b" stroke-width="5" />
      <line x1="180" y1="180" x2="300" y2="280" stroke="#d97706" stroke-width="3" />
      <line x1="300" y1="180" x2="180" y2="280" stroke="#d97706" stroke-width="3" />
      <line x1="300" y1="180" x2="420" y2="280" stroke="#d97706" stroke-width="3" />
      <line x1="420" y1="180" x2="300" y2="280" stroke="#d97706" stroke-width="3" />
    </svg>
  `);
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 87, g: 67, b: 50 },
    },
  })
    .composite([{ input: constAfterSvg }])
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, "construction-after-site.jpg"));

  console.log("Sample test images generated successfully!");
}

createSamples();

