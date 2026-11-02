# 02 — Next.js 16 & React 19
> Next 16 and React 19 changed many APIs. Do not write code from older memory (Next 13/14 patterns). Verify against the installed types (`09`).

## Server vs Client Components
- Everything is a **Server Component** by default. Add `"use client"` only for state, effects, event handlers, browser APIs, or client-only libs (framer-motion).
- Push `"use client"` **down the tree** to the smallest leaf (a `<LikeButton />`, not the page).
- Pass Server Components as `children`/props into Client Components to keep them on the server.
- Never import server-only code (Supabase admin, `sharp`, secrets, `server/*`) into a client component; guard with `import "server-only"`.
- Props crossing server→client must be serialisable (no functions except Server Actions, no class instances, no `Date` unless converted). Pass DTOs typed by the same schema the API contract uses (`08`), never raw DB rows.

## Async request APIs (Next 15+/16)
`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async** and are **external input**:
```tsx
const paramsSchema = z.strictObject({ id: idSchema });
type Props = { params: Promise<unknown>; searchParams: Promise<unknown> };
export default async function Page({ params, searchParams }: Props) {
  const p = paramsSchema.safeParse(await params);
  if (!p.success) notFound();                       // invalid id is a 404, never a 500
  const q = listQuerySchema.catch({ limit: 20 }).parse(await searchParams); // fallback to defaults, never throws
}
```
- `params`/`searchParams` are typed `unknown` and parsed with the domain schema from `lib/validations/<domain>.ts`; the same query schema feeds the API contract (`08`). `.catch()` fallbacks are the only permitted `.parse()` use on external input, and only with a total fallback.
- Use generated `PageProps`/`LayoutProps` helpers only if enabled and verified.

## Request interception: `proxy.ts`

- Next 16 renames `middleware.ts` → **`proxy.ts`** (export `proxy`, Node.js runtime). Never create `middleware.ts`.
- Only for: Supabase session refresh, coarse redirects (unauthenticated → `/login`), security headers/CSP nonce (`03`), `x-request-id` injection (`08`), locale. Fast; no heavy DB queries.
- The proxy is **not** the authorization layer. Re-check auth in every Server Action, route handler, and data function.

## Data fetching & caching

- Fetch on the server in the component that needs the data, via `src/server/queries/<domain>.ts`. Queries return DTOs already parsed by the response schema. Wrap shared reads in `React.cache()` for per-request dedupe.
- Parallelise independent fetches; use `<Suspense>` with meaningful fallbacks to stream slow parts. No request waterfalls.
- Caching is **opt-in** in Next 16:
  - Cache Components (`cacheComponents: true`) with `"use cache"` plus `cacheLife` / `cacheTag` for cacheable, non-user-specific data.
  - **Never cache user-specific or auth-dependent data** in a shared cache. Components reading `cookies()`/`headers()` are dynamic.
  - Invalidate with `revalidateTag(tag, profile)` (profile arg required), `updateTag(tag)` in Server Actions for read-your-writes, `revalidatePath`, or `refresh()`. Tag names are constants in `lib/cache-tags.ts`, never inline strings.
- Do not use `fetch` in Client Components for your own data. Use Server Components, Server Actions (form mutations), or `callApi` (`08`) from event handlers (search-as-you-type, load-more, polling) with an `AbortController`/`useTransition`.
- `loading.tsx` / `<Suspense>` for loading, `error.tsx` (client, with `reset`) and `global-error.tsx` for errors, `not-found.tsx` + `notFound()` for missing resources. Every data segment has all three.

## Mutations

- **Server Actions** for form mutations (progressive enhancement), wrapped by `runAction` (`04`); route handlers (`handleRoute`, `08`) for webhooks/public APIs/non-form clients.
- After a successful mutation: invalidate (`updateTag`/`revalidatePath`) inside the service, then `redirect()` **outside** `try/catch`. In any `try/catch` that wraps framework calls, call `unstable_rethrow(e)` first so `redirect`/`notFound` are not swallowed.
- `useActionState` for form state/errors, `useFormStatus` for pending buttons, `useOptimistic` for optimistic UI with rollback on `ok: false`.

## React 19 rules

- `ref` is a normal prop: **no `forwardRef`** in new code. `<Context value={…}>` directly (no `.Provider`).
- `use()` to read promises/context in client components when needed; prefer server fetch.
- Prefer the Next `metadata`/`generateMetadata` API over in-component `<title>`/`<meta>`.
- React Compiler (`reactCompiler: true` + `babel-plugin-react-compiler`) only after the build is verified; when on, no hand-added `useMemo`/`useCallback`/`memo` without profiling evidence. Off: memoise only with evidence.
- Hooks: top level only; complete dependency arrays (never disable `exhaustive-deps`). Prefer derived values over `useEffect` + `setState`. `useEffect` only for syncing with external systems; always return cleanup (listeners, timers, channels).
- Keys: stable unique ids, never array index for dynamic lists.
- State: colocate; lift only when shared. URL state (`searchParams`) for filters/pagination/tabs.
- No prop drilling past 2 levels: composition or context for truly global client state.
- Inputs: prefer uncontrolled + FormData for Server Action forms; controlled inputs always have `onChange`. Event handlers are typed (`React.ChangeEvent<HTMLInputElement>`, `React.FormEvent<HTMLFormElement>`); read values from `FormData` or state, never via casts on `e.target`.
- **Hydration safety**: no `Date.now()`, `Math.random()`, `window`, or `localStorage` in render output. Client-only values are read in effects. `suppressHydrationWarning` only for a documented case (e.g. a timestamp), never to hide a bug.
- Browser storage and `window`/`BroadcastChannel`/`postMessage` data is external input: parse with a schema (`08`) before use.

## Routing & files

- Route groups `(marketing)`, `(app)`, `(auth)` for layouts; private folders `_components` for colocation.
- `next/link` for internal navigation (never `<a href>`), `useRouter` only for imperative nav; `next/font`; `next/script` with the right `strategy`.
- `generateStaticParams` for known dynamic routes; set `dynamicParams` deliberately.
- `route.ts`: only named HTTP methods, each produced by `handleRoute`/`handleWebhook` (`08`); correct status codes come from the wrapper.
- Server Actions live in `app/<route>/actions.ts` (`"use server"`, async function exports only).

## `next.config.ts`

- Typed (`NextConfig`), `reactStrictMode: true`, `poweredByHeader: false`.
- `images.remotePatterns` explicit (protocol, hostname, pathname), no wildcard hosts.
- `serverActions.bodySizeLimit` set explicitly and consistent with `MAX_UPLOAD_BYTES` (`06`); `serverActions.allowedOrigins` minimal.
- Security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, HSTS in prod): owned by `03`.
- Turbopack is the default bundler; no webpack config unless unavoidable and documented. `next lint` is removed in Next 16: lint through `oxlint` scripts only.
- Config key names change between Next versions: confirm each in the installed `NextConfig` type before adding it (`09`).

## Environment
- Access env only via `@/lib/env/public` (client-safe) and `@/lib/env/server` (server-only), Zod-validated at startup (`03`). No raw `process.env.X` elsewhere (root config files excepted).
- Public vars are prefixed `NEXT_PUBLIC_` and contain nothing secret.
