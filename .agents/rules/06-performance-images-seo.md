# 06 — Performance, Images (sharp), Bundle & SEO

## Performance budgets (fail review if exceeded without justification)
- LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 (p75, mobile).
- First-load JS per route ≤ 170 KB gzip; client component count kept minimal.
- No layout shift: reserve space for images, embeds, fonts, skeletons.
- Check with `next build` output, Lighthouse CI / Vercel Speed Insights, and bundle analyzer (`@next/bundle-analyzer`) before releases.

## Rendering & data
- Prefer static/cached rendering for public pages; stream dynamic parts with `<Suspense>`.
- Avoid request waterfalls: start independent fetches together (`Promise.all`), dedupe with `React.cache`.
- Never block render on non-critical work (analytics, logging) — fire after response (`after()` from `next/server`).
- DB: select only needed columns, paginate, index filter/sort/FK columns, avoid N+1 (fetch with joins/`in()`/RPC).
- Use `dynamic(() => import(…))` / `React.lazy` for heavy, below-the-fold or interaction-gated client components (charts, editors, modals). Do not lazy-load LCP content.
- Third-party scripts: `next/script` with `strategy="lazyOnload"`/`afterInteractive`; each script needs a justification.
- Avoid large client-side libraries (date, lodash, charting) — prefer native `Intl`, `structuredClone`, native array methods; import specific functions only.
- Debounce/throttle high-frequency handlers; clean up listeners, intervals, subscriptions.

## Images with `next/image`
- Always use `<Image>` (never raw `<img>`) for content images. Provide `width`/`height` or `fill` + sized parent, and accurate `sizes` for responsive images (`sizes="(min-width: 768px) 33vw, 100vw"`).
- Above-the-fold hero/LCP image: `priority` (or `fetchPriority="high"`); everything else lazy by default.
- Provide `alt` always; add `placeholder="blur"` with `blurDataURL` for large images.
- Remote images: declare in `images.remotePatterns` (exact hostname + pathname). Keep `images.formats` as `["image/avif","image/webp"]`; restrict `qualities` to the values actually used.
- Supabase Storage images: serve via the allowed host; prefer pre-sized variants over huge originals.
- Set `images.minimumCacheTTL` appropriately for immutable assets.

## `sharp` rules (server-side image processing)
- `sharp` is **Node.js only**: use in Server Actions, `route.ts` with `export const runtime = "nodejs"`, or scripts. **Never** import in client components, `proxy.ts` edge paths, or Edge runtime.
- Never trust the client's `Content-Type`/extension. Validate: size cap (e.g. ≤ 5 MB, enforced before buffering), allowed formats from detected metadata (`jpeg|png|webp|avif`), then re-encode.
- Safe pipeline template:
  ```ts
  import sharp from "sharp";
  const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await image.metadata();               // reject if format not allowlisted / dimensions absurd
  const out = await image.rotate()                   // honour EXIF orientation
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })                           // metadata (EXIF/GPS) stripped by default
    .toBuffer();
  ```
- Always `.rotate()` before resizing; never keep EXIF/GPS metadata of user uploads (`.withMetadata()` is forbidden for user content).
- Reject animated/huge inputs unless explicitly supported; set concurrency limits (`sharp.concurrency`) and wrap in timeouts. Process large batches in queues, not inline in requests.
- Store processed output in Supabase Storage under `<user_id>/<uuid>.<ext>` (random names; never user-provided filenames) with correct `contentType` and `cacheControl`.
- Handle errors (corrupt images throw): return `VALIDATION` result, never a 500 with internals.

## Fonts & CSS
- `next/font` only; subset to needed characters; limit to ≤ 2 families/≤ 4 weights; `display: "swap"`; preload only the primary font.
- Keep CSS in Tailwind; avoid shipping unused global CSS; no `@import` of external CSS.

## Metadata & SEO
- Define `metadata` / `generateMetadata` for every public route: unique `title` (template via root layout `title.template`), `description` (≤ 160 chars), `alternates.canonical`, Open Graph + Twitter cards (`opengraph-image` via `ImageResponse`), `robots` for private/auth pages (`noindex`).
- Add `app/sitemap.ts`, `app/robots.ts`, `manifest.ts`, favicon/app icons.
- Use JSON-LD structured data (`<script type="application/ld+json">` with escaped `<`) where relevant.
- Semantic headings and readable URLs (kebab-case slugs); 301 for moved URLs via `redirects()`; proper `404` status through `notFound()`.
- `lang` attribute on `<html>`; `viewport` via the `viewport` export (don't disable zoom).

## Caching headers & assets
- Static assets in `public/` are cached by Next; hashed `_next/static` is immutable. For custom route responses set `Cache-Control` intentionally (`private, no-store` for user data).
- Never cache responses containing user-specific data on a shared cache/CDN.
- Prefer SVG for icons/logos (optimised with SVGO) and AVIF/WebP for photos; compress video, lazy-load iframes (`loading="lazy"`).

## Production readiness checklist (before release)
- [ ] `next build` clean; no warnings; bundle sizes reviewed
- [ ] Env vars validated in all environments; no secrets exposed to client (inspect `.next/static` for leaks)
- [ ] RLS policies tested; advisors clean
- [ ] Error pages (`error`, `global-error`, `not-found`) present; error tracking live
- [ ] Security headers/CSP enforced; rate limits on public mutations
- [ ] Lighthouse ≥ 90 (Perf/A11y/Best Practices/SEO) on key pages (mobile)
- [ ] Sitemap/robots/metadata verified; OG images render
- [ ] Backups/PITR enabled on Supabase; migration rollback plan documented
- [ ] Health check and uptime monitoring configured
