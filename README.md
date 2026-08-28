# MABDC SELG & SSLG Online Election

A React + Express + embedded SQLite election platform for M.A Brain Development Center.

## Included

- Separate `/selg` and `/sslg` learner voting portals
- Separate learner eligibility by division
- At most one candidate per position; a learner may abstain on any position
- One ballot per learner per election
- Final review before submission
- Anonymous vote rows in SQLite
- Participation receipt generated after submission
- Receipt automatically appears in the administrator dashboard
- Admin dashboard with:
  - eligible learner count
  - votes submitted
  - remaining voters
  - turnout percentage
  - live candidate results
  - learner receipt log
- Results auto-refresh every 5 seconds
- Classroom / chalkboard / notebook-paper visual theme
- Candidate and learner avatar placeholders using DiceBear
- SQLite database is created automatically at `server/data/election.db`

## Architecture

```text
React / Vite
    |
    | HTTP JSON API
    v
Express / Node.js
    |
    v
SQLite (better-sqlite3)
```

SQLite is embedded in the Node server process. No MySQL, PostgreSQL, MongoDB, or separate database service is required.

## Run locally

Install Node.js 20+.

```bash
npm install
```

Create `.env` from `.env.example`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then run:

```bash
npm run dev
```

Open:

- Main portal: `http://localhost:5173`
- SELG: `http://localhost:5173/selg`
- SSLG: `http://localhost:5173/sslg`
- Admin: `http://localhost:5173/admin`

The API runs at `http://localhost:4000`.

## Demo learner accounts

All demo learner PINs are:

```text
1234
```

SELG examples:

```text
MABDC-2026-L4-001
MABDC-2026-L5-001
MABDC-2026-L6-001
```

SSLG examples:

```text
MABDC-2026-L7-001
MABDC-2026-L8-001
MABDC-2026-L9-001
MABDC-2026-L10-001
MABDC-2026-L11-001
MABDC-2026-L12-001
```

## Demo administrator

Default values from `.env.example`:

```text
Username: admin
Password: MABDC@2026
```

Change these before production deployment.

## Production build

```bash
npm run build
npm start
```

After `npm run build`, the Express server will also serve the React `dist` folder.

## Important privacy design

The `voter_participation` table stores:

- learner identity
- election
- receipt code
- submission time

The `votes` table stores candidate selections under a separate random anonymous
ballot token. It has **no `voter_id` column** — the link does not exist in the
schema, so no query can reconstruct it.

The administrator dashboard intentionally does **not** show which candidates a specific learner selected. It only shows:

1. aggregated election results, and
2. participation receipts.

This helps avoid turning a receipt into proof of how somebody voted.

`server/validate.mjs` asserts this directly: it submits a known ballot and fails
if any chosen candidate's name appears in the admin API response.

## Abstention

A learner may leave any position blank. Skipped positions record **no vote** —
nothing is auto-filled on their behalf. A ballot with no selections at all is
rejected, and that rejection does not consume the learner's one-ballot allowance.

## Validating election integrity

```bash
node server/validate.mjs
```

Runs the real server against a throwaway database (the live one is stashed and
restored automatically) and asserts, among others:

- an abstained position records zero votes
- the first-listed candidate gains nothing from a skipped race
- a candidate cannot receive a vote in a race they are not standing in
- the admin API cannot retrieve any learner's selections
- duplicate ballots are rejected
- login endpoints are rate limited
- production refuses to boot with the default `JWT_SECRET`

`better-sqlite3` ships a platform-specific native binary, so run this on
Linux/macOS or inside the Docker image.

## Before real election deployment

Replace the demo learner seed list with the official learner registry and test the following:

- HTTPS
- strong `JWT_SECRET`
- new administrator password
- server backup
- restricted admin access
- audit logging
- voting opening/closing schedule
- election reset/archive process
- database backups
- candidate information and actual photos
- official voter eligibility rules
