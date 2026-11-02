# 02 — Next.js 16 & React 19

> Next 16 and React 19 changed many APIs. Do not write code from older memory (Next 13/14 patterns). Verify against installed version.

## Server vs Client Components
- Everything is a **Server Component** by default. Add `"use client"` only when you need: state, effects, event handlers, browser APIs, or client-only libs (framer-motion).
- Push `"use client"` **down the tree** to the smallest leaf (e.g. a `<LikeButton />`, not the whole page).
- Pass Server Components as `children`/props into Client Components to keep them on the server.
- Never import server-only code (Supabase admin, `sharp`, secrets) into a client component. Guard with `import "server-only"`.
- Props crossing the server→client boundary must be serialisable (no functions except Server Actions, no class instances, no Dates unless converted).

## Async request APIs (Next 15+/16)
`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async**:
```tsx
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> };
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { q } = await searchParams;
}
```
Always validate `params`/`searchParams` with Zod before use. Use generated `PageProps`/`LayoutProps` helpers if enabled.

## Request interception: `proxy.ts`
- Next 16 renames `middleware.ts` → **`proxy.ts`** (export `proxy` function, Node.js runtime). Do not create `middleware.ts`.
- Use it only for: Supabase session refresh, coarse redirects (unauthenticated → `/login`), security headers, locale. Keep it fast; no heavy DB queries.
- Proxy is **not** the authorization layer. Re-check auth in every Server Action, route handler, and data function.

## Data fetching & caching
- Fetch on the server, in the component that needs the data, via functions in `src/server/**`. Wrap shared reads in `React.cache()` for per-request dedupe.
- Parallelise independent fetches; use `<Suspense>` boundaries with meaningful fallbacks to stream slow parts. Avoid request waterfalls.
- Caching is **opt-in** in Next 16. Be explicit:
  - Use Cache Components (`cacheComponents: true` in `next.config.ts`) with the `"use cache"` directive plus `cacheLife` / `cacheTag` for cacheable, non-user-specific data.
  - **Never cache user-specific or auth-dependent data** in a shared cache.
  - Invalidate with `revalidateTag(tag, profile)` (Next 16 requires the profile arg), `updateTag(tag)` in Server Actions for read-your-writes, `revalidatePath`, or `refresh()`.
- Do not use `fetch` in Client Components for your own data; use Server Components, Server Actions, or a route handler.
- Use `loading.tsx` / `<Suspense>` for loading, `error.tsx` (client component with `reset`) for errors, `not-found.tsx` + `notFound()` for missing resources. Every route segment with data needs these states.

## Mutations
- Use **Server Actions** for form mutations (progressive enhancement), route handlers for webhooks/public APIs/non-form clients. See `04`.
- After mutation: `updateTag`/`revalidatePath` then `redirect()` (call `redirect` outside `try/catch`).
- Use `useActionState` for form state/errors, `useFormStatus` for pending buttons, `useOptimistic` for optimistic UI.

## React 19 rules
- `ref` is a normal prop for function components — **do not use `forwardRef`** in new code.
- Use `use()` to read promises/context in client components when needed; prefer server fetch.
- `<Context value={…}>` directly (no `.Provider`).
- Document metadata (`<title>`, `<meta>`) may be rendered in components, but prefer the Next `metadata`/`generateMetadata` API.
- Enable React Compiler (`reactCompiler: true`, plus `babel-plugin-react-compiler`) **only after** verifying build; when enabled, do not hand-add `useMemo`/`useCallback`/`memo` unless profiling proves need. Without the compiler, memoise only with evidence.
- Hooks: top-level only; complete dependency arrays (never disable `exhaustive-deps`). Prefer derived values over `useEffect` + `setState`. `useEffect` is for syncing with external systems only; always return cleanup.
- Keys: stable unique IDs, never array index for dynamic lists.
- State: colocate; lift only when shared. Prefer URL state (`searchParams`) for filters/pagination/tabs so views are shareable.
- No prop drilling past 2 levels: use composition (`children`) or context for truly global client state.
- Controlled inputs must have `onChange`; prefer uncontrolled + FormData in Server Action forms.

## Routing & files
- Use route groups `(marketing)`, `(app)`, `(auth)` for layout separation; private folders `_components` for colocation.
- Use `next/link` for navigation (never `<a href>` for internal links), `useRouter` only for imperative nav.
- Use `next/font` for fonts (self-hosted, `display: "swap"`); no external font `<link>` tags.
- Use `next/script` with the right `strategy` for third-party scripts.
- `generateStaticParams` for known dynamic routes; set `dynamicParams` deliberately.
- `route.ts` handlers: export only named HTTP methods; return `Response`/`NextResponse.json`; set status codes correctly.

## `next.config.ts`
- Typed config (`NextConfig`), `reactStrictMode: true`, `poweredByHeader: false`.
- Declare `images.remotePatterns` explicitly (protocol, hostname, pathname) — no wildcard hosts.
- Add security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`, HSTS in prod) — see `03`.
- Turbopack is the default bundler; do not add webpack config unless unavoidable and documented.
- `next lint` is removed in Next 16: linting runs through `oxlint` scripts only.

## Environment
- Access env only via `@/lib/env` (Zod-validated at startup). No raw `process.env.X` scattered in code.
- Public vars must be prefixed `NEXT_PUBLIC_` and contain nothing secret.
