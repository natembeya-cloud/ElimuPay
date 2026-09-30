# ElimuPay

A simple, mobile-first school-fee management and payment-reconciliation
platform for small and medium-sized private schools in Kenya. ElimuPay
connects to a school's existing M-Pesa Till or Paybill and automatically
reconciles payments against individual students — it does not replace the
school's payment channel, become another M-Pesa provider, or hold school
funds.

**Three roles, three very different experiences:**

- **The ElimuPay platform administrator** (that's you, running the company)
  signs into a separate platform dashboard to onboard or remove schools,
  review access requests, and publish version notes.
- **School administrators** get a private dashboard, activated once their
  school completes onboarding. From it they upload student and parent
  records and verify payments received on their designated Paybill/Till.
- **Parents** need no account at all — they find their school, then find
  their child by name, grade, or admission number, and pay through the
  same M-Pesa channel they already use.

This repository contains a working backend API and a frontend that talks
to it — no mock data, no offline/demo mode. If the API can't be reached,
the UI says so rather than pretending.

```
elimupay/
├── backend/              Express API + JSON data store
│   ├── server.js         App entry point
│   ├── db.js             Data layer (swap for Postgres later — see docs/DATABASE.md)
│   ├── auth.js           JWT secret + requireAuth + requireSuperAdmin middleware
│   ├── seed-data.js       Starting dataset: two pilot schools + the platform admin
│   ├── seed.js            Script: npm run seed
│   ├── routes/
│   │   ├── auth.js        Login (school admin or platform admin), "request access" leads
│   │   ├── superadmin.js  Platform admin: manage schools, leads, versioning, maintenance
│   │   ├── public.js      Public school search + current version info
│   │   ├── students.js    Student CRUD (admin) + public parent lookup/search
│   │   ├── payments.js    Payment list, manual reconciliation, M-Pesa mocks
│   │   └── dashboard.js   Dashboard stats, reports, reminders, audit log
│   └── .env.example
├── frontend/
│   └── elimupay.html      Marketing site + 3 login-gated/public areas (see below)
├── docs/
│   ├── API.md             Full endpoint reference
│   └── DATABASE.md        Data model and how to move to Postgres/Supabase
└── README.md               You are here
```

## Quick start

Requires Node.js 18+.

```bash
cd backend
npm install
npm run seed      # writes backend/data/db.json from seed-data.js
npm start         # http://localhost:4000
```

Confirm it's running:

```bash
curl http://localhost:4000/api/health
# {"status":"ok","time":"..."}
```

Then open `frontend/elimupay.html` in a browser. It talks to
`http://localhost:4000` by default — see **Connecting the frontend** below to
change that.

## Signing in as a school administrator

The seed data includes one onboarded school with one admin account, so you
can sign in on the "For schools" section of the page immediately:

```
Email:    admin@bungomahill.ac.ke
Password: ElimuPay2026!
```

A second seeded school exists too, so multi-school behaviour has something
real to test against:

```
Email:    admin@sunriseacademy.ac.ke
Password: SunriseAdmin2026!
```

This is the credential pattern a real school would be given after
onboarding (see **Onboarding a new school** below) — there is no self-signup
on the site itself, on purpose.

## Signing in as the platform administrator

The "Platform admin" link in the footer/nav leads to a separate login, for
running ElimuPay itself rather than any one school:

```
Email:    founder@elimupay.co.ke
Password: FounderAccess2026!
```

From there you can onboard schools, suspend or permanently delete one,
review "request access" leads, and publish version notes — see **What the
platform administrator can do** below. This is a distinct account type
(`role: "superadmin"` in `users`), not just an admin with extra pages — its
token is checked by a separate `requireSuperAdmin` middleware in `auth.js`,
and it doesn't belong to any one school (`schoolId: null`).

## What the platform administrator can do

| Action | How |
|---|---|
| Onboard a new school | "Schools" tab → fill in the form. Creates the school and its first admin account in one step, and shows you the generated password once |
| Suspend a school | "Schools" tab → Suspend. Blocks that school's admin login immediately; parent payments into it are blocked too |
| Reactivate a school | Same button, once suspended |
| Permanently delete a school | "Schools" tab → Delete (asks for confirmation). Removes the school, its students, payments, admin accounts and reminders. Its past audit log entries are kept as a record that it existed |
| Review access requests | "Leads" tab — shows everyone who submitted the public "Request access" form, with a status you can update |
| See platform-wide numbers | "Overview" tab — schools, students, money collected/outstanding across every school at once |
| Publish a version note | "Version & maintenance" tab. **This records what changed and updates the version shown publicly — it does not deploy code.** Deploying is still `git push`/redeploy, done outside this dashboard |
| Pause school-admin logins during a deploy | Same tab, "Maintenance mode" toggle. Deliberately leaves parent lookups and payments working, so fees can still be paid while you deploy |

## Deploying

This section says exactly where each half of the project goes and how they
find each other. There are two separate things to put somewhere — they do
not have to be on the same host:

1. **`backend/`** — a Node process that must run continuously and stay
   reachable at one fixed URL. This is the part with a real deploy target.
2. **`frontend/elimupay.html`** — one static file with no build step. It
   goes wherever you can host a static file and get a URL back: Netlify,
   Vercel, GitHub Pages, S3, or the "Publish" feature of whatever tool you
   used to get this project (e.g. this file is also what an Anthropic
   Artifact publish serves). It does not need to be on the same host, or
   even the same domain, as the backend — `API_BASE_URL` is what connects
   them (see **Connecting the frontend** below).

### Where the backend specifically goes

Pick one place to run `backend/` continuously. In order of least setup:

**Render (recommended for this project's size)**
1. Push this repo to GitHub.
2. On [render.com](https://render.com): New → Web Service → connect the repo, root directory `backend/`.
3. Build command: `npm install`. Start command: `node server.js`.
4. Add environment variables from `.env.example` — at minimum a real
   `JWT_SECRET`, and `CORS_ORIGIN` set to your frontend's exact URL (not `*`).
5. **Add a Render Disk** (Settings → Disks) mounted at `/opt/render/project/src/backend/data`,
   at least 1 GB. Without this, `data/db.json` lives on ephemeral storage and
   every restart or redeploy silently resets every school back to the seed
   data — this is the single most common way this project breaks in
   production, and it happens quietly.
6. Render gives you a URL like `https://elimupay-api.onrender.com`. That
   whole string plus `/api` is your `API_BASE_URL`.

**Railway / Fly.io** — same shape: connect the repo, set the root to
`backend/`, start command `node server.js`, set the same environment
variables, and attach a persistent volume for `backend/data/` for the same
reason as step 5 above. Both give you a URL the same way Render does.

**Your own VM (EC2, DigitalOcean, a spare Linux box)** — clone the repo,
`cd backend && npm install`, copy `.env.example` to `.env` and fill it in,
then keep `node server.js` running with `pm2` or a `systemd` service (a
plain `node server.js &` will not survive a reboot or an SSH disconnect).
Put Nginx or Caddy in front of it for HTTPS and a real domain — Daraja's
real M-Pesa callback (see **Going live with M-Pesa** below) will refuse a
plain HTTP callback URL.

**Whichever you choose, the durable fix for step 5's warning is the same:**
migrate `backend/db.js` from the JSON file to Postgres/Supabase per
`docs/DATABASE.md`. A persistent disk is the minimum to not lose data by
accident; a real database is what you actually want before onboarding
schools you can't afford to lose data for.

### Where the frontend specifically goes, and how it finds the backend

Once the backend has a real URL (from whichever option above), open
`frontend/elimupay.html` and change the one line near the top of its
`<script>` block:

```js
var API_BASE_URL = "https://elimupay-api.onrender.com/api";
```

Then upload that one file to your static host of choice and publish it.
That's the entire frontend deploy — there's no build step, no `npm install`
for it, nothing else to configure. The URL your static host gives you back
is what you put in front of parents and schools; it's unrelated to, and
does not need to resemble, the backend's URL.

If you serve the frontend from more than one URL (a staging copy and a
production copy, say), each copy needs `CORS_ORIGIN` on the backend to
include it — a comma-separated list is fine:

```
CORS_ORIGIN=https://elimupay.co.ke,https://staging.elimupay.co.ke
```

## Connecting the frontend

Near the top of the `<script>` block in `frontend/elimupay.html`:

```js
var API_BASE_URL = "http://localhost:4000/api";
```

This is the same line as in **Deploying** above — for local development
leave it pointing at `localhost:4000`; for anything real, point it at the
backend's deployed URL. Unlike earlier drafts of this project, there is no
fixed `SCHOOL_ID` constant — a school administrator's session carries the
real school ID returned by `/auth/login`, and the parent portal asks the
parent to find their school first, so the frontend now genuinely supports
more than one school without any further code changes.

There is no offline or demo mode. If the API can't be reached, the login
forms, both dashboards and the parent portal all show a real error message
rather than substituting fake data.

## Onboarding a new school

The platform administrator dashboard (see above) is now the real way to do
this — the manual steps below are what that dashboard does under the hood,
useful if you're scripting onboarding instead of clicking through it:

1. `POST /api/superadmin/schools` with the school's name, county, and
   M-Pesa Paybill/Till number, plus the new admin's name and email (see
   `docs/API.md`). This creates the school and the admin account together
   and returns a one-time password.
2. Send the administrator their email and password. They sign in from the
   "For schools" section of the site — no separate admin URL to remember.
3. Ask the school to have parents use the student's **admission number** as
   the M-Pesa account reference when paying, since that's what reconciliation
   matches on first (name/class search is the fallback when they don't have it).

A school that submits the public "Request access" form is saved via
`POST /api/leads` and shows up in the platform administrator's "Leads" tab
— that's step zero, before either of the above.

## What's real and what's a mock

| Area | Status |
|---|---|
| School admin authentication | Real — scoped to one school; a suspended school's admin cannot log in |
| Platform administrator authentication | Real — separate role, separate dashboard, can manage every school |
| Students, fee balances, payments | Real — stored in `backend/data/db.json`, survives restarts |
| Dashboard stats, reports | Real — computed on request from live data |
| Reconciliation matching | Real logic — matches a payment's account reference to a student's admission number |
| Parent name/grade search | Real — falls back to admission-number-only when a name is ambiguous, scoped per school so identical names at different schools never collide |
| Reminder on/off switches | Real — persisted per school |
| Audit log | Real — scoped per school for admins, platform-wide for the superadmin |
| School onboarding, suspension, deletion | Real — cascades through students/payments/admin accounts on delete |
| Version notes & maintenance mode | Real records/flags — publishing a version note does not deploy code (see the table above) |
| Request-access leads | Real — `POST /api/leads` stores school onboarding requests |
| M-Pesa STK Push / C2B callback | **Mocked.** `routes/payments.js` simulates what Safaricom's Daraja API would do. See "Going live with M-Pesa" below |

## Going live with M-Pesa

Two Daraja endpoints are mocked so the product works without live credentials:

- `POST /api/mpesa/stk-push` — stands in for Daraja's *Lipa Na M-Pesa Online*
  request, used by the parent portal's "Pay balance" button.
- `POST /api/mpesa/callback` — stands in for the C2B confirmation callback
  Safaricom calls after a real payment. Point Safaricom's callback URL here
  once you register the school's Paybill for API access.

To switch these on for real:

1. Register a Daraja app at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) against the school's Paybill (Till numbers generally don't support the C2B API — see the note in `docs/API.md`).
2. Fill in the `DARAJA_*` values in `backend/.env`.
3. Replace the body of the two route handlers in `routes/payments.js` with real calls to Daraja, keeping the same request/response shape so the frontend doesn't need to change.
4. Require the payer to enter the student's **admission number** as the M-Pesa account reference — that's what the matching logic in `db.js` keys on.

## Before a broader rollout

This backend is intentionally minimal so the moving pieces are easy to read.
Admin authentication is real (see above), but before onboarding many schools
at once, add:

- **A real database** — `backend/db.js` is a single JSON file for clarity;
  see `docs/DATABASE.md` for the schema and how to move it to Postgres/Supabase
  without changing the routes.
- **A way for the platform administrator to reset a school admin's password**
  — today the only way to set one is the "create school" flow; there's no
  "resend/reset" action yet for an existing account.
- **Input validation** — request bodies are only lightly checked.
- **Rate limiting on `/api/auth/login`** (both school-admin and platform-admin) — to slow down password guessing.
- **HTTPS and a real CORS_ORIGIN** — the `.env.example` defaults to `*` for
  local development only.
- **Removing or protecting `/api/dev/reset`** — see `docs/API.md`.

## Documentation

- [`docs/API.md`](docs/API.md) — every endpoint, with request/response examples.
- [`docs/DATABASE.md`](docs/DATABASE.md) — the data model and audit log design.
