import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { AppError } from '../errors.js';

const IMAGE_SIGNATURES = [
  { ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', matches: (b) => b.subarray(0, 4).toString('latin1') === '\x89PNG' },
  {
    ext: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('file');

export const pdfUpload = multer({
  dest: config.paths.storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
}).single('file');

// File type is taken from the contents, not the client's filename or MIME type.
export async function saveCover(file) {
  if (!file) throw new AppError(400, 'Choose an image to upload');
  const type = IMAGE_SIGNATURES.find((s) => s.matches(file.buffer));
  if (!type) throw new AppError(400, 'Cover must be a JPG, PNG or WebP image');
  const name = `cover-${crypto.randomUUID()}.${type.ext}`;
  await fs.writeFile(path.join(config.paths.uploads, name), file.buffer);
  return `/uploads/${name}`;
}

export async function savePdf(file) {
  if (!file) throw new AppError(400, 'Choose a PDF to upload');
  const handle = await fs.open(file.path);
  const header = Buffer.alloc(5);
  await handle.read(header, 0, 5, 0);
  await handle.close();
  if (header.toString('latin1') !== '%PDF-') {
    await fs.unlink(file.path);
    throw new AppError(400, 'The file is not a valid PDF');
  }
  const name = `${crypto.randomUUID()}.pdf`;
  await fs.rename(file.path, path.join(config.paths.storage, name));
  return name;
}

export async function removeFile(dir, name) {
  if (name) await fs.rm(path.join(dir, path.basename(name)), { force: true });
}
