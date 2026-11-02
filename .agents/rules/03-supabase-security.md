# 03 — Supabase, Auth, Env & Security
Owns: Supabase clients, auth, RLS, env, security headers/CSP. API request/response headers are owned by `08`.
## Clients (`@supabase/ssr` + `supabase-js`)
Exactly three client factories, nothing else:
| File | Factory | Use |
| --- | --- | --- |
| `lib/supabase/client.ts` | `createBrowserClient` | Client Components only (realtime, storage uploads with user session) |
| `lib/supabase/server.ts` | `createServerClient` | Server Components, Server Actions, route handlers |
| `lib/supabase/admin.ts` | `createClient` w/ service key, `import "server-only"` | Trusted server jobs only (webhooks, cron, idempotency store, admin tasks) |

- Always typed: `createServerClient<Database>(…)`. Types come from `npm run db:types`; regenerate after **every** migration; CI fails on a diff (`db:types:check`).
- Server client: create **per request**, never a module-level singleton. `cookies()` is async in Next 16: `await` it.
- Cookie adapter uses **`getAll` / `setAll` only** (never deprecated `get/set/remove`). `setAll` is wrapped in try/catch in Server Components (read-only there); session refresh happens in `proxy.ts`.
- `proxy.ts` refreshes the session and returns the response **with the cookies it set**; no logic between client creation and the auth call that could desync cookies.

## Authentication & authorization
- Server identity comes from **`supabase.auth.getUser()`** or a verified `getClaims()` (asymmetric JWT keys). **Never** authorise from `getSession()` or cookie contents alone.
- Centralise in `server/auth.ts` (wrapped with `React.cache`): `requireUser()` (throws `AppError("UNAUTHENTICATED")` or redirects), `getOptionalUser()`, `requireRole(role)`. Return types are explicit, not inferred from Supabase.
- **Every** Server Action, route handler, and data-access function checks auth itself (via `runAction`/`handleRoute`, `04`/`08`). Hidden UI or proxy redirects are not security.
- Authorization = RLS in the database + role checks in server code. Roles live in `app_metadata` (server-controlled), **never** `user_metadata` (user-editable). Parse claims with a Zod schema (`appMetadataSchema`, role as `z.enum`); an unknown or missing role means no access (fail closed).
- Resource ownership is checked in the service **and** enforced by RLS; never rely on only one.
- Post-login `next` redirects use `nextPathSchema` (`lib/validations/primitives.ts`): same-origin relative path only, not starting with `//`, no backslashes, `.catch("/")`.
- OAuth/magic-link callback exchanges the code (`exchangeCodeForSession`) server-side and handles errors.
- Enforce password/rate-limit settings in Supabase Auth config; enable email confirmation and CAPTCHA/rate limiting for public sign-up.

## Row Level Security (non-negotiable)

- **Every table in `public` has RLS enabled** (`alter table … enable row level security;`) in the same migration that creates it. No policy = no access (default-deny), as intended. `check:boundaries` greps migrations for `create table` without a matching enable-RLS statement.
- Policies per operation (`select`, `insert`, `update`, `delete`) and per role (`to authenticated` / `to anon`). No `for all` shortcuts.
- Use `(select auth.uid())` (subselect) in policies for plan caching; index every column used in policies (`user_id`, `org_id`).
- `update` policies need both `using` and `with check`. Never `using (true)` on user data; public read is an explicit, documented decision.
- Views: `security_invoker = true`. `security definer` functions: `set search_path = ''`, fully qualified names, non-exposed schema when possible, validate the caller inside.
- Storage: buckets private by default; `storage.objects` policies scoped by path prefix (`<user_id>/…`). Public buckets only for truly public assets.
- Tests (`supabase/tests/<domain>.test.sql`): at least anon, user A, user B, admin; allowed **and** denied cases. A policy without a negative test is unverified.

## Migrations & schema

- Schema changes **only** via `supabase/migrations/*.sql` (`supabase migration new <name>`); never edit prod via the dashboard. Forward-only, idempotent where possible, reviewed in PR, backward-compatible with the previous deploy (`07`).
- Conventions: `snake_case`, plural tables, `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at` via trigger, `not null` by default, FKs with explicit `on delete`, check constraints for enums/ranges (values mirror the shared `as const` arrays, `01`), indexes on FKs and filter columns.
- Run Supabase security/performance advisors after schema changes and fix findings.
- Column limits mirror Zod bounds (`varchar`/check length = schema `.max`); a mismatch is a bug in one of them.

## Querying
- Select only needed columns (`select("id, title")`), never `select("*")` in production paths. Typed selects keep the result type in sync with the DB.
- Always handle `{ data, error }`: check `error` first, map with `mapDbError` (`04`), never assume `data` non-null. `.maybeSingle()` when absence is valid, `.single()` when it is a bug.
- Paginate every list (`range()` or cursor), max page size 100, same limits as the contract (`08`).
- Never concatenate user input into `.or()`/`.filter()`; validate with Zod first and use typed filter methods.
- Multi-step writes that must be atomic → Postgres function (`rpc`) or transaction, not sequential client calls. RPC args and results are validated (Zod) on the TS side too.
- `jsonb` columns are `Json`: parse with Zod on read, and parse before write.
- Realtime: subscribe in a client effect, `removeChannel` on cleanup; RLS still governs delivery; parse every payload with its event schema (`08`).

## Secrets & environment
- `.env.example` documents every var (no values) and is updated in the same PR as `lib/env/*`. `.env.local` is git-ignored.
- `lib/env/public.ts` reads each var by **literal** access (`process.env.NEXT_PUBLIC_SUPABASE_URL`), because Next only inlines literal references; dynamic `process.env[key]` is `undefined` in the browser. Then parse the object with Zod.
- `lib/env/server.ts` starts with `import "server-only"`, validates all server vars, and is imported once at boot by `instrumentation.ts` so a bad deploy fails fast. These env modules are the only readers of `process.env` (root config files excepted).
- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key; safe only because RLS is on). Secret: `SUPABASE_SERVICE_ROLE_KEY` (or secret key): **server only, never prefixed `NEXT_PUBLIC_`, never logged, never sent to the client**. `check:boundaries` fails any `NEXT_PUBLIC_*` name containing SECRET, SERVICE, PRIVATE, or KEY (other than PUBLISHABLE/ANON).
- Rotate any key that was ever committed or logged. Separate Supabase projects per environment (`07`).

## Web security baseline
- **CSP** with nonces for scripts (set in `proxy.ts`) and strict `connect-src`/`img-src` allowing only the Supabase project URL and required origins. Start report-only, then enforce. Nonce CSP makes pages dynamic: accept that for authenticated areas; for public static pages prefer hash-based or report-only policy and verify the performance budget (`06`).
- Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny unused), `frame-ancestors 'none'`.
- CSRF: Server Actions check Origin; keep `serverActions.allowedOrigins` minimal. Custom state-changing handlers verify `Origin`/auth and use non-GET methods. No `Access-Control-Allow-Origin: *` on credentialed endpoints; cross-origin access uses an explicit allowlist.
- Rate-limit auth, upload, and public mutation endpoints (store-backed limiter, e.g. Upstash); 429 with `Retry-After` (`08`).
- Sanitise/escape user content rendered as HTML; prefer plain text. No `eval`, no `new Function`.
- Webhooks: verify signatures with constant-time comparison before parsing; idempotent by event id (`08`).
- Uploads: `06` (type, size, content checks) plus storage policies above.
- Never log PII, tokens, passwords, or full request bodies; redact (`04`). Client errors are generic; details go to server logs only.
- `npm audit --omit=dev` in CI; fix high/critical before merge.
