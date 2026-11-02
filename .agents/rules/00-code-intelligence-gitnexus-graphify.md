# 00 — Code Intelligence: GitNexus + Graphify (MANDATORY FIRST STEP)

These two tools give agents a structural map of the codebase. **Use them before grep/glob/manual file crawling and before every non-trivial edit.** Blind edits are a rule violation.

| Tool | Purpose | Use it for |
|---|---|---|
| **GitNexus** (MCP server) | Code knowledge graph: dependencies, call chains, execution flows, clusters | Finding symbols, tracing callers/callees, **impact (blast-radius) analysis**, safe renames/refactors, pre-commit change analysis |
| **Graphify** (`/graphify` skill) | Project-wide knowledge graph (code + docs + configs) with `GRAPH_REPORT.md` | Orientation, architecture questions, "why/how is X connected to Y", finding god nodes and communities |

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
Then build the graph once: `/graphify .` (Codex: `$graphify .`).

## Mandatory agent workflow
1. **Session start**: read `graphify-out/GRAPH_REPORT.md` (if it exists) for god nodes and communities before searching files. Check GitNexus index freshness (`gitnexus://repo/{name}/context` resource); if stale, run `npx gitnexus analyze`.
2. **Explore**: use GitNexus `query` / `context` to locate code and see callers/callees; use `graphify query "<question>"` or `graphify explain "<Node>"` for architecture-level questions. Fall back to grep only when the graph has no answer.
3. **Before editing any function, class, component, schema, or exported type**: run GitNexus **impact analysis** on it. State the blast radius (direct callers, affected flows, risk level) in your plan. If risk is HIGH/CRITICAL or touches auth, RLS, payments, or shared `ui/` primitives, stop and confirm with the user before changing.
4. **Renames/moves**: use GitNexus `rename` (graph-aware, multi-file) rather than find-and-replace; review the preview diff.
5. **Before commit**: run GitNexus `detect_changes` / the `detect_impact` prompt on your diff; confirm only the expected symbols and flows are affected. Mention the result in the PR description.
6. **After structural changes** (new routes, modules, tables, moved files): refresh both graphs — `npx gitnexus analyze` and `/graphify . --update` — so the next session is not working from a stale map.
7. **Never trust the graph blindly**: it is an index, not the source of truth. Open the actual file before editing; if graph and code disagree, the code wins and the graph needs a refresh.

## Rules of engagement
- Prefer graph tools over reading many files — it saves context and finds callers a text search misses (dynamic imports, re-exports, Server Action references).
- Cite the symbols/files you found through the graph in your plan.
- Never skip impact analysis because a change "looks small". One-line changes to shared utilities (`cn`, `lib/env.ts`, `lib/supabase/*`, `ui/*`) have the widest blast radius.
- Graphs only cover what is indexed. DB policies and migrations (`supabase/migrations/*.sql`), env files, and runtime config are not call-graph-visible: check them manually (see `03`).
- Do not put secrets in files the tools will index and summarise: `.env*` stays git-ignored and excluded from indexing; Graphify's semantic pass for docs/images uses an LLM, so keep sensitive documents out of the indexed folder.

## Repo hygiene for the tooling
- Add generated/derived artefacts to `.gitignore` as appropriate: `graphify-out/cache/`, `graphify-out/graph.html`, and the GitNexus index directory (check `git status` after the first `analyze`). Team decision: commit `GRAPH_REPORT.md` only if the team wants a shared map; otherwise ignore the whole `graphify-out/`.
- `gitnexus analyze` can write a GitNexus section into `AGENTS.md`/`CLAUDE.md`. Keep that generated section, but run `npx gitnexus analyze --skip-agents-md` when you need to preserve hand-edited rules, so these rule files are never overwritten.
- Generated skill files under `.claude/skills/` or `.agents/skills/` are tool-managed; do not hand-edit them. Commit them only if the team wants shared skills.
- Husky sets `core.hooksPath`, which can bypass `graphify hook install` (post-commit rebuild). Verify with `graphify hook status`; if the hook is not firing, call the graph update from `.husky/post-commit` instead. Keep that hook fast and non-blocking (`|| true`) — it must never fail a commit.
- Re-run `graphify hook install` after upgrading graphify.

## When the tools are unavailable
If the MCP server/skill is not installed or errors out: say so explicitly, tell the user the setup commands above, and continue with careful manual exploration (read imports, search all usages including `app/` route files and Server Actions). Do not claim impact analysis was done when it was not.

## Definition of Done additions
- [ ] Impact analysis performed for every modified exported symbol (result noted in plan/PR)
- [ ] `detect_changes`/`detect_impact` matched the intended scope
- [ ] Graphs refreshed if structure changed
