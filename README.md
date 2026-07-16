# Time & PTO

A small web app for tracking hours worked and PTO for a team (~50 associates). Node/Express backend, SQLite database (a single file — no separate database server to manage), vanilla JS frontend. No build step.

## Features

- **Clock in/out** with a live status, plus manual entry for missed punches.
- **Timesheets** per associate, with date-range filtering.
- **PTO requests** — associate submits a date range and type (vacation/sick/personal/other), hours are calculated from business days. Managers/admins approve or deny; approved hours are deducted from the associate's balance automatically.
- **Admin panel** — team overview (who's clocked in, PTO balances), pending PTO approvals, user management (add, edit role/balance/active status, reset password), and bulk CSV import for onboarding a whole team at once.
- **CSV export** of timesheets and PTO for any date range, for payroll.
- **Individual logins** with hashed passwords and role-based access (`associate`, `manager`, `admin`).

## Running it locally

Requires Node.js 18+.

```bash
cd pto-timetrack-app
npm install
cp .env.example .env
```

Edit `.env`:
- Set `JWT_SECRET` to a long random string (the file has a command to generate one).
- Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` — this becomes the first admin login, created automatically the first time the server starts.

```bash
npm start
```

Open `http://localhost:3000`, log in with the admin credentials from `.env`, and change the admin password from the app (or add a new admin user and deactivate the seed one).

## Adding your 50 associates

Go to **Admin → Manage users**. Two options:

1. **One at a time** — the "Add a user" form.
2. **Bulk import** — paste CSV rows into the text box, one person per line, no header:
   ```
   name,email,password,role,pto_balance_hours
   Jane Doe,jane@company.com,TempPass123,associate,80
   John Smith,john@company.com,TempPass123,manager,120
   ```
   `role` defaults to `associate` and `pto_balance_hours` defaults to `0` if left blank. Everyone should change their password after first login (Account settings aren't in the UI yet — see "What's not included" below, or reset passwords from the admin panel).

## How PTO balances work

This is a simple, transparent model rather than an accrual engine:

- Each user has a `pto_balance_hours` number, set by an admin (e.g. seed everyone with their annual allotment in hours).
- When an associate requests time off, the app calculates hours as **(business days in the range) × 8** (configurable via `STANDARD_WORKDAY_HOURS` in `.env`).
- Hours are only deducted once a manager/admin **approves** the request. Denied or cancelled requests don't touch the balance.
- There's no automatic monthly/annual accrual — admins update balances directly (e.g. once a year, or via the "Manage users" table).

## Deploying so associates can reach it from anywhere

This is a standard Node app, so it deploys to any Node host. A few options:

- **Render / Railway / Fly.io** — connect the repo, set the same environment variables as `.env`, set the start command to `npm start`. These platforms give you a public HTTPS URL.
- Because the database is a single SQLite file (`data/app.db` by default), make sure your host has a **persistent disk/volume** mounted at that path — otherwise data resets on every redeploy. Render and Railway both support persistent volumes on their paid tiers; Fly.io volumes work on the free tier.
- For anything beyond ~50 users or if you want managed backups, swapping SQLite for Postgres is a moderate change (mainly `server/db.js` and query syntax) — ask if you want that version.

## Project structure

```
server/
  index.js          Express app entry point
  db.js             SQLite schema + first-admin seeding
  utils.js          Business-day math, CSV helper
  middleware/auth.js JWT auth + role checks
  routes/
    auth.js         login, current user, change password
    timesheets.js   clock in/out, manual entries, reports
    pto.js          requests, approvals, balances, reports
    admin.js        user management, bulk import
public/
  index.html, css/style.css, js/api.js, js/app.js   the whole frontend, no framework/build step
```

## What's not included (possible next steps)

- Self-service "forgot password" email flow (admin resets passwords instead).
- Automatic PTO accrual (e.g. X hours per pay period).
- Overtime rules, breaks, or geofenced clock-in.
- Multi-tenant support (this is built for one company/org).

If you want any of these added, just ask.
