# 05 — UI: Tailwind 4, Components, Motion, Icons, Accessibility

## Tailwind CSS 4 (CSS-first)
- Entry stylesheet `app/globals.css`: `@import "tailwindcss";`. PostCSS uses `@tailwindcss/postcss` only. **No `tailwind.config.js`** unless truly required (then load with `@config`).
- Design tokens live in `@theme { --color-brand-500: …; --font-sans: …; --radius-card: …; }`. Use tokens, never arbitrary hard-coded hex/px in components (`bg-[#3b82f6]`, `w-[317px]` are review blockers unless truly one-off).
- Use **semantic tokens** (`--color-background`, `--color-foreground`, `--color-muted`, `--color-border`, `--color-primary`, `--color-destructive`) and swap values for dark mode via `.dark` / `prefers-color-scheme` + `@custom-variant dark (&:where(.dark, .dark *));`. Components reference semantic tokens, not raw palette colours.
- Utilities only; avoid `@apply` except in rare base/prose styles. No inline `style={{}}` for static values (dynamic values via CSS variables).
- v4 syntax: `bg-linear-to-r` (not `bg-gradient-to-r`), `shadow-xs`/`rounded-xs` scale shifts, `outline-hidden`, `ring` default width is 1px (use `ring-3` for old look), important modifier as suffix `p-4!`, CSS variable shorthand `bg-(--my-var)`. Do not use removed v3 utilities (`bg-opacity-*`, `flex-shrink-*`, `overflow-ellipsis`) — use `bg-black/50`, `shrink-*`, `text-ellipsis`.
- Mobile-first: base styles = mobile; add `sm:`/`md:`/`lg:` upward. Use container queries (`@container`, `@md:`) for reusable components.
- Order classes consistently (use the Prettier/oxfmt Tailwind sorting plugin if a formatter is added).

## `cn()` helper & variants
```ts
// lib/utils/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```
- Every component accepting `className` merges it last: `cn("base classes", variantClasses, className)`.
- Variants as typed lookup objects (`Record<Variant, string>`) or `cva` if adopted — never long ternary chains.
- Never build class names dynamically (`` `text-${color}-500` ``) — Tailwind cannot detect them. Use complete literal strings in maps.

## Component rules
- Primitives in `components/ui`: typed props extending native element props (`React.ComponentProps<"button">`), `ref` as prop (React 19), spread `...props` onto the root, sensible defaults.
- Components are presentational & composable; data fetching in server parents.
- Prefer composition (`children`, slots) over boolean prop explosions (`isLarge isPrimary isRounded`).
- Every data view implements **4 states**: loading (skeleton, not spinner-only), empty (call to action), error (retry), success. Skeletons match final layout to prevent layout shift.
- No inline anonymous components in render; no components defined inside components.
- Responsive and tested at 360px, 768px, 1280px. No horizontal scroll. Touch targets ≥ 44×44px.
- Use `next/image` and `next/link` (see `06`). Use `<button>` for actions, `<a>`/`Link` for navigation — never `<div onClick>`.

## Icons (lucide-react)
- Named per-icon imports only: `import { Check, Loader2 } from "lucide-react";` — never `import * as Icons` or dynamic icon-by-name lookups (breaks tree-shaking).
- Size/colour via classes (`size-4`, `text-muted-foreground`); stroke consistent app-wide.
- Decorative icons: `aria-hidden="true"`. Icon-only buttons need `aria-label`.
- Verify icon names exist in the installed version (renamed icons occur between majors).

## Motion (framer-motion)
- Import from `"framer-motion"` and use only in files with `"use client"`. Keep animated wrappers small leaf components so parents stay server-rendered.
- Reduce bundle: use `LazyMotion` + `m` components with `domAnimation` features (`strict` mode) for non-trivial pages; avoid importing `motion` in many tiny files on hot paths.
- **Respect reduced motion**: wrap app in `<MotionConfig reducedMotion="user">`; any non-essential motion must degrade to none/opacity-only.
- Animate only `transform` and `opacity` (GPU-friendly); never animate `width/height/top/left/box-shadow` on large trees — use `layout` prop sparingly.
- Keep durations 150–400ms for UI feedback, ease-out for entrances; define shared `variants`/transitions constants in `lib/motion.ts`; no magic numbers per component.
- `AnimatePresence` for exit animations with stable `key`s; never wrap whole pages in route-level animation that blocks navigation/LCP.
- No animation on above-the-fold LCP element's initial paint (don't start at `opacity: 0`) — it delays LCP. Use `viewport={{ once: true }}` for scroll reveals.
- Hydration safety: don't derive initial animation state from `window`/random values.

## Accessibility (WCAG 2.2 AA target)
- Semantic HTML first: `header/nav/main/footer/section/article`, one `<h1>` per page, heading levels in order, landmark `main` with skip-link.
- All interactive elements keyboard reachable, visible `:focus-visible` ring (never `outline-none` without replacement), logical tab order, no keyboard traps. Dialogs/menus: focus trap + restore focus + `Escape` to close (use native `<dialog>` or a vetted headless library).
- Colour contrast ≥ 4.5:1 (text), ≥ 3:1 (large text/UI). Never convey information by colour alone.
- Images have meaningful `alt` (or `alt=""` if decorative). Form inputs have associated `<label>`. Errors announced via `aria-live="polite"` / `role="alert"`.
- Dynamic updates (toasts, async results) in a live region. Don't auto-play media/motion; provide pause.
- Support zoom to 200% and text resize without loss. Use `rem`-based sizing; don't disable zoom in viewport meta.
- `jsx-a11y` lint rules stay on; fix, don't suppress.

## Theming & content
- Support light/dark via tokens; avoid flash of wrong theme (set class in a tiny blocking inline script or via cookie on server).
- Copy lives in constants/i18n files rather than deep in JSX if the app may localise. Use `Intl.*` for dates, numbers, currency — no hand formatting.
