# 03 — Supabase, Auth & Security

## Clients (`@supabase/ssr` + `supabase-js`)
Exactly three client factories, nothing else:
| File | Factory | Use |
|---|---|---|
| `lib/supabase/client.ts` | `createBrowserClient` | Client Components only (realtime, storage uploads with user session) |
| `lib/supabase/server.ts` | `createServerClient` | Server Components, Server Actions, route handlers |
| `lib/supabase/admin.ts` | `createClient` w/ service key, `import "server-only"` | Trusted server jobs only (webhooks, cron, admin tasks) |

- Always type: `createServerClient<Database>(…)`. Generate types: `supabase gen types typescript --project-id <id> > src/types/database.types.ts`. Regenerate after every migration.
- Server client: create **per request** (never a module-level singleton). `cookies()` is async in Next 16 — `await` it.
- Cookie adapter uses **`getAll` / `setAll` only** (never the deprecated `get/set/remove`). `setAll` is wrapped in try/catch in Server Components (cookies are read-only there); session refresh happens in `proxy.ts`.
- `proxy.ts` must refresh the session and return the response **with the cookies it set**; do not run logic between client creation and the auth call that could desync cookies.

## Authentication & authorization
- On the server, identity comes from **`supabase.auth.getUser()`** (validates with Auth server) or a verified `getClaims()` (asymmetric JWT keys). **Never** authorise from `getSession()` or from cookie contents alone.
- Centralise in `server/auth.ts`: `requireUser()` (redirects/throws if unauthenticated), `getOptionalUser()`. Wrap with `React.cache`.
- **Every** Server Action, route handler, and data-access function checks auth itself. Hiding UI or proxy redirects is not security.
- Authorization = RLS in the database + role checks in server code. Roles/claims live in `app_metadata` (server-controlled), **never** in `user_metadata` (user-editable).
- Redirect targets after login (`next` param) must be validated as same-origin relative paths (open-redirect protection).
- OAuth/magic-link callback route exchanges the code (`exchangeCodeForSession`) server-side and handles errors.
- Enforce password/rate-limit settings in Supabase Auth config; enable email confirmation and CAPTCHA/rate limiting for public sign-up.

## Row Level Security (non-negotiable)
- **Every table in `public` has RLS enabled** (`alter table … enable row level security;`) in the same migration that creates it. No policy = no access (default-deny) — that is intended.
- Write policies per operation (`select`, `insert`, `update`, `delete`) and per role (`to authenticated` / `to anon`). Avoid `for all` shortcuts.
- Use `(select auth.uid())` (wrapped in a subselect) in policies for query-plan caching; index every column used in policies (`user_id`, `org_id`).
- `update` policies need both `using` and `with check`.
- Never write `using (true)` on tables with user data. Public read must be an explicit, documented decision.
- Views: use `security_invoker = true`. `security definer` functions must `set search_path = ''`, fully qualify names, live in a non-exposed schema when possible, and validate caller identity inside.
- Storage: buckets private by default; add `storage.objects` policies scoped by path prefix (`<user_id>/…`). Public buckets only for truly public assets.
- Test policies with at least: anon, user A, user B, admin. A policy without a negative test is unverified.

## Migrations & schema
- Schema changes **only** via `supabase/migrations/*.sql` (`supabase migration new <name>`); never edit prod via the dashboard. Migrations are forward-only, idempotent where possible, reviewed in PR.
- Conventions: `snake_case`, plural table names, `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at` via trigger, `not null` by default, FKs with explicit `on delete` behaviour, check constraints for enums/ranges, indexes on FKs and filter columns.
- Run the Supabase security/performance advisors after schema changes and fix findings.

## Querying
- Select only needed columns (`select("id, title")`), never `select("*")` in production paths.
- Always handle `{ data, error }`: check `error` first; map to `AppError`; never assume `data` non-null. Prefer `.single()`/`.maybeSingle()` deliberately (`maybeSingle` when absence is valid).
- Paginate every list (`range()` or cursor); set sane max page size (≤ 100).
- Never build filters by string-concatenating user input into `.or()`/`.filter()` — validate with Zod first and use typed filter methods.
- Multi-step writes that must be atomic → a Postgres function (`rpc`) or transaction, not sequential client calls.
- Validate JSON columns on read with Zod; DB types for `jsonb` are `Json`, not trustworthy shapes.
- Realtime: subscribe in a client effect, always `removeChannel` on cleanup; RLS still governs what is delivered.

## Secrets & environment
- `.env.example` documents every var (no values). `.env.local` is git-ignored.
- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key — safe only because RLS is on). Secret: `SUPABASE_SERVICE_ROLE_KEY` (or secret key) — **server only, never prefixed `NEXT_PUBLIC_`, never logged, never sent to client**.
- Validate all env with Zod in `lib/env.ts` and fail fast at boot. Separate schemas for server and public vars.
- Rotate any key that has ever been committed or logged.

## Web security baseline
- **CSP** with nonces for scripts (via `proxy.ts`) and strict `connect-src`/`img-src` allowing only the Supabase project URL and required origins. Start in report-only, then enforce.
- Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny unused), `frame-ancestors 'none'`.
- Server Actions are CSRF-protected by Origin checks; keep `serverActions.allowedOrigins` minimal. Custom state-changing route handlers must verify `Origin`/auth and use non-GET methods.
- Rate-limit auth, upload, and public mutation endpoints (edge/store-backed limiter or Supabase/Upstash).
- Sanitise/escape any user content rendered as HTML; prefer plain text rendering. No `eval`, no `new Function`.
- Webhooks: verify signatures with constant-time comparison before parsing; make handlers idempotent.
- File uploads: see `06` (type, size, content checks) and storage policies above.
- Never log PII, tokens, passwords, or full request bodies. Redact.
- Error responses to clients are generic; details go to server logs only.
- Run `npm audit --omit=dev` in CI; fix high/critical before merge.
