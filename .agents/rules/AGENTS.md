# AGENTS.md — Project Rules (Entry Point)

Applies to every AI agent and every human contributor. Read this file first, then read the topic file(s) in `.rules/` for the area you are touching **before writing code**. If a rule conflicts with a user request, state the conflict and ask; never silently break a rule.

## RULE ZERO — Use GitNexus and Graphify first (mandatory)
Before exploring or changing code, use the code-intelligence tools. Full workflow: `.rules/00-code-intelligence-gitnexus-graphify.md`.
1. **Orient**: read `graphify-out/GRAPH_REPORT.md` and use `/graphify` / `graphify query "<question>"` for architecture questions.
2. **Explore**: use **GitNexus** MCP tools (`query`, `context`) to find symbols, callers and callees. Use grep only when the graph cannot answer.
3. **Before editing any exported symbol**: run GitNexus **impact analysis**; state the blast radius in your plan. HIGH/CRITICAL risk, or anything touching auth, RLS, payments, or shared `ui/` primitives → confirm with the user first.
4. **Rename/move**: GitNexus `rename`, never blind find-and-replace.
5. **Before commit**: run `detect_changes` / `detect_impact` on the diff and confirm the scope is what you intended.
6. **After structural changes**: refresh the graphs (`npx gitnexus analyze`, `/graphify . --update`).
7. If the tools are not installed, say so, give the setup commands from the `00` file, and never claim impact analysis was done when it was not.

## Stack (source of truth)
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 7 (strict) · Tailwind CSS 4 (CSS-first) · Supabase (`@supabase/ssr`, `supabase-js`) · Zod 4 · framer-motion · lucide-react · sharp · oxlint · husky + lint-staged + commitlint.

## Rule files
| File | Read when |
|---|---|
| `.rules/00-code-intelligence-gitnexus-graphify.md` | **Always, first** — before exploring or editing code |
| `.rules/01-typescript-code-quality.md` | Writing any TS code, naming, structure, imports |
| `.rules/02-nextjs-react.md` | Pages, layouts, components, caching, routing |
| `.rules/03-supabase-security.md` | Auth, DB, RLS, storage, env vars, secrets |
| `.rules/04-validation-api-errors.md` | Server Actions, route handlers, Zod, error handling |
| `.rules/05-ui-tailwind-motion-a11y.md` | Styling, animation, icons, accessibility |
| `.rules/06-performance-images-seo.md` | Images, sharp, bundle size, metadata, Web Vitals |
| `.rules/07-git-tooling-ci.md` | Commits, hooks, lint, CI, dependencies, testing |

## Core principles
1. **Correctness > cleverness.** Boring, explicit, readable code wins.
2. **Server by default.** Client code is an opt-in cost.
3. **Validate at every boundary.** All external input (forms, params, headers, webhooks, DB JSON, env) goes through Zod.
4. **Security is not optional.** RLS on every table, secrets never leave the server.
5. **Types are the contract.** No `any`, no unchecked casts.
6. **Small, reviewable changes.** One concern per commit/PR.
7. **No dead code, no TODO without an issue link.**

## Workflow for every task
1. **Understand** — run GitNexus/Graphify first (Rule Zero), then read the relevant files and rules. Do not guess APIs; check the installed version's docs/types (Next 16, React 19, Zod 4 and Tailwind 4 differ from older training data).
2. **Plan** — for changes touching >3 files, list the files and approach first.
3. **Implement** — smallest change that solves the problem; follow existing patterns.
4. **Verify** — run the Definition of Done commands below.
5. **Report** — summarise what changed, what was verified, what is left.

## Definition of Done (all must pass)
```bash
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint --deny-warnings
npm run build       # next build (must succeed with zero errors)
```
Plus: impact analysis done for every modified exported symbol, graphs refreshed if structure changed, no `console.log`, no unused exports/vars, no `any`, no new warnings, loading/error/empty states handled, keyboard + screen-reader usable, mobile layout checked, RLS policy written for any new table.

## Project structure
```
src/
  app/                 # routes only: page, layout, loading, error, not-found, route.ts, actions
  components/
    ui/                # generic primitives (Button, Input, Dialog)
    <feature>/         # feature-specific components
  lib/
    supabase/          # client.ts, server.ts, proxy.ts (session refresh helper), admin.ts (server-only)
    validations/       # Zod schemas (shared client+server)
    utils/             # pure helpers (cn.ts, format.ts)
    env.ts             # validated env (server + public)
  server/              # server-only logic: queries, services, actions helpers
  types/               # database.types.ts (generated), shared types
  hooks/               # client hooks
proxy.ts               # Next 16 request interception (replaces middleware.ts)
supabase/migrations/   # SQL migrations (only way to change schema)
```
- Route files stay thin: fetch → compose components. Logic lives in `server/` or `lib/`.
- Co-locate a component's private helpers; promote to `lib/` only when used by 2+ features.
- Use the `@/*` alias for `src/*`. No `../../../` imports.

## Absolute NEVER list
- NEVER edit a shared/exported symbol without running GitNexus impact analysis first.
- NEVER use `service_role` key or `SUPABASE_SERVICE_ROLE_KEY` in client code or any `NEXT_PUBLIC_*` var.
- NEVER trust `getSession()` on the server for authorization — use `getUser()` (or verified `getClaims()`).
- NEVER create a table without RLS enabled and policies.
- NEVER use `any`, `@ts-ignore`, `@ts-nocheck`, `as unknown as X`, or non-null `!` to silence errors (`@ts-expect-error` only with a reason + issue link).
- NEVER use `dangerouslySetInnerHTML` with unsanitised content.
- NEVER commit `.env*` (except `.env.example`), keys, tokens, or generated secrets.
- NEVER disable lint rules file-wide; no `--no-verify` on commits.
- NEVER add a dependency without justification (see `07`).
- NEVER fetch data in `useEffect` when a Server Component or Server Action can do it.
- NEVER mutate data from a `GET` route handler.

## Known stack housekeeping (fix once)
- Remove `@types/sharp` (deprecated stub; `sharp` ships its own types).
- Use **exact versions** (no `^`/`~`) for all dependencies for reproducible builds; update deliberately via dedicated PRs.
- Add `engines.node` and commit the lockfile; use one package manager only.
- Add `"typecheck": "tsc --noEmit"`, `"lint": "oxlint --deny-warnings"` scripts if missing.
