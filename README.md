# ELS Requirements Builder

Internal tool that helps project managers produce Functional/Business
Requirement Documents (FRD/BRD) for Department of Natural Resources (DNR)
**Electronic Licensing System (ELS)** SaaS projects.

Upload PDFs/text or scrape government sites → an AI model (Claude or Gemini)
extracts structured requirements → review them in a categorized table with
confidence scores and an approve/reject/edit workflow → export to Google Sheets.

> Working with an AI agent? See [`AGENTS.md`](./AGENTS.md) for architecture and
> conventions.

## Prerequisites

- **Node.js 20.x** and npm 10+
- **Docker Desktop** (or your own Postgres 16 + Redis 7 install)
- An **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com/))
- A **Google AI (Gemini) API key** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

## Setup

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install dependencies
npm install

# 3. Download Playwright browser binaries (~300MB, required for scraping)
npx playwright install

# 4. Create your env file and fill in API keys + a password
cp .env.example .env.local
#    then edit .env.local — set ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, APP_PASSWORD

# 5. Create the database schema
npm run db:push

# 6. Run the app (Next.js dev server + background worker)
npm run dev:all
```

Open <http://localhost:3000> and log in with the `APP_PASSWORD` you set.

## Database & services (read this if setup is blocked)

The app needs **PostgreSQL**; **Redis** is only used by the website-scraping
feature. You do **not** need to install either by hand — `docker compose up -d`
starts both, preconfigured to match the default `.env.example` values. That
compose stack *is* the local database service.

**No Docker available?** Point `DATABASE_URL` in `.env.local` at any PostgreSQL
16 instance instead — a local install ([Postgres.app](https://postgresapp.com/),
Homebrew `postgresql@16`) or a free hosted one (e.g. [Neon](https://neon.tech),
[Supabase](https://supabase.com)). Then run `npm run db:push` to create the
schema. Everything except scraping (upload, AI extraction, review, export) works
**without Redis** — in that case run `npm run dev` (web only) rather than
`npm run dev:all`, since the worker requires Redis.

Quick check that Postgres is reachable before running the app:

```bash
node --env-file=.env.local -e "require('postgres')(process.env.DATABASE_URL)\`select 1\`.then(()=>{console.log('db ok');process.exit(0)}).catch(e=>{console.error('db FAIL:',e.message||e.code||e);process.exit(1)})"
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev:all` | Next.js dev server + BullMQ worker (use this for normal dev) |
| `npm run dev` | Next.js dev server only |
| `npm run worker` | Background worker only (scraping, extraction jobs) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run db:push` | Sync schema to the database |
| `npm run db:studio` | Open Drizzle Studio to browse the DB |
| `npm run lint` | Lint |

## Notes

- The worker is required for scraping and AI extraction — `npm run dev` alone won't process jobs.
- There is no migrations folder; schema lives in `src/lib/db/schema.ts` and is applied via `drizzle-kit push`.
- Uploaded files are written to `./storage` by default (configurable via `STORAGE_PATH`).
- To stop the database/redis containers: `docker compose down`. To wipe data too: `docker compose down -v`.
