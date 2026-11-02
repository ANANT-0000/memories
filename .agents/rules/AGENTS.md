# AGENTS.md — Project Rules (Entry Point)

Applies to every AI agent and human contributor. Read this file first, then the topic files in `.rules/` for the area you touch **before writing code**. These files are rules only: reading them never means "install or set up something"; installs follow `07`. If a rule conflicts with a user request, state the conflict and ask; never silently break a rule.

## Precedence (how conflicts are resolved)

1. This file's **NEVER list** and **Definition of Done** win over everything.
2. Then the **owning** topic file (Ownership map). Other files only *reference* it, never redefine it. Names and paths come from the **Canonical registry** below.
3. If two rules still conflict, the **stricter** one applies; stop, report it, and fix the docs in the same PR.
4. Code samples are templates: they must pass `typecheck` and `lint`. If a sample and the installed library types disagree, the installed types win, then fix the sample.
5. `package.json` + lockfile are the truth for versions. The stack list is a summary.
6. Every rule file (including this one) stays **≤ 12,000 characters** (target ≤ 11,000). Over budget: tighten or move detail to the owning file; never create parallel rule files.

## RULE ZERO — Code intelligence first (mandatory)

Full workflow and risk levels: `00`.

1. **Orient**: read `graphify-out/GRAPH_REPORT.md`; `graphify query "<question>"` for architecture questions.
2. **Explore**: GitNexus MCP `query` / `context` for symbols, callers, callees. Grep only if the graph cannot answer.
3. **Before editing any exported symbol, Zod schema, contract, or DB type**: run impact analysis and state the blast radius. HIGH/CRITICAL risk, or anything touching auth, RLS, payments, contracts, or shared `ui/` primitives, needs user confirmation first.
4. **Rename/move**: GitNexus `rename`, never blind find-and-replace.
5. **Before commit**: `detect_changes` on the diff; confirm scope.
6. **After structural changes**: `npx gitnexus analyze` and `/graphify . --update`.
7. If the tools are missing, say so, give the setup commands from `00`, and never claim analysis was done when it was not. Docs-only or comment-only edits are exempt.

## Stack (summary; `package.json` is the truth)

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (`@supabase/ssr`, `supabase-js`) · Zod 4 · framer-motion · lucide-react · sharp · oxlint · Prettier · Vitest · Playwright · knip · husky + lint-staged + commitlint.

## Ownership map (one owner per topic)

| File | Owns | Read when |
| --- | --- | --- |
| `00-code-intelligence-gitnexus-graphify.md` | Graph tooling, impact analysis, risk levels | **Always, first** |
| `01-typescript-code-quality.md` | tsconfig, typing, naming, lint config | Writing any TS |
| `02-nextjs-react.md` | RSC, caching, routing, `proxy.ts`, React 19, `next.config.ts` | Pages, layouts, components |
| `03-supabase-security.md` | Supabase clients, auth, RLS, env, security headers, CSP | Auth, DB, storage, secrets |
| `04-validation-api-errors.md` | Zod rules, `Result`/`AppError`, `runAction`, forms, logging | Server Actions, validation |
| `05-ui-tailwind-motion-a11y.md` | Tailwind, components, form UI, motion, a11y | Styling, UI |
| `06-performance-images-seo.md` | Budgets, `next/image`, sharp, uploads, SEO, release checklist | Images, bundle, metadata |
| `07-git-tooling-ci.md` | Commits, scripts, deps, tests, CI | Commits, CI, dependencies |
| `08-contracts-end-to-end-validation.md` | Contracts, `handleRoute`, `callApi`, API headers, events, drift checks, wiring checklist | Any client↔server data flow |
| `09-ai-verification-anti-hallucination.md` | Verification protocol, trap list, report format | **Always** |

## Canonical registry (one name, one path, one owner)

| Concept | Name and path | Owner |
| --- | --- | --- |
| Result envelope | `Result<T>`, `ok`, `fail` in `lib/result.ts` | 04 |
| Errors | `AppError`, `ERROR_CODES`, `STATUS_BY_CODE`, `toFieldErrors` in `lib/errors.ts` | 04 |
| DB error mapper | `mapDbError` in `server/db-error.ts` | 04 |
| Server Action wrapper | `runAction` in `server/action.ts` | 04 |
| Form helpers | `formDataToObject`, `echoValues`, `FormState` in `lib/validations/form-data.ts` | 04 |
| Shared schemas | `lib/validations/{primitives,upload,events,<domain>}.ts` | 04 |
| Logger | `logger` in `lib/logger.ts` | 04 |
| Contracts | `defineContract`, `envelopeSchema` in `lib/contracts/define.ts`; `lib/contracts/<domain>.ts` | 08 |
| Route wrappers | `handleRoute`, `handleWebhook` in `server/route.ts` | 08 |
| Browser API client | `callApi` in `lib/api/call-api.ts` | 08 |
| Request headers | `getRequestId`, header schemas in `lib/http/headers.ts` | 08 |
| Env | `lib/env/public.ts`, `lib/env/server.ts` (server-only) | 03 |
| Supabase | `lib/supabase/{client,server,admin,update-session}.ts` | 03 |
| Auth | `requireUser`, `getOptionalUser`, `requireRole` in `server/auth.ts` | 03 |

Never invent a second helper for any row. Need a new concept? Add it to its owner file and this table in the same PR.

## Core principles

