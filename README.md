# MABDC SELG & SSLG Online Election

A React + Express + embedded SQLite election platform for M.A Brain Development Center.

## Included

- Separate `/selg` and `/sslg` learner voting portals
- Separate learner eligibility by division
- One candidate required for every position
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

The `votes` table stores candidate selections under a separate random anonymous ballot token.

The administrator dashboard intentionally does **not** show which candidates a specific learner selected. It only shows:

1. aggregated election results, and
2. participation receipts.

This helps avoid turning a receipt into proof of how somebody voted.

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
