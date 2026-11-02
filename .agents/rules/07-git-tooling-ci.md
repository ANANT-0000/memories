# 07 — Git, Tooling, Dependencies, Testing & CI

## Commits (commitlint + conventional commits)
Format: `type(scope): imperative summary` — header ≤ 72 chars, lowercase type, no trailing period.
- Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope = area: `auth`, `db`, `ui`, `api`, `deps`, `config` (e.g. `fix(auth): reject expired callback codes`).
- Breaking change: `feat(api)!: …` plus a `BREAKING CHANGE:` footer explaining migration.
- Body explains **why**, wraps at 100 chars; reference issues (`Closes #123`).
- One logical change per commit; no "wip", "fix stuff", or mixed refactor+feature commits. Never use `--no-verify`.
- `commitlint.config.ts`: `export default { extends: ["@commitlint/config-conventional"] };`

## Branching & PRs
- Trunk-based: short-lived branches `type/short-description` (`feat/profile-avatar`) off `main`; `main` is always deployable and protected (PR + passing CI + review required, no force-push).
- PRs ≤ ~400 changed lines where possible. Description: what/why, screenshots for UI, migration notes, test evidence, risk/rollback.
- Squash-merge with a conventional-commit title.
- Schema migrations ship in the same PR as the code that needs them and must be backward-compatible with the previous deploy (expand → migrate → contract).

## Husky hooks
- `.husky/pre-commit` → `npx lint-staged`
- `.husky/commit-msg` → `npx --no -- commitlint --edit "$1"`
- `.husky/pre-push` → `npm run typecheck`
- Hooks are fast (staged files only except typecheck). They are a convenience; **CI is the authority** and re-runs everything.

## lint-staged
```json
{
  "*.{ts,tsx,js,jsx,mjs}": ["oxlint --fix --deny-warnings"],
  "*.{json,md,css,yml,yaml}": ["<formatter> --write"]
}
```
Pick **one** formatter (`oxfmt` or Prettier with `prettier-plugin-tailwindcss`) and add it; formatting is automated, never debated in review.

## package.json scripts (required)
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "oxlint --deny-warnings",
  "lint:fix": "oxlint --fix",
  "typecheck": "tsc --noEmit",
  "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.types.ts",
  "check": "npm run typecheck && npm run lint && npm run build",
  "prepare": "husky"
}
```

## Dependency policy
- **Exact versions** pinned (no `^`/`~`); single lockfile committed; set `engines` (Node LTS) and `.nvmrc`; install in CI with `npm ci` (or the lockfile-frozen equivalent of the chosen manager).
- Before adding a package, answer: Can native/platform do it? Is it maintained (recent releases, >1 maintainer)? Bundle cost (bundlephobia)? License OK? Types included? Security record? If unsure, don't add it.
- Add runtime deps to `dependencies`, tooling/types to `devDependencies`. `@types/*` only when the package has no bundled types (**not** `sharp`).
- Major upgrades: dedicated PR, read changelog/migration guide, run full checks. Never mix upgrades with feature work.
- Run `npm audit --omit=dev` and Dependabot/Renovate (grouped, weekly) to stay current.
- Do not install packages that duplicate an existing one (no second animation lib, second validator, second icon set, second class-merge util).

## Recommended additions (not yet installed; add as the project matures)
| Need | Package |
|---|---|
| Server-only guard | `server-only` |
| Unit/integration tests | `vitest` + `@testing-library/react` (+ `jsdom`) |
| E2E tests | `@playwright/test` |
| Error tracking | `@sentry/nextjs` |
| Formatting | `oxfmt` or `prettier` |
| Bundle inspection | `@next/bundle-analyzer` |
| Rate limiting | `@upstash/ratelimit` (or equivalent) |

## Testing policy
- Pyramid: many **unit** tests (pure utils, Zod schemas, services), some **integration** tests (Server Actions/route handlers against a local Supabase via `supabase start`), few **E2E** (login, core money/critical flows).
- Every bug fix ships with a regression test. Every Zod schema with non-trivial rules has tests for valid, invalid, and edge inputs.
- **RLS tests are mandatory** for each table (pgTAP or scripted per-role queries): allowed and denied cases.
- Tests are deterministic: no real network/time/randomness (mock clock, fixtures). No snapshot-testing of large DOM trees.
- Query by role/label (`getByRole`) — tests double as accessibility checks.
- Coverage targets: ≥ 80% on `lib/` and `server/`; coverage is a floor, not a goal.

## CI pipeline (GitHub Actions or equivalent) — all required for merge
1. Install (frozen lockfile) with dependency cache
2. `typecheck` → 3. `lint` (`--deny-warnings`) → 4. format check → 5. unit/integration tests → 6. `next build`
7. E2E against preview deployment (critical paths)
8. `npm audit --omit=dev` (fail on high+) and secret scanning (gitleaks/GitHub push protection)
9. Supabase: `supabase db lint` / migration dry-run on a shadow DB
- Preview deployment per PR; production deploy only from `main` after green CI; keep an instant rollback path.
- Concurrency group cancels superseded runs. Minimal `permissions:` on workflows; secrets via environment protection rules.

## Environments & config
- Separate Supabase projects for `dev`, `staging`, `prod`; never point local dev at prod data.
- `.env.example` kept in sync with `lib/env.ts` in the same PR as any new variable.
- Feature flags for risky releases; remove flags after rollout.

## Documentation
- `README.md`: setup, scripts, env vars, architecture overview, how to run Supabase locally, deploy steps.
- Record significant decisions as short ADRs in `docs/adr/NNNN-title.md` (context, decision, consequences).
- Update docs/rules in the same PR when behaviour or conventions change.
