# DocuMind AI — Backend Guidelines

Express modular monolith. JavaScript (ESM), Prisma 7, Supabase Postgres.
Read this before writing code. It encodes decisions already made — do not re-litigate them.

---

## 1. Stack (pinned, verified working)

| Concern | Choice | Notes |
| :--- | :--- | :--- |
| Runtime | Node >= 20 (built on 24) | `"type": "module"` — ESM only, no `require` |
| HTTP | Express 5 | async errors auto-forward to the error handler |
| ORM | Prisma 7 + `@prisma/adapter-pg` | v7 differs sharply from v6 — see §6 |
| Database | Supabase Postgres | Supabase is the **database host only** |
| Auth | Custom JWT + bcrypt | Supabase Auth (GoTrue) is deliberately **not** used |
| Validation | Zod 4 | use `z.email()` / `z.url()`, not `z.string().email()` |
| Passwords | `bcryptjs` | pure JS — no native build step on Windows |

---

## 2. Directory layout

```
src/
├── server.js              boot, graceful shutdown — nothing else
├── app.js                 express assembly, middleware order, API_PREFIX
├── config/
│   ├── env.js             zod-validated process.env; exits on invalid config
│   ├── database.js        PrismaClient singleton + pg adapter
│   └── supabase.js        lazy service-role client (Storage only, not auth)
├── core/                  cross-cutting, module-agnostic
│   ├── errors/AppError.js
│   ├── http/              apiResponse.js, asyncHandler.js
│   ├── middleware/        authGuard, errorHandler, notFound, rateLimiters, validate
│   └── utils/logger.js
└── modules/
    ├── index.js           MODULE REGISTRY — mounts every module
    ├── auth/
    └── health/
```

**`core/` must never import from `modules/`.** Modules import from `core/`, never the reverse.
The one deliberate exception is `core/middleware/authGuard.js`, which imports the token verifier
from the auth module. If a second module ever needs it, move `auth.tokens.js` into `core/`.

---

## 3. Adding a module — the only correct way

A module is a folder under `src/modules/<name>/` with these files:

| File | Responsibility | May import |
| :--- | :--- | :--- |
| `<name>.routes.js` | path → middleware → controller. No logic. | controller, validation, core middleware |
| `<name>.controller.js` | read `req`, call service, shape HTTP response. **No business logic, no Prisma.** | service, `apiResponse`, `asyncHandler` |
| `<name>.service.js` | all business rules. Throws `AppError`. **Never touches `req`/`res`.** | repository, other services, `AppError` |
| `<name>.repository.js` | the only file allowed to call `prisma.*` | `config/database.js` |
| `<name>.validation.js` | Zod schemas keyed `{ body, query, params }` | zod |
| `<name>.mapper.js` | DB row → API shape (strip `passwordHash` etc.) | — |
| `index.js` | `export default { name, basePath, router }` | routes |

Then register it in `src/modules/index.js` — **two lines, nothing else**:

```js
import documentsModule from './documents/index.js';
export const modules = [healthModule, authModule, documentsModule];
```

That registry is the whole seam. If extracting a module to its own service later means touching
more than its own folder plus those two lines, the layering has been broken.

---

## 4. Conventions that are already load-bearing

**Response envelope.** Every response goes through `core/http/apiResponse.js`. Never call
`res.json()` directly — the frontend's `axiosBaseQuery` parses this exact shape.

```jsonc
// success
{ "success": true, "message": "...", "data": {...}, "meta": {...} }   // meta only when paginated
// failure
{ "success": false, "message": "...", "error": { "code": "...", "message": "...", "details": [...] } }
```

`details` is `[{ field, message }]` and the login page maps it straight onto form fields.
Changing that shape breaks the frontend silently.

**Errors.** Throw `AppError.badRequest(...)` / `.unauthorized(...)` / `.conflict(...)` etc. from
services. Never `res.status(400).json(...)` in a controller. Express 5 forwards async throws
automatically, so `asyncHandler` is belt-and-braces — keep using it, it costs nothing.

**Status codes in use:** 200, 201, 401 (bad/expired credentials), 403 (deactivated / wrong role),
404, 409 (duplicate), 422 (validation), 429 (rate limited), 503 (readiness, DB down).

**Validation.** Every route with input gets `validate(schema)`. Validated `body` replaces `req.body`;
validated `query`/`params` land on `req.validated.query` / `req.validated.params` because Express 5
makes `req.query` a getter that cannot be reassigned.

**Style.** No comments unless the *why* is genuinely non-obvious. Prefer one line where one line
reads clearly. Named exports for everything except a module's `index.js`.

---

## 5. Auth module — how it actually works

Deliberately **not** Supabase Auth. We own the users table, so RBAC and the document-ownership
rules land in one place later.

- **Access token** — JWT, 15 min, `{ sub, email, role }`, returned in the JSON body.
  Frontend stores it in `localStorage` and sends `Authorization: Bearer`.
- **Refresh token** — opaque 48 random bytes, 7 days, sent as an **httpOnly cookie**
  (`documind_refresh_token`, `path=/api/v1/auth`). Only its HMAC-SHA256 hash is stored, in `sessions`.
- **Rotation** — every `/refresh` revokes the presented session row and issues a new one.
  A replayed old token is rejected. This is verified behaviour; keep it.
- **Password change** revokes every session for that user.

