# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this project is

**ELS Requirements Builder** — an internal tool for a govtech team that helps
project managers produce Functional/Business Requirement Documents (FRD/BRD) for
Department of Natural Resources (DNR) **Electronic Licensing System (ELS)** SaaS
projects.

The workflow it supports:

1. **Intake** — upload PDFs/text files, or scrape government websites.
2. **Extract** — an AI model (Claude or Gemini, selectable) pulls structured
   requirements out of the raw text.
3. **Review** — requirements land in a reviewable table, grouped into categories
   (Species & Seasonality, Pricing & Residency, Eligibility & Age, Lottery
   Systems, General) with confidence scores and an approve/reject/edit workflow.
4. **Export** — approved requirements export to Google Sheets.

Legislation monitoring is intentionally out of scope for this version.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Drizzle ORM |
| Queue | BullMQ + Redis |
| AI | `@anthropic-ai/sdk` (Claude) and `@google/generative-ai` (Gemini) |
| Scraping | Playwright |
| PDF parsing | `pdf-parse` v1 |
| Export | `googleapis` (Google Sheets) |
| Auth | Shared-password cookie |

## Spin it up from a fresh clone

Prerequisites: Node 20+, Docker Desktop (or local Postgres 16 + Redis 7), an
Anthropic API key, and a Google AI (Gemini) API key.

```bash
docker compose up -d            # Postgres + Redis
npm install
npx playwright install          # browser binaries for scraping (~300MB)
cp .env.example .env.local      # then fill in the keys + APP_PASSWORD
npm run db:push                 # apply schema (drizzle-kit reads .env.local)
npm run dev:all                 # Next.js dev server + BullMQ worker
```

Open <http://localhost:3000> and log in with the `APP_PASSWORD` you set.

### Database & services — common blocker

The app's only hard runtime dependency is **PostgreSQL 16**. `docker compose up
-d` provides it (plus Redis) preconfigured to match `.env.example` — there is no
separate database to install. If the environment can't run Docker, set
`DATABASE_URL` in `.env.local` to any reachable Postgres 16 instance (local
Postgres.app/Homebrew, or hosted Neon/Supabase), then `npm run db:push`.

**Redis is optional.** It backs BullMQ, which is only used by the website-scraping
route. Document upload, AI extraction (runs inline, not queued), the review
table, and Google Sheets export all work without Redis. When Redis is absent,
run `npm run dev` (web only) instead of `npm run dev:all` — the worker process
needs Redis and will error without it.

Verify Postgres connectivity before launching:

```bash
node --env-file=.env.local -e "require('postgres')(process.env.DATABASE_URL)\`select 1\`.then(()=>{console.log('db ok');process.exit(0)}).catch(e=>{console.error('db FAIL:',e.message||e.code||e);process.exit(1)})"
```

### Scraper / Chromium "permission" errors

Playwright's Chromium uses a setuid sandbox that fails to start in many
container, CI, and AI-agent environments (notably when the process runs as
root), surfacing as a permission error on launch. The worker auto-detects this
(root or `CI` set) and launches with `--no-sandbox --disable-setuid-sandbox
--disable-dev-shm-usage`. To force the behavior either way, set
`CHROMIUM_NO_SANDBOX=1` (always off) or `=0` (always on) in `.env.local`. Also
make sure the browser binaries are installed: `npx playwright install chromium`.

**"Executable doesn't exist … run npx playwright install" even though you just
did.** This is a *location* mismatch, not a missing install. Some environments
(notably AI-agent sandboxes like Codex) set `PLAYWRIGHT_BROWSERS_PATH` to a
project-local dir such as `./.playwright-browsers`, so the worker looks there —
but a plain `npx playwright install` downloads to the default cache
(`~/Library/Caches/ms-playwright`). Install into the path the worker uses:

```bash
# run from the project root
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" npx playwright install chromium
```

`npm install` also runs `playwright install chromium` via `postinstall`, which
lands the browser in whatever `PLAYWRIGHT_BROWSERS_PATH` is active at install
time — so keep that var consistent between install and run.

## Project layout

```
src/
  app/
    (app)/        authenticated routes (dashboard, customers, requirements)
    login/        public login page
    api/          route handlers (customers, documents, scrape, extract, export, auth)
  components/
    ui/           shadcn/ui primitives
    customers/ documents/ requirements/ layout/   feature components
  lib/
    db/           Drizzle client + schema (single source of truth, no migrations dir)
    ai/           provider abstraction (Claude | Gemini), prompts, extraction logic
    scraper/      Playwright scraper + HTML/table parsers
    documents/    PDF + text parsing
    export/       Google Sheets export
    jobs/         BullMQ queues + workers
    auth.ts       shared-password auth helpers
  types/          shared TypeScript types
```

## Conventions an agent should follow

- **Schema is code-first.** There is no migrations folder; the schema lives in
  `src/lib/db/schema.ts` and is applied with `drizzle-kit push`. After changing
  the schema, run `npm run db:push`.
- **The worker is required** for scraping and AI extraction. `npm run dev` alone
  starts only the web server; use `npm run dev:all` (or run `npm run worker`
  separately) so background jobs actually process.
- **AI is provider-abstracted.** Add new models behind the interface in
  `src/lib/ai/provider.ts` — both Claude (tool_use) and Gemini (function
  calling) return the same `ExtractedRequirement` shape. Shared prompts live in
  `src/lib/ai/prompts.ts`.
- **Secrets** belong only in `.env.local` (gitignored). Never commit real keys;
  `.env.example` is the committed template with empty values.
- **`pdf-parse` is pinned to v1** and imported as `pdf-parse/lib/pdf-parse`
  (v2 changed its exports and breaks). Don't upgrade without adjusting the import
  and the type shim in `src/types/pdf-parse.d.ts`.
- Uploaded files write to `./storage` (configurable via `STORAGE_PATH`); that
  directory's contents are gitignored.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev:all` | Web server + worker (normal dev) |
| `npm run dev` | Web server only |
| `npm run worker` | Background worker only |
| `npm run build` / `npm run start` | Production build / run |
| `npm run db:push` | Sync schema to the database |
| `npm run db:studio` | Browse the DB in Drizzle Studio |
| `npm run lint` | Lint |
