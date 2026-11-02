# 04 — Validation, Server Actions, Route Handlers & Errors (Zod 4)

## Zod 4 rules
- Import `import { z } from "zod";`. Use Zod 4 APIs — not v3 patterns:
  - Top-level formats: `z.email()`, `z.url()`, `z.uuid()`, `z.iso.datetime()` (not `z.string().email()` etc.).
  - Custom messages via `{ error: "…" }` (or `error: (iss) => …`), not `message`/`required_error`.
  - Errors: `z.flattenError(err)` for forms, `z.treeifyError(err)` for nested; not `.format()`/`.flatten()`.
  - `z.strictObject()` for inputs where unknown keys must be rejected; `z.object()` strips by default.
  - `z.coerce.*` only for FormData/query strings where inputs are strings; coerce deliberately, with bounds.
- Always `safeParse` / `safeParseAsync` at boundaries; **never** `parse` on user input in a path that would 500 on bad data.
- Every string has bounds: `.trim().min(1).max(N)`; numbers have `.int()`, `.min()`, `.max()`; arrays have `.max()`. Unbounded input is a DoS vector.
- Types derive from schemas: `export type SignUpInput = z.infer<typeof signUpSchema>;`.
- Schemas live in `lib/validations/<domain>.ts`, are shared by client (UX hints) and server (authority). **Server validation is mandatory** even when client validated.
- Env, route params, search params, cookies, headers, webhook payloads, `jsonb` reads — all validated.
- Transform output explicitly (`.transform`) only for normalisation (trim/lowercase email). Keep schemas free of side effects.

## Standard result & error types
```ts
// lib/errors.ts
export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"
  | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,                // safe for end users
    public readonly status = 400,
    options?: { cause?: unknown },
  ) { super(message, options); }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };
```
- Expected failures (validation, auth, conflict) are **returned** as `ActionResult`; unexpected failures are thrown, logged, and shown by `error.tsx`.
- Never return raw `Error`, Supabase error objects, or stack traces to the client. Map Postgres codes (`23505` → `CONFLICT`, `42501` → `FORBIDDEN`, `PGRST116` → `NOT_FOUND`).

## Server Action template
```ts
"use server";
import { z } from "zod";
import { updateTag } from "next/cache";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/lib/validations/post";
import type { ActionResult } from "@/lib/errors";

export async function createPostAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();                              // 1. authenticate
  const parsed = createPostSchema.safeParse(Object.fromEntries(formData)); // 2. validate
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid input",
      fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const supabase = await createClient();                         // 3. act (RLS enforces too)
  const { data, error } = await supabase.from("posts")
    .insert({ ...parsed.data, user_id: user.id }).select("id").single();
  if (error) return { ok: false, code: "INTERNAL", message: "Could not create post" };
  updateTag("posts");                                            // 4. invalidate
  return { ok: true, data };
}
```
Order is fixed: **authenticate → validate → authorise (resource ownership/role) → act → invalidate → return**.
- Server Actions are public HTTP endpoints: treat every argument as hostile. Do not pass trusted IDs (`user_id`, `role`, `price`) from the client; derive from session/DB.
- Files with `"use server"` export **only** async functions (no constants/types except `import type`).
- Keep actions thin; business logic in `server/services/*` for testability.
- Pending UI via `useActionState` / `useFormStatus`; disable submit while pending to prevent double-submit; make mutations idempotent where retries are possible.

## Route Handlers (`route.ts`)
- Use for webhooks, public/third-party APIs, file streaming, OAuth callbacks.
- Same pipeline: authenticate (if protected) → validate (`params`, query, body via `await req.json()` in try/catch → Zod) → act → respond.
- Consistent JSON envelope: success `{ data }`, failure `{ error: { code, message, details? } }`. Correct status codes: 200/201/204, 400, 401, 403, 404, 409, 422, 429, 500.
- Check `Content-Type` and body size before parsing; reject oversized payloads (413).
- Set `Cache-Control` explicitly for GET handlers; mutate only with POST/PUT/PATCH/DELETE.
- Webhooks: read raw body (`await req.text()`), verify signature, then parse; respond fast (2xx) and offload heavy work.
- Add `export const runtime = "nodejs"` when using `sharp` or Node APIs.

## Logging & observability
- Use a single logger wrapper (`lib/logger.ts`) — no raw `console.*` (lint-enforced). Structured JSON: `{ level, msg, code, requestId, userId?, … }`. Never log secrets/PII.
- Log unexpected errors once, at the boundary that handles them, with `cause`.
- Add `error.tsx` and `global-error.tsx`; show a friendly message + retry (`reset`) and an error digest, never the raw error.
- Plan for an error tracker (e.g. Sentry) via `instrumentation.ts` before production launch.

## Forms (client UX)
- Use native `<form action={action}>`; show field errors under inputs with `aria-describedby` and `aria-invalid`; focus first invalid field; preserve user input on failure.
- Label every input; use correct `type`, `autocomplete`, `inputMode`.
- Never rely on client validation alone.