Endpoints under `/api/v1/auth`: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`,
`GET /me` (guarded), `PATCH /password` (guarded).

Guarding a route:

```js
router.get('/', requireAuth, controller.list);
router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.remove);
```

`req.user` is `{ id, email, role }`. The `Role` enum (`USER` / `ADMIN`) already exists in the
schema, so the plan's optional RBAC requirement needs no migration.

### Not built yet (deliberate)
Email verification, forgot/reset password, refresh-token reuse *detection* (currently a replayed
token is simply rejected; it does not nuke the whole session family), and a cleanup job for
`deleteExpiredSessions()` — the repository function exists but nothing calls it.

---

## 6. Prisma 7 — read this, it is not like the tutorials

Prisma 7 moved connection config **out of `schema.prisma`**. Most guidance online (and most model
priors) describe v5/v6 and will produce code that does not run here.

- **`prisma.config.js` owns the CLI's URL.** `datasource db` in the schema has `provider` only —
  adding `url`/`directUrl` there is a hard validation error (P1012).
- **There is no `directUrl` any more.** The v7 config type is literally
  `{ url?: string; shadowDatabaseUrl?: string }` (see `@prisma/config/dist/index.d.ts`). Passing
  `directUrl` is **silently ignored** — no warning, no error. This bit us: the CLI fell back to the
  pooled URL and migrations died with `prepared statement "s1" already exists`. So
  `prisma.config.js` sets `datasource.url = env('DIRECT_URL')` on purpose.
- **A driver adapter is required.** `new PrismaClient()` alone will not connect;
  `config/database.js` passes `new PrismaPg({ connectionString })`.
- **Generator is `prisma-client-js`,** output to `src/generated/prisma` (gitignored).
  The newer `prisma-client` generator emits **TypeScript only** — setting
  `generatedFileExtension = "js"` renames the files but leaves TS inside them, which crashes Node
  at import. This was tried; do not retry it.
- **`prisma db push` has no `--skip-generate` flag** in v7.
- Run `npm run prisma:generate` after every schema edit.
- Do **not** upgrade to the `8.0.0-rc` that `npm i prisma@latest` currently resolves to — the CLI
  and client must stay on matching **7.x** stable.

**Two URLs, two consumers — this is the part that goes wrong.**

| Var | Port | Read by | Why |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | 6543 transaction pooler | `config/database.js` → `PrismaPg` adapter, at runtime | app queries use unnamed prepared statements, which pgbouncer transaction mode handles |
| `DIRECT_URL` | 5432 session pooler | `prisma.config.js` → the CLI, for migrate/push/studio | the schema engine uses **named** prepared statements and session-level locks, which transaction mode cannot do |

The running app never reads `prisma.config.js`, and the CLI never reads `config/database.js`. If a
migration fails with `prepared statement "s1" already exists`, the CLI is going through 6543 —
check `prisma.config.js`, not `.env`.

Both URLs use the **session/transaction pooler host**, not `db.<ref>.supabase.co`. The true direct
connection is IPv6-only unless the project buys the IPv4 add-on; the session pooler is IPv4-proxied
for free and is the right substitute.

**Percent-encode the password.** It goes in a URL, so `#` → `%23`, `^` → `%5E`, `@` → `%40`, etc.
An unencoded `#` truncates the URL and surfaces as the very unhelpful
`P1013: invalid port number in database URL`. Encode it programmatically rather than by hand:
`node -e "console.log(encodeURIComponent('<password>'))"`.

**pgvector caveat for the RAG work.** Prisma has no native `vector` type. When embeddings land,
enable the extension in Supabase and either map the column as `Unsupported("vector(1536)")` (Prisma
can create it but not query it) and do similarity search through `prisma.$queryRaw`, or keep the
vector store outside Prisma entirely. Decide before writing the documents module.

---

## 7. Commands

```bash
npm run dev              # nodemon
npm run prisma:generate  # after every schema change
npm run prisma:migrate   # dev migration (needs a reachable DIRECT_URL)
npm run db:push          # prototype sync, no migration file
npm run prisma:studio
```

Health: `GET /api/v1/health` (liveness, always 200 if the process is up) and
`GET /api/v1/health/ready` (503 when Postgres is unreachable).

The server **boots even when the database is down** — it logs a warning and serves. That is
intentional so the frontend can be developed against a dead DB; don't "fix" it.

---

## 8. Environment

Copy `.env.example` → `.env`. `config/env.js` validates on boot and exits with a field-by-field
report if anything is missing. JWT secrets must be **>= 32 chars**:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`CORS_ORIGINS` is comma-separated and must include the frontend origin. `credentials: true` is on,
so the origin list can never be `*`.

`.npmrc` sets `allow-scripts=true` — npm 12 blocks lifecycle scripts by default and Prisma's
postinstall needs to run.

---

## 9. Roadmap fit

Week 1 of the sprint plan needs: `documents` (upload → Supabase Storage → parse), `summaries`,
`qa`, `exports`. Each is a module folder plus one registry line.

**The NLP work cannot run in this process.** spaCy, KeyBERT, sumy/LexRank and the ROUGE/BLEU
evaluation are Python-only with no real Node equivalent. Plan for a small Python FastAPI sidecar
that Express calls over HTTP, and keep every NLP call behind a single `services/nlpClient.js` so
the boundary stays swappable. Do not scatter `fetch` calls to it across modules.
