/**
 * Generate PWA icons (PNG) from an inline vector definition.
 *
 * The "S" mark is drawn as a stroked vector path so the output does not depend
 * on any system font being installed on the build machine.
 *
 * Requires the dev-only dependency `@resvg/resvg-js`:
 *   npm install --no-save @resvg/resvg-js
 *   node scripts/generate-icons.mjs
 *
 * Brand colours mirror static/favicon.svg (slate-900 background, sky-400 mark).
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(__dirname, '..', 'static');

const BG = '#0f172a';
const FG = '#38bdf8';

// Centerline of the "S", drawn inside a 512x512 viewBox.
const S_PATH =
  'M348 186 C348 156 312 144 256 144 C196 144 168 168 168 206 ' +
  'C168 242 196 256 256 256 C316 256 348 270 348 306 ' +
  'C348 344 320 368 256 368 C200 368 172 356 164 326';

/**
 * Build an SVG string.
 * @param {object} opts
 * @param {number} opts.size      output pixel size
 * @param {number} opts.radius    corner radius in viewBox units (0 = square)
 * @param {number} opts.scale     scale of the mark (1 = full, <1 = padded for maskable)
 */
function svg({ radius = 64, scale = 1 } = {}) {
  // Scale the S around the centre (256,256) for maskable safe-zone padding.
  const transform =
    scale === 1
      ? ''
      : ` transform="translate(${256 * (1 - scale)} ${256 * (1 - scale)}) scale(${scale})"`;
  const strokeWidth = 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" ry="${radius}" fill="${BG}"/>
  <path d="${S_PATH}" fill="none" stroke="${FG}" stroke-width="${strokeWidth}"
        stroke-linecap="round" stroke-linejoin="round"${transform}/>
</svg>`;
}

function render(svgString, size, outPath) {
  const resvg = new Resvg(svgString, { fitTo: { mode: 'width', value: size } });
  const png = resvg.render().asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${size}x${size})`);
}

const targets = [
  // Standard "any" icons (rounded square).
  { file: 'icons/icon-192.png', size: 192, svg: svg({ radius: 96, scale: 1 }) },
  { file: 'icons/icon-512.png', size: 512, svg: svg({ radius: 96, scale: 1 }) },
  // Maskable icons: full-bleed background, mark padded into the safe zone.
  { file: 'icons/icon-maskable-192.png', size: 192, svg: svg({ radius: 0, scale: 0.7 }) },
  { file: 'icons/icon-maskable-512.png', size: 512, svg: svg({ radius: 0, scale: 0.7 }) },
  // iOS home-screen icon: full square (iOS applies its own rounded mask).
  { file: 'apple-touch-icon.png', size: 180, svg: svg({ radius: 0, scale: 1 }) },
  // PNG favicon fallback for browsers that prefer it.
  { file: 'favicon-32.png', size: 32, svg: svg({ radius: 6, scale: 1 }) }
];

for (const t of targets) {
  render(t.svg, t.size, resolve(staticDir, t.file));
}
