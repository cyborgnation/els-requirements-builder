# DocScrape

Internal tool for scraping documents, extracting requirements with AI, and managing customer records.

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
