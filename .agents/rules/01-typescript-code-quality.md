# 01 — TypeScript & Code Quality

## tsconfig (required flags)
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```
Never loosen these flags to make an error go away; fix the code.

## Typing rules
- **No `any`.** Use `unknown` and narrow (Zod `safeParse`, type guards). Generic constraints over casts.
- Derive types from a single source: `z.infer<typeof schema>` for validated data, generated `Database` types for DB rows. Do not hand-write duplicates.
- Prefer `type` for unions/props/derived types; `interface` only when declaration merging or `extends` of object shapes is genuinely useful. Be consistent per file.
- Use `as const` + `satisfies` for config objects and literal maps. Avoid `enum`; use `as const` objects / string unions.
- Model state with discriminated unions, not boolean flags:
  ```ts
  type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
  ```
- Every function that can fail expectedly returns a `Result` or throws a typed `AppError`; never return `null` meaning "error".
- Exported functions have explicit return types. Internal ones may infer.
- Use `import type { … }` for type-only imports (required by `verbatimModuleSyntax`).
- Handle index access results (`arr[0]` is `T | undefined`) explicitly.

## Naming & files
| Thing | Convention | Example |
|---|---|---|
| Files/folders | `kebab-case` | `user-card.tsx` |
| Components, types | `PascalCase` | `UserCard`, `UserProfile` |
| Functions, vars | `camelCase` | `getUserById` |
| Constants | `SCREAMING_SNAKE_CASE` (module-level, truly constant) | `MAX_UPLOAD_BYTES` |
| Booleans | `is/has/can/should` prefix | `isLoading` |
| Zod schemas | `camelCase` + `Schema` | `signUpSchema` |
| Server Actions | verb-first | `createPostAction` |
| Hooks | `use` prefix | `useDebouncedValue` |
- One component per file; filename matches the main export.
- **Named exports only**, except where Next requires default (`page`, `layout`, `loading`, `error`, `not-found`, `route` handlers use named methods).
- No barrel files (`index.ts` re-exports) except inside `components/ui` if tree-shaking is verified. Barrels hurt bundling and cause cycles.

## Function & module design
- Functions do one thing; target ≤ 40 lines, ≤ 3 params (use an options object beyond that).
- Early returns over nested `if`. Max nesting depth 3.
- Pure functions in `lib/utils`; side effects isolated in `server/` or hooks.
- No magic numbers/strings — name them as constants.
- No circular imports. Dependency direction: `app → components → lib/server → types`. `lib` never imports from `components` or `app`.
- Server-only modules start with `import "server-only";` (install `server-only` if not present). Client-only helpers must not touch `process.env` secrets.

## Comments & docs
- Code explains **what**; comments explain **why** (constraints, trade-offs, workarounds, links).
- Public/shared utilities get a one-line JSDoc.
- `TODO(#123): …` only with an issue number. No commented-out code.

## Error handling in code
- Never swallow errors: no empty `catch {}`. Log with context or rethrow.
- `catch (e)` → treat `e` as `unknown`; narrow with `e instanceof Error`.
- Never throw strings. Throw `Error` subclasses (`AppError` with `code`, `status`, safe `message`).
- Don't leak internals (SQL, stack, table names) in user-facing messages.

## Async rules
- Always `await` or explicitly `void` a promise; no floating promises.
- Parallelise independent work with `Promise.all`; avoid sequential awaits in loops over network calls.
- Use `AbortSignal`/timeouts for outbound fetches to third parties.

## Imports order (enforced by review)
1. `node:` built-ins → 2. external packages → 3. `@/` aliases → 4. relative → 5. type-only imports last in each group. CSS imports last.

## oxlint expectations
Enable at minimum: `correctness` (error), `suspicious` (warn→error in CI), `typescript`, `react`, `react-hooks`, `nextjs`, `jsx-a11y`, `import`, `promise`, `unicorn` (selective). Notable rules to keep on: `no-console`, `no-debugger`, `eqeqeq`, `no-explicit-any`, `consistent-type-imports`, `no-floating-promises` (type-aware if available), `exhaustive-deps`, `rules-of-hooks`, `no-array-index-key`. Lint runs with `--deny-warnings` in CI.
