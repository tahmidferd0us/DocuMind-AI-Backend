# DocuMind AI — Backend

Express modular monolith for the Smart NLP Platform (KOI). JavaScript (ESM), Prisma 7,
Supabase Postgres, custom JWT auth.

> Working on the code? Read [CLAUDE.md](CLAUDE.md) first — it holds the architecture rules,
> the Prisma 7 gotchas and the module recipe.

## Requirements

- Node.js >= 20
- A Supabase project (free tier is fine)

## Setup

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env`:

1. **Supabase → Project Settings → Database → Connection string**
   - `DATABASE_URL` — the **Transaction pooler** URI, port `6543`, keep `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` — the **Direct connection** URI, port `5432` (migrations use this)
2. **Supabase → Project Settings → API** — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   Only needed once file uploads go to Supabase Storage; auth does not use them.
   The service-role key bypasses row-level security — server-side only, never send it to the browser.
3. Generate two different JWT secrets (each must be at least 32 characters):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the tables:

```bash
npm run prisma:migrate
```

Run it:

```bash
npm run dev
```

API is at `http://localhost:5000/api/v1`.

## Verify

```bash
curl http://localhost:5000/api/v1/health/ready
```

`{"status":"ready","database":"up"}` means Postgres is reachable. If it says `degraded`, the app
is running but your `DATABASE_URL` is wrong — the server boots regardless, by design.

Register a user:

```bash
curl -X POST http://localhost:5000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"fullName\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"Passw0rdTest\"}"
```

Passwords need 8+ characters with a lowercase letter, an uppercase letter and a digit.

## Scripts

| Command | Does |
| :--- | :--- |
| `npm run dev` | nodemon, restarts on change |
| `npm start` | plain node |
| `npm run prisma:generate` | regenerate the client — **run after every schema edit** |
| `npm run prisma:migrate` | create + apply a dev migration |
| `npm run prisma:deploy` | apply migrations in production |
| `npm run db:push` | sync schema without a migration file (prototyping) |
| `npm run prisma:studio` | database browser |

## API

Base path `/api/v1`. All responses use `{ success, message, data }` or
`{ success, message, error: { code, message, details } }`.

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/health` | — | liveness |
| GET | `/health/ready` | — | readiness incl. database |
| POST | `/auth/register` | — | create account, returns access token + sets refresh cookie |
| POST | `/auth/login` | — | sign in |
| POST | `/auth/refresh` | cookie | rotate refresh token, new access token |
| POST | `/auth/logout` | cookie | revoke the session |
| GET | `/auth/me` | Bearer | current user |
| PATCH | `/auth/password` | Bearer | change password, revokes all sessions |

Auth endpoints are rate limited to 20 failed attempts per 15 minutes per IP; everything else to 600
requests per 15 minutes.

## Project structure

```
src/
├── server.js      boot + graceful shutdown
├── app.js         express assembly
├── config/        env validation, prisma client, supabase client
├── core/          errors, response helpers, middleware, logger
└── modules/       auth/, health/  (index.js is the module registry)
```

Adding a module means creating one folder and adding one line to `src/modules/index.js`.
See [CLAUDE.md](CLAUDE.md) §3.

## Notes

- `.npmrc` sets `allow-scripts=true`; npm 12 blocks lifecycle scripts by default and Prisma needs
  its postinstall to run.
- Prisma is pinned to **7.x**. `npm i prisma@latest` currently resolves to an `8.0.0-rc`
  prerelease — do not take it, and keep the CLI and `@prisma/client` on the same version.
- `src/generated/` is gitignored; run `npm run prisma:generate` after cloning.
