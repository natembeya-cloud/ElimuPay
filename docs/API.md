# API Reference

Base URL (local): `http://localhost:4000/api`

All request and response bodies are JSON.

## Authentication

Routes under `/schools/:schoolId/...` marked **admin only** below require a
header:

```
Authorization: Bearer <token>
```

Get a token from `POST /auth/login`. A school-admin token is scoped to one
school — using it against a different `:schoolId` returns `403`. A
`role: "superadmin"` token is exempt from that check (see "Platform
administration" below) and additionally required, via a separate
`requireSuperAdmin` check, for every `/superadmin/*` route. Tokens expire
after 12 hours (`auth.js` → `jwt.sign(..., { expiresIn: '12h' })`).

Routes used by parents (student lookup/search, STK push, the M-Pesa
callback), `POST /leads`, and `GET /schools/search` / `GET /version` are
intentionally public — parents don't have accounts.

### `POST /auth/login`

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bungomahill.ac.ke","password":"ElimuPay2026!"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "name": "Administrator", "email": "admin@bungomahill.ac.ke", "role": "admin" },
  "school": { "id": 1, "name": "Bungoma Hill Academy" }
}
```

`401` on a wrong email/password. `403` if the account's school has been
suspended by the platform administrator. `503` if platform maintenance
mode is on and this is a school-admin account (a superadmin can still log
in during maintenance). See README "Onboarding a new school" for how a new
admin account gets created.

A superadmin login (e.g. `founder@elimupay.co.ke`) returns `"school": null`
and `"role": "superadmin"` instead — that token works against
`/superadmin/*` and bypasses the schoolId check on ordinary admin routes.

### `POST /leads`

Public. A school requesting access submits its details here — this is the
"Request access" form on the site, not an account.

```bash
curl -X POST http://localhost:4000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Wafula","schoolName":"Sunrise Academy","phone":"254700123456","email":"jane@sunrise.ac.ke","studentCount":"101-300","message":"We use Paybill 555222."}'
```

```json
{ "message": "Thank you — we will be in touch to arrange onboarding.", "lead": { "id": 1, "status": "new", "...": "..." } }
```

`400` if `name`, `schoolName` or `phone` is missing.

---

## Health

### `GET /health`

```json
{ "status": "ok", "time": "2026-09-20T19:58:09.995Z" }
```

---

## Students

### `GET /schools/:schoolId/students`  *(admin only)*

List every student at a school.

```bash
curl http://localhost:4000/api/schools/1/students
```

```json
[
  {
    "id": 1,
    "schoolId": 1,
    "name": "Brian Wekesa",
    "className": "Class 3",
    "admissionNo": "BHA-014",
    "parentPhone": "254712000014",
    "expected": 10000,
    "paid": 8000,
    "balance": 2000,
    "createdAt": "2026-05-04T08:00:00.000Z"
  }
]
```

### `POST /schools/:schoolId/students`  *(admin only)*

Register a student.

```bash
curl -X POST http://localhost:4000/api/schools/1/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Kid","className":"Class 1","admissionNo":"BHA-999","expected":9000,"parentPhone":"254700000000"}'
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `className` | yes | |
| `admissionNo` | yes | Must be unique per school — this is what payments are matched against |
| `expected` | no | Defaults to `0` |
| `parentPhone` | no | |

Responses: `201` with the created student, `400` if a required field is
missing, `409` if the admission number is already used at that school.

### `GET /schools/:schoolId/students/:admissionNo`  *(public — parent lookup)*

Parent-portal lookup: a student's balance plus payment history, keyed by
admission number instead of internal ID (parents don't know the ID).

```bash
curl http://localhost:4000/api/schools/1/students/BHA-014
```

```json
{
  "student": { "id": 1, "name": "Brian Wekesa", "balance": 2000, "...": "..." },
  "history": [
    { "amount": 500, "date": "2026-09-20T19:58:22.606Z", "reference": "SFT2K9L3M1" }
  ]
}
```

`404` if the admission number doesn't exist at that school, or if the
school is suspended.

### `GET /schools/:schoolId/students/search`  *(public — parent name/grade search)*

For a parent who doesn't have the admission number to hand. If
`admissionNo` is given it's treated as authoritative and matched exactly
(same result as the endpoint above); otherwise `name` and `className` are
matched as case-insensitive substrings, scoped to that one school only —
identical names at two different schools never collide.

```bash
# By name only
curl "http://localhost:4000/api/schools/1/students/search?name=Brian"

# By name + grade, to narrow an ambiguous name
curl "http://localhost:4000/api/schools/1/students/search?name=Brian&className=Class%203"
```

```json
[
  { "name": "Brian Wekesa", "className": "Class 3", "admissionNo": "BHA-014" }
]
```

Returns an array (capped at 10) with just enough to disambiguate — the
frontend fetches full balance/history via the exact-lookup endpoint above
once a parent picks the right one. `400` if neither `name` nor
`admissionNo` is given.

---

## Payments

### `GET /schools/:schoolId/payments`  *(admin only)*

All payments, newest first, including unmatched ones awaiting review.

```json
[
  {
    "id": 3,
    "reference": "SFT2K9P7Q4",
    "accountReference": "0712345XXX",
    "payerPhone": "254712345678",
    "amount": 1000,
    "status": "unmatched",
    "studentId": null,
    "createdAt": "2026-09-20T19:58:22.606Z"
  }
]
```

`status` is `"matched"` or `"unmatched"`.

### `POST /schools/:schoolId/payments/:paymentId/reconcile`  *(admin only)*

Manually attach an unmatched payment to a student — the admin dashboard's
"Mark reviewed" action once a human has worked out who actually paid.

```bash
curl -X POST http://localhost:4000/api/schools/1/payments/3/reconcile \
  -H "Content-Type: application/json" \
  -d '{"studentId": 4}'
```

Updates the student's `paid`/`balance`, flips the payment to `matched`, and
writes an audit-log entry. `404` if the payment or student isn't found at
that school.

### `POST /mpesa/callback`  *(mocked Daraja C2B confirmation)*

Simulates what Safaricom calls after a real Till/Paybill payment. `BillRefNumber`
is whatever the payer typed as the account number.

```bash
curl -X POST http://localhost:4000/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{"schoolId":1,"TransAmount":250,"MSISDN":"254733000000","BillRefNumber":"BHA-014"}'
```

If `BillRefNumber` matches a student's admission number, the payment is
auto-matched and a confirmation notification is queued. Otherwise it's stored
as `unmatched` for the admin review queue.

### `POST /mpesa/stk-push`  *(mocked Daraja STK Push)*

Used by the parent portal's "Pay balance via M-Pesa" button.

```bash
curl -X POST http://localhost:4000/api/mpesa/stk-push \
  -H "Content-Type: application/json" \
  -d '{"schoolId":1,"admissionNo":"BHA-014","phone":"254712000014","amount":500}'
```

In production this would call Daraja and return immediately while the parent
enters their PIN on their phone, with the real payment landing later via
`/mpesa/callback`. This mock skips the wait and completes the payment in the
same request so the demo works without live credentials.

> **Till vs Paybill:** Safaricom's C2B API generally requires a **Paybill**
> with an account-number field — a personal Till often can't be wired into
> `/mpesa/callback` at all. Confirm this with Safaricom before assuming a
> school's existing Till will work with the real integration.

---

## Dashboard, reports and reminders

### `GET /schools/:schoolId/dashboard`  *(admin only)*

```json
{
  "totalStudents": 8,
  "expected": 87000,
  "collected": 64700,
  "outstanding": 22300,
  "todaysCollection": 2500,
  "todaysTransactionCount": 2,
  "feeStatus": { "fullyPaid": 3, "partial": 4, "outstanding": 1 },
  "recentPayments": [
    { "student": "Brian Wekesa", "className": "Class 3", "amount": 500 }
  ]
}
```

### `GET /schools/:schoolId/reports/:reportType`  *(admin only)*

`reportType` is one of: `daily-collection`, `outstanding-fees`,
`unmatched-payments`, `term-collection`.

```bash
curl http://localhost:4000/api/schools/1/reports/outstanding-fees
```

```json
{
  "reportType": "outstanding-fees",
  "generatedAt": "2026-09-20T19:58:22.736Z",
  "summary": "6 students owe a combined KSh 30800.",
  "rows": [ { "name": "Brian Wekesa", "balance": 1500, "...": "..." } ]
}
```

### `GET /schools/:schoolId/reminders`  *(admin only)*

```json
[
  { "id": 1, "key": "weekly_balance_reminder", "label": "Weekly balance reminder", "enabled": true }
]
```

### `PATCH /schools/:schoolId/reminders/:reminderId`  *(admin only)*

```bash
curl -X PATCH http://localhost:4000/api/schools/1/reminders/3 \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### `GET /schools/:schoolId/audit-log`  *(admin only)*

Last 100 balance-affecting actions, newest first — who or what changed a
student's record and what it was before/after.

---

## Public: school search & version

### `GET /schools/search?q=...`

For the parent portal's "find your school" step. Only returns schools
whose status is `active` — a suspended school is not discoverable this way.

```bash
curl "http://localhost:4000/api/schools/search?q=Hill"
```

```json
[ { "id": 1, "name": "Bungoma Hill Academy", "county": "Bungoma" } ]
```

### `GET /version`

```bash
curl http://localhost:4000/api/version
```

```json
{
  "current": { "version": "1.0.0", "notes": "Initial pilot release.", "releasedAt": "..." },
  "history": [ { "version": "1.0.0", "...": "..." } ],
  "maintenanceMode": false
}
```

---

## Platform administration (superadmin)

Every route below requires `Authorization: Bearer <token>` from a
`role: "superadmin"` login — a school-admin token gets `403`. See README
"Signing in as the platform administrator" for the seeded credentials.

### `GET /superadmin/overview`

```json
{
  "totalSchools": 2, "activeSchools": 2, "suspendedSchools": 0,
  "totalStudents": 11, "totalCollected": 79700, "totalOutstanding": 71000,
  "newLeads": 1
}
```

### `GET /superadmin/schools`

Every school regardless of status, each with its own rollup so the
dashboard doesn't need N follow-up requests.

```json
[
  {
    "id": 1, "name": "Bungoma Hill Academy", "county": "Bungoma", "plan": "School",
    "paybillNumber": "400200", "status": "active",
    "totalStudents": 8, "collected": 64700, "expected": 87000, "outstanding": 22300
  }
]
```

### `POST /superadmin/schools`

Onboards a school and its first admin account together.

```bash
curl -X POST http://localhost:4000/api/superadmin/schools \
  -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Riverside Prep","county":"Kakamega","paybillNumber":"400777","plan":"Starter","adminName":"Riverside Admin","adminEmail":"admin@riversideprep.ac.ke"}'
```

```json
{
  "school": { "id": 3, "name": "Riverside Prep", "status": "active", "...": "..." },
  "adminEmail": "admin@riversideprep.ac.ke",
  "adminPassword": "Elimu-nabix967"
}
```

`adminPassword` is either what you passed in as `adminPassword`, or a
generated one if you didn't — either way, **this is the only time it's
returned in plaintext.** `400` if `name`, `adminName` or `adminEmail` is
missing; `409` if `adminEmail` is already in use by any school.

### `PATCH /superadmin/schools/:schoolId`

Suspend, reactivate, or edit a school's details. Any subset of these
fields:

```bash
curl -X PATCH http://localhost:4000/api/superadmin/schools/3 \
  -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"suspended"}'
```

Setting `status` to `"suspended"` immediately blocks that school's admin
login and removes it from the public school search; `"active"` reverses
both. `404` if the school doesn't exist.

### `DELETE /superadmin/schools/:schoolId`

Permanently removes the school and everything scoped to it — students,
payments, admin accounts, reminders, notifications. Past audit log entries
for it are kept (with `schoolId` pointing at an id that no longer resolves)
as a record that it existed and was removed.

```bash
curl -X DELETE http://localhost:4000/api/superadmin/schools/3 -H "Authorization: Bearer $SUPER_TOKEN"
```

```json
{ "message": "Riverside Prep and all of its data have been removed." }
```

Suspension is the reversible alternative to this.

### `GET /superadmin/leads`

Every "request access" submission, newest first.

### `PATCH /superadmin/leads/:leadId`

```bash
curl -X PATCH http://localhost:4000/api/superadmin/leads/1 \
  -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"contacted"}'
```

`status` must be one of `new`, `contacted`, `onboarded`, `declined`.

### `GET /superadmin/audit-log`

Every school's audit trail combined, newest first (capped at 200) — the
platform-wide view. Compare with the per-school `GET
/schools/:schoolId/audit-log`, which only an admin of that specific school
(or the superadmin) can read.

### `POST /superadmin/version`

```bash
curl -X POST http://localhost:4000/api/superadmin/version \
  -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"version":"1.1.0","notes":"Added platform admin dashboard."}'
```

Records a new entry and makes it "current" for `GET /version`. **Does not
deploy any code** — see README "What the platform administrator can do".

### `PATCH /superadmin/maintenance`

```bash
curl -X PATCH http://localhost:4000/api/superadmin/maintenance \
  -H "Authorization: Bearer $SUPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

While `true`, `POST /auth/login` for any `role: "admin"` account returns
`503`. Superadmin login, and every parent-facing route (lookup, search,
`mpesa/*`), are unaffected on purpose.

---

## Demo-only route

### `POST /dev/reset`

Wipes `backend/data/db.json` back to `seed-data.js`. Useful between demos.
**Remove or protect this route before a real deployment** — anyone who finds
it can erase live data.

---

## Error shape

Every error response is:

```json
{ "error": "Human-readable message." }
```

with an appropriate HTTP status: `400` (bad input), `401` (missing/invalid/expired
token, or wrong login credentials), `403` (valid token, wrong school), `404`
(not found), `409` (conflict, e.g. duplicate admission number), `500` (server
error).