1. **Correctness > cleverness.** Boring, explicit, readable code wins.
2. **Server by default.** Client code is an opt-in cost.
3. **Validate at every boundary** (forms, params, headers, cookies, bodies, responses, events, webhooks, DB JSON, env, storage, realtime, `postMessage`, third-party and AI output) with Zod. Matrix in `08`.
4. **One contract, one source.** Types, validators, request and response shapes derive from one Zod schema; never hand-write a duplicate.
5. **Fail closed.** Unknown input, role, event, or state is rejected, not defaulted.
6. **Security is not optional.** RLS on every table; secrets never leave the server.
7. **Types are the contract.** No `any`, no unchecked casts.
8. **Small, reviewable changes.** One concern per commit/PR. No dead code; TODO only with an issue link.
9. **Never guess.** Verify every API, column, env var, and package against the repo; report with evidence (`09`).

## Workflow for every task

1. **Understand**: Rule Zero, then the relevant files and rules. Check installed types; Next 16, React 19, Zod 4, Tailwind 4 differ from older training data (`09` trap list).
2. **Plan**: for >3 files or any new endpoint/action/table/event, list files, contracts, and tests first.
3. **Implement**: smallest change; follow existing patterns; follow the Feature Wiring Checklist (`08`).
4. **Verify**: run the Definition of Done commands and capture the output.
5. **Report**: use the report template in `09` (changed, verified with evidence, left, assumptions).

## Definition of Done (all must pass)

```bash
npm run check   # typecheck → lint → format:check → check:boundaries → check:unused → test → build
```

Plus when relevant: `npm run test:rls` (schema/policy change), `npm run db:types:check` (no diff), `npm run test:e2e` (critical flows).
Also required: impact analysis for every modified exported symbol; graphs refreshed if structure changed; no `console.*`; no `any`; no new warnings; every boundary validated (`08` checklist); contract tests for new/changed contracts; loading/error/empty states; keyboard + screen-reader usable; mobile checked; RLS policies + tests for any new table; `.env.example` updated for any new variable.

## Project structure (layered, domain-aligned)

```
src/
  proxy.ts              # Next 16 request interception (replaces middleware.ts)
  instrumentation.ts    # boot: server env validation, error tracking
  app/                  # routes only: page, layout, loading, error, global-error, not-found, route.ts, actions.ts
  components/ui/        # generic primitives
  components/<domain>/  # feature components
  hooks/                # client hooks
  lib/                  # client-safe + shared (no server-only imports)
    env/ supabase/ validations/ contracts/ api/ http/ utils/
    result.ts errors.ts logger.ts motion.ts
  server/               # server-only (starts with import "server-only")
    auth.ts action.ts route.ts db-error.ts
    queries/<domain>.ts   # reads (React.cache)
    services/<domain>.ts  # business logic, writes, invalidation
  types/                # database.types.ts (generated), shared types
e2e/                    # Playwright
scripts/                # check-boundaries.mjs
supabase/migrations/    # only way to change schema
supabase/tests/         # pgTAP RLS tests: <domain>.test.sql
docs/adr/  .rules/  .env.example  .nvmrc
```

- **Domain alignment**: one kebab-case domain name (`post`, `profile`) is used in every layer: `validations/<d>.ts`, `contracts/<d>.ts`, `server/queries|services/<d>.ts`, `components/<d>/`, `supabase/tests/<d>.test.sql`. Greppable, no per-feature reshuffle.
- **Layer direction**: `app → components → hooks → lib/api → lib/contracts → lib/validations → lib/utils → types`. `server/**` is imported only by `app/**` and `server/**`. `lib/validations` imports only `zod` and sibling validations. Client code never imports `server/`, `lib/env/server`, `lib/supabase/admin|server`. Enforced by `check:boundaries` (`08`).
- Route files stay thin: parse → call service → compose. Logic lives in `server/` or `lib/`.
- Tests are co-located `*.test.ts(x)`; promote helpers to `lib/` only when 2+ domains use them.
- `@/*` alias for `src/*`. No `../../../` imports.

## Absolute NEVER list

- NEVER edit a shared/exported symbol, schema, or contract without impact analysis.
- NEVER use `service_role`/secret key in client code or any `NEXT_PUBLIC_*` var.
- NEVER authorise from `getSession()`; use `getUser()` or verified `getClaims()`.
- NEVER create a table without RLS enabled, policies, and RLS tests.
- NEVER use `any`, `@ts-ignore`, `@ts-nocheck`, `as unknown as X`, or `!` to silence errors (`@ts-expect-error` only with reason + issue link).
- NEVER cast external data (`as T`, `JSON.parse() as T`, `await res.json() as T`); parse it with Zod.
- NEVER call `.parse()` on user or external input; use `safeParse` (boot-time env and tests excepted).
- NEVER read `process.env` outside `src/lib/env/` (root config files `next.config.ts`, `vitest.config.ts`, `playwright.config.ts` and `scripts/` excepted).
- NEVER export a Server Action or route handler that skips `runAction` / `handleRoute` / `handleWebhook`.
- NEVER call your own API with raw `fetch`; use `callApi`.
- NEVER trust client-sent identity/price/role/ownership fields; derive on the server.
- NEVER send a response that was not parsed through its contract's response schema.
- NEVER use `dangerouslySetInnerHTML` with unsanitised content.
- NEVER commit `.env*` (except `.env.example`), keys, tokens, secrets.
- NEVER disable lint rules file-wide; never `--no-verify`.
- NEVER weaken tsconfig flags, validators, or tests to make a check pass.
- NEVER add a dependency without justification (`07`).
- NEVER fetch data in `useEffect` when a Server Component or Server Action can.
- NEVER mutate data from a `GET` handler.
- NEVER invent APIs, package names, table/column names, env vars, or config keys (`09`).

## Stack housekeeping (fix once)

- Remove `@types/sharp` (deprecated stub). Exact versions (no `^`/`~`); one lockfile; one package manager (npm); set `engines.node` and `.nvmrc`.
- Add all scripts and "Required now" tooling from `07`.
- Move any `middleware.ts` or root-level `proxy.ts` to `src/proxy.ts`.
