# Matcha

A from-scratch implementation of the 42 "Matcha" dating-app subject, built as a
pnpm monorepo.

- **`apps/api`**: Flask (micro-framework only: router + manual SQL, no ORM/
  validator/auth-manager bundled in), raw `psycopg2` queries, JWT auth,
  OpenAPI 3 spec as the single source of truth for the API contract.
- **`apps/web`**: React + TypeScript, Vite, Tailwind v4, shadcn/ui, TanStack
  Query, TanStack Router (file-based routing), React Hook Form + Zod.
- **`packages/api-client`**: the OpenAPI-generated, fully-typed API client
  (`openapi-typescript` + `openapi-fetch`) and TanStack Query hooks — the
  frontend cannot drift from what the backend actually returns without a
  type error.
- **`packages/ui`**: shared shadcn/ui primitives.
- **UI**: deliberately minimal — a single-column, bottom-tab "mobile app"
  shell (max-width phone-sized column even on desktop), no card-swipe
  animations, no gradients/shadows, plain list rows. Function over flash.
- **DB**: PostgreSQL, no ORM — every query in `apps/api/app/**/service.py` is
  hand-written SQL.

## 1. Prerequisites

- Docker + Docker Compose (this is the only supported way to get Postgres
  running for the project).
- Node.js 22+ with [pnpm](https://pnpm.io) (via `corepack enable`) and
  Python 3.12+ if you want to run the API/web outside Docker during
  development.

## 2. Run everything

```sh
cp .env.example .env          # defaults are fine for local dev
docker compose up --build
```

or, equivalently:

```sh
make init
```

This starts three containers:

| Service    | URL                              |
|------------|-----------------------------------|
| Postgres   | localhost:5544                   |
| Flask API  | http://localhost:8000            |
| React web  | http://localhost:5173            |

The `api` container runs `migrate.py` automatically on boot (applies every
`*.sql` file in `apps/api/migrations/` that hasn't run yet — our own tiny
migration runner, no framework). It does **not** seed data automatically.

## 3. Seed 500+ profiles (required by the subject for evaluation)

Two ways to get there - use the first one for evaluation, the second if you
want a fresh random set while developing.

**Fast path (recommended for evaluation):** restore the pre-baked SQL
backup that ships with the repo. It's deterministic, doesn't need Faker to
run, and is what you want when you just need the app populated and working:

```sh
docker compose exec api python seed/restore_seed_backup.py --reset
# or: make seed-restore
```

**Live-generation path:** generate a fresh random batch instead (skips if
the DB already has >= 500 users):

```sh
docker compose exec api python seed/seed_fake_users.py
# or: make seed
```

Either way this gives you 500 profiles scattered across 8 English-speaking
cities (New York, London, Toronto, Sydney, Manchester, Dublin, Austin,
Chicago - so proximity matching has something to match), with Faker-shuffled
English names/bios, random tags/likes, and each profile gets 5 real portrait
photos drawn from a small gender-sorted pool of
[CelebA-HQ](https://github.com/switchablenorms/CelebAMask-HQ) images
(`apps/api/seed/photos/`, 300 male + 300 female, resized/committed to the
repo - only the images actually used, not the full dataset). Plus two
easy-to-use demo accounts:

- `demo_alice` / `Password123!`
- `demo_bob` / `Password123!`

(Every seeded account shares the same password so you can log into any of
them to see the app from different angles.)

## 4. Try it in the browser

1. Open http://localhost:5173.
2. **Register a real account** to test the full flow: register → open the
   verification email in your inbox → click the link → log in. Emails are
   sent through [Resend](https://resend.com), so `.env` needs
   `RESEND_API_KEY` and a `MAIL_FROM` on a domain verified in Resend (with
   the test sender `onboarding@resend.dev`, Resend only delivers to your own
   account's email address).
3. On **Profile**, fill in gender/orientation/bio, add 3+ tags, upload 1-2
   photos (first one becomes your profile picture automatically), and set a
   location (GPS button, or pick a city from the dropdown as the manual
   fallback the subject requires for users who decline GPS consent).
4. Go to **Discover** (bottom-left tab) — you should see seeded profiles
   filtered by your orientation, ranked by distance/shared tags/fame rating.
   Use the *Filters* toggle to sort/filter by age, fame, location or tags.
5. Open a profile and tap **Like**. Like one of the two demo accounts back
   from their side (or just like several seeded profiles — some already
   mutually like each other from the seed script) to trigger a match banner
   and unlock **Chat**.
6. **Chat** tab → open the thread → send messages. Messages/notifications
   both poll every 3-5s (well under the subject's 10s max-delay requirement),
   so you'll see them update live across two browser windows/incognito tabs
   logged in as two different accounts.
7. **Alerts** tab shows real-time-ish notifications for likes, matches,
   profile views, unlikes and new messages, with an unread badge on the tab.
8. From a profile page you can also **Block** or **Report** — try blocking a
   user from account A, then confirm account B no longer sees A in
   Discover/Search and can't message them.

### Testing two accounts at once

Easiest way: use two different browsers (or one normal + one private/
incognito window) pointed at http://localhost:5173, logged in as two
different seeded/demo users.

## 5. Where things live

```
apps/
  api/                  Flask backend
    app/                application code (blueprints per feature)
    migrations/          hand-written SQL, applied by migrate.py
    openapi/openapi.yaml  API contract (source of truth for TS types)
    seed/                 fake-data seeding script
  web/                  React frontend
    src/routes/           TanStack Router file-based routes
    src/features/         one folder per screen/domain
packages/
  api-client/           generated OpenAPI client + TanStack Query hooks
    src/schema.d.ts       generated from openapi.yaml -- do not hand-edit
  ui/                   shared shadcn/ui primitives
pnpm-workspace.yaml
docker-compose.yml
```

## 6. Regenerating types after an API change

Whenever you change `apps/api/openapi/openapi.yaml` (which should mirror any
route change in `apps/api/app/**/routes.py`), regenerate the frontend types:

```sh
cd apps/web
pnpm exec openapi-typescript ../../apps/api/openapi/openapi.yaml -o ../../packages/api-client/src/schema.d.ts
```

TypeScript will then fail to compile anywhere the frontend used a field/
endpoint that no longer matches the backend contract.

## 7. Known simplifications (by design, not oversights)

- **Chat/notifications use polling, not WebSockets.** Flask's dev/gunicorn
  setup here is plain WSGI; the subject only requires a ≤10s delay, so
  polling (3-5s intervals via TanStack Query) satisfies the requirement with
  far less moving infrastructure than a WebSocket/SSE layer.
- **Manual location fallback uses a fixed city dropdown**, not free-text
  geocoding — avoids depending on a third-party geocoding API just to turn
  "Paris" into coordinates.
- **Common-password blocklist is a small curated list**, not a 100k-word
  dictionary — swap `apps/api/app/common/common_passwords.py` for a larger
  list (e.g. SecLists) if you want stronger coverage before defense.
- **No ORM, no bundled validator, no auth-manager library** anywhere in the
  backend, on purpose — matches the subject's micro-framework definition
  (Chapter III), not just "using Flask."
