#!/usr/bin/env node
/**
 * Compress images in public/ for faster loads.
 * - Resizes very large photos to max 1920px wide
 * - Re-encodes JPEG/PNG with sharp
 * - Writes matching .webp companions for heroes/photos (same basename)
 *
 * Run: npm run compress-images
 */
import { readdir, stat, writeFile } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

const EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const MAX_WIDTH = 1920;
const JPEG_QUALITY = 78;
const PNG_QUALITY = 80;
const WEBP_QUALITY = 78;

async function compressImages() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Run: npm install sharp');
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.')) {
        await walk(full);
      } else if (e.isFile() && EXTENSIONS.includes(extname(e.name).toLowerCase())) {
        await compress(full, sharp);
      }
    }
  }

  async function compress(path, sharpLib) {
    try {
      const ext = extname(path).toLowerCase();
      const origSize = (await stat(path)).size;
      totalBefore += origSize;

      const meta = await sharpLib(path).rotate().metadata();
      let pipeline = sharpLib(path).rotate();
      if ((meta.width || 0) > MAX_WIDTH) {
        pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      }

      const isPng = ext === '.png';
      const buffer = await pipeline
        .clone()
        [isPng ? 'png' : 'jpeg']({
          quality: isPng ? PNG_QUALITY : JPEG_QUALITY,
          mozjpeg: !isPng,
          compressionLevel: isPng ? 9 : undefined,
        })
        .toBuffer();

      // Only overwrite if smaller (or resized)
      if (buffer.length < origSize || (meta.width || 0) > MAX_WIDTH) {
        await writeFile(path, buffer);
        totalAfter += buffer.length;
        const saved = ((1 - buffer.length / origSize) * 100).toFixed(1);
        console.log(
          `${path.replace(PUBLIC, 'public')}: ${(origSize / 1024).toFixed(1)}KB → ${(buffer.length / 1024).toFixed(1)}KB (${saved}% smaller)`
        );
      } else {
        totalAfter += origSize;
        console.log(`${path.replace(PUBLIC, 'public')}: already optimal (${(origSize / 1024).toFixed(1)}KB)`);
      }

      // WebP companion for large photos (skip tiny icons)
      if (origSize > 40 * 1024 && !isPng) {
        const webpPath = join(dirname(path), `${basename(path, ext)}.webp`);
        let webpPipe = sharpLib(path).rotate();
        if ((meta.width || 0) > MAX_WIDTH) {
          webpPipe = webpPipe.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        }
        const webpBuf = await webpPipe.webp({ quality: WEBP_QUALITY }).toBuffer();
        await writeFile(webpPath, webpBuf);
        console.log(`  + ${webpPath.replace(PUBLIC, 'public')}: ${(webpBuf.length / 1024).toFixed(1)}KB`);
      }
    } catch (err) {
      console.warn(`Skip ${path}:`, err.message);
    }
  }

  console.log('Compressing images in public/...');
  await walk(PUBLIC);
  if (totalBefore > 0) {
    console.log(
      `Done. Total: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB`
    );
  } else {
    console.log('Done.');
  }
}

compressImages().catch((e) => {
  console.error(e);
  process.exit(1);
});
