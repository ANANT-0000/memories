# 01 — TypeScript & Code Quality

Owns: tsconfig, typing, naming, lint config. `Result`/`AppError` live in `04`; contracts in `08`; layer direction in `AGENTS.md`.

## tsconfig (required flags)

```json
{"compilerOptions": {"strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnreachableCode": false,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }}}
```
Keep the Next-generated defaults (`module`, `moduleResolution: "bundler"`, `jsx`, `incremental`, `plugins`). Never loosen a flag to make an error go away; fix the code. With `exactOptionalPropertyTypes`, build optional props conditionally (`...(x ? { key: x } : {})`), never assign `undefined`.

## Typing rules
- **No `any`.** Use `unknown` and narrow (Zod `safeParse`, type guards). Generic constraints over casts.
- **No assertions.** `as` is allowed only for `as const`. No `!`, no `as unknown as X`, no `@ts-ignore`/`@ts-nocheck`; `@ts-expect-error` only with a reason and issue link.
- **Boundary data enters as `unknown`.** Any parameter that receives external data (request, form, event, JSON, third-party or AI output) is typed `unknown` and parsed before use.
- **One source per shape**, never a hand-written duplicate:
  - validated data → `z.infer` / `z.input` / `z.output` of the schema (`z.input` for the wire/form side, `z.output` for parsed data when the schema coerces or transforms)
  - DB rows → generated `Database` types (`Tables<"posts">`)
  - API shapes → contracts (`08`)
- **DTO mappers** convert DB rows to response shapes: `toPostDto(row: Tables<"posts">): z.input<typeof postSchema>`. A column rename after `db:types` then fails `typecheck` instead of failing in production.
- **Discriminated unions** with a literal tag (`ok`, `type`, `status`), not boolean flags. Switches over unions end with `default: return assertNever(x)` (`lib/utils/assert.ts`, signature `(x: never): never`).
- **Branded ids** for ids that cross modules: `export const postIdSchema = z.uuid().brand<"PostId">(); type PostId = z.infer<typeof postIdSchema>;`. Brand only after validation.
- **Time and money**: wire format is ISO-8601 strings (`z.iso.datetime()`); `Date` objects exist only in server code after parsing. Money is integer minor units + currency code, never floats; prices are derived on the server.
- **JSON columns and `Json`**: parse with Zod on read; never narrow with `as`.
- Literal maps: `as const` + `satisfies`; exhaustive records `Record<Union, X>`. Avoid `enum`; use `as const` arrays/objects and string unions. The same `as const` array feeds `z.enum`, UI options, and DB check constraints.
- Prefer `type` for unions/props/derived types; `interface` only for declaration merging. Be consistent per file.
- Every function that can fail expectedly returns `Result<T>` (`04`) or throws `AppError`; never return `null`/`undefined` to mean "error".
- Exported functions have explicit return types. Internal ones may infer.
- `import type { … }` for type-only imports (required by `verbatimModuleSyntax`).
- Handle index access (`arr[0]` is `T | undefined`) explicitly.
- **Type tests**: critical helpers, contracts, and `Result` shapes get `expectTypeOf` assertions in Vitest, so type drift fails `npm test`, not production.

## Naming & files
| Thing | Convention | Example |
| --- | --- | --- |
| Files/folders | `kebab-case` | `user-card.tsx` |
| Components, types | `PascalCase` | `UserCard`, `UserProfile` |
| Functions, vars | `camelCase` | `getUserById` |
| Constants | `SCREAMING_SNAKE_CASE` (module-level, truly constant) | `MAX_UPLOAD_BYTES` |
| Booleans | `is/has/can/should` prefix | `isLoading` |
| Zod schemas | `camelCase` + `Schema` | `signUpSchema` |
| Schema types | `<Name>Input` / `<Name>Data` / `<Name>Dto` | `SignUpInput` |
| Contracts | verb + noun + `Contract` | `getPostContract` |
| Events | dotted `domain.verb` string, schema `<name>EventSchema` | `post.created` |
| Server Actions | verb-first + `Action` | `createPostAction` |
| Hooks | `use` prefix | `useDebouncedValue` |

- One component per file; filename matches the main export.
- **Named exports only**, except where Next requires default (`page`, `layout`, `loading`, `error`, `global-error`, `not-found`); `route.ts` exports named HTTP methods.
- No barrel files (`index.ts` re-exports): they hurt bundling and cause cycles.

## Function & module design

- Functions do one thing; target ≤ 40 lines, ≤ 3 params (options object beyond that).
- Early returns over nested `if`; max nesting depth 3.
- Pure functions in `lib/utils`; side effects isolated in `server/` or hooks.
- No magic numbers/strings: name them. Limits shared between schema and UI (`POST_TITLE_MAX`) are exported once from the schema file.
- No circular imports. Layer direction is defined in `AGENTS.md`; `lib` never imports `components` or `app`.
- Server-only modules start with `import "server-only";`. Client-reachable code never touches `process.env` (`03`).

## Comments & docs

- Code explains **what**; comments explain **why** (constraints, trade-offs, workarounds, links).
- Public/shared utilities get a one-line JSDoc. `TODO(#123): …` only with an issue number. No commented-out code.

## Error handling in code

- Never swallow errors: no empty `catch {}`. Log with context or rethrow.
- `catch (e)` → `e` is `unknown`; narrow with `instanceof`. In Next code, rethrow framework control-flow errors (`redirect`, `notFound`) with `unstable_rethrow` (`02`).
- Never throw strings. Throw `AppError` (`04`) with a safe message; keep internals (SQL, stack, table names) out of user-facing text.

## Async rules

- Always `await` or explicitly `void` a promise; no floating promises.
- Parallelise independent work with `Promise.all`; no sequential awaits in loops over network calls.
- Every outbound fetch to a third party has `AbortSignal.timeout(...)`.

## Imports order (enforced by review)

1. `node:` built-ins → 2. external packages → 3. `@/` aliases → 4. relative → 5. type-only imports last in each group. CSS imports last.

## oxlint expectations

Enable at minimum: `correctness` (error), `suspicious` (warn→error in CI), `typescript`, `react`, `react-hooks`, `nextjs`, `jsx-a11y`, `import`, `promise`, `unicorn` (selective). Keep on: `no-console`, `no-debugger`, `eqeqeq`, `no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment`, `consistent-type-imports`, `no-floating-promises` (type-aware if available), `exhaustive-deps`, `rules-of-hooks`, `no-array-index-key`. Use `no-restricted-imports` per folder (via `overrides`): client folders may not import `@/server/*`, `@/lib/env/server`, `@/lib/supabase/admin`; deep relative imports are banned. `check:boundaries` (`08`) is the backstop. Lint runs with `--deny-warnings` in CI.
