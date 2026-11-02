import { z } from 'zod';

export const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_DIMENSION = 1600;
export const MAX_INPUT_PIXELS = 40_000_000; // DoS defense per Rule 06

export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  '.tiff',
  '.tif',
  '.bmp',
  '.svg',
] as const;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
  'image/svg+xml',
] as const;

export const imageMetaSchema = z.object({
  filename: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(MAX_IMAGE_SIZE_BYTES),
  contentType: z.string().trim().max(100),
});

export type ImageMetaInput = z.infer<typeof imageMetaSchema>;

export function isAllowedImage(filename: string, contentType: string): boolean {
  const lowerName = filename.toLowerCase();
  const lowerType = contentType.toLowerCase();

  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime =
    lowerType.startsWith('image/') ||
    ALLOWED_MIME_TYPES.includes(lowerType as (typeof ALLOWED_MIME_TYPES)[number]);

  return hasValidExt || hasValidMime;
}
