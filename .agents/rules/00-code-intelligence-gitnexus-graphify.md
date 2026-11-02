# 00 — Code Intelligence: GitNexus + Graphify (MANDATORY FIRST STEP)

These two tools give agents a structural map of the codebase. **Use them before grep/glob/manual file crawling and before every non-trivial edit.** Blind edits are a rule violation. This file owns graph tooling, impact analysis, and risk levels.

| Tool | Purpose | Use it for |
| --- | --- | --- |
| **GitNexus** (MCP server) | Code knowledge graph: dependencies, call chains, execution flows, clusters | Finding symbols, tracing callers/callees, **impact (blast-radius) analysis**, safe renames/refactors, pre-commit change analysis |
| **Graphify** (`/graphify` skill) | Project-wide knowledge graph (code + docs + configs) with `GRAPH_REPORT.md` | Orientation, architecture questions, "why/how is X connected to Y", god nodes and communities |

## One-time setup (per machine / per clone)

```bash
# GitNexus — index repo + register MCP for your editor
npx gitnexus analyze            # run from repo root
npx gitnexus setup              # one-time editor MCP config
# Claude Code alternative:  claude mcp add gitnexus -- npx -y gitnexus@latest mcp

# Graphify — CLI (PyPI package is named "graphifyy"), then register the skill
uv tool install graphifyy       # or: pipx install graphifyy
graphify install                # registers /graphify with your assistant
graphify claude install         # Claude Code: always-on graph hook (codex/opencode equivalents exist)
```

Then build the graph once: `/graphify .` (Codex: `$graphify .`). These commands are for the developer machine only; never add them to app dependencies.

## Mandatory agent workflow

1. **Session start**: read `graphify-out/GRAPH_REPORT.md` (if it exists) for god nodes and communities before searching files. Check GitNexus index freshness (`gitnexus://repo/{name}/context` resource); if stale, run `npx gitnexus analyze`.
2. **Explore**: GitNexus `query` / `context` to locate code and see callers/callees; `graphify query "<question>"` or `graphify explain "<Node>"` for architecture-level questions. Grep only when the graph has no answer.
3. **Before editing any function, class, component, schema, contract, or exported type**: run GitNexus **impact analysis**. State the blast radius (direct callers, affected flows, risk level) in your plan. HIGH/CRITICAL: stop and confirm with the user before changing.
4. **Renames/moves**: GitNexus `rename` (graph-aware, multi-file), not find-and-replace; review the preview diff.
5. **Before commit**: GitNexus `detect_changes` / `detect_impact` on your diff; confirm only the expected symbols and flows changed. Put the result in the PR description.
6. **After structural changes** (new routes, modules, tables, contracts, moved files): `npx gitnexus analyze` and `/graphify . --update`.
7. **Never trust the graph blindly**: it is an index, not the source of truth. Open the actual file before editing; if graph and code disagree, the code wins and the graph needs a refresh.

## Risk levels (use these exact labels in the plan)

| Level | Examples |
| --- | --- |
| LOW | Symbol used inside one module, ≤ 3 callers, no schema/contract/DB/auth involvement |
| MEDIUM | Callers across modules; a `ui/*` primitive used in < 10 places |
| HIGH | Any contract (`lib/contracts/*`), Zod schema in `lib/validations/*`, generated DB types, `lib/env/*`, `lib/supabase/*`, `runAction` / `handleRoute` / `callApi`, widely used `ui/*` primitives |
| CRITICAL | Auth, RLS policies, payments, migrations, `proxy.ts` |

A contract or schema change is **never below HIGH** because it spans client, server, tests, and docs. For HIGH/CRITICAL, list every affected caller, route, action, form, and test in the plan and update all of them in the same PR.

## Impact note format (plan and PR)

```
Symbol: <name> (<path>)   Risk: <LOW|MEDIUM|HIGH|CRITICAL>
Direct callers: <n> (<paths>)   Affected flows: <list>
Not graph-visible, checked manually: <migrations / env / policies / generated types>
```

## Rules of engagement

- Prefer graph tools over reading many files: it saves context and finds callers a text search misses (dynamic imports, re-exports, Server Action references).
- Cite the symbols/files you found through the graph in your plan.
- Never skip impact analysis because a change "looks small". One-line changes to shared utilities (`cn`, `lib/env/*`, `lib/supabase/*`, `lib/validations/primitives.ts`, `ui/*`) have the widest blast radius.
- Graphs cover only what is indexed. DB policies and migrations (`supabase/migrations/*.sql`), env files, generated types, and runtime config are not call-graph-visible: check them manually (see `03`, `08`).
- Do not put secrets in files the tools index: `.env*` stays git-ignored and excluded. Graphify's semantic pass for docs/images uses an LLM, so keep sensitive documents out of the indexed folder.

## Repo hygiene for the tooling

- Git-ignore generated artefacts as appropriate: `graphify-out/cache/`, `graphify-out/graph.html`, and the GitNexus index directory (check `git status` after the first `analyze`). Commit `GRAPH_REPORT.md` only if the team wants a shared map; otherwise ignore all of `graphify-out/`.
- `gitnexus analyze` can write a section into `AGENTS.md`/`CLAUDE.md`. Run `npx gitnexus analyze --skip-agents-md` to preserve these hand-edited rules; a generated section may never override Precedence or the NEVER list.
- Generated skill files under `.claude/skills/` or `.agents/skills/` are tool-managed; do not hand-edit them.
- Husky sets `core.hooksPath`, which can bypass `graphify hook install` (post-commit rebuild). Verify with `graphify hook status`; if not firing, call the update from `.husky/post-commit`, fast and non-blocking (`|| true`); it must never fail a commit. Re-run `graphify hook install` after upgrading graphify.

## When the tools are unavailable

If the MCP server/skill is missing or errors: say so explicitly, give the user the setup commands above, and continue with manual exploration (read imports, search all usages including `app/` route files, Server Actions, contracts, and tests). Mark the plan "impact analysis: manual, not graph-verified". Never claim impact analysis was done when it was not.

## Exemptions

Docs-only and comment-only edits skip impact analysis. Anything else, including config and migrations, does not.

## Definition of Done additions

- [ ] Impact analysis for every modified exported symbol (result in plan/PR)
- [ ] `detect_changes`/`detect_impact` matched the intended scope
- [ ] Graphs refreshed if structure changed
