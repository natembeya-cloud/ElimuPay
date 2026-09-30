# Data Model

The backend currently stores data in a single JSON file,
`backend/data/db.json`, shaped by `backend/seed-data.js`. This document
describes that shape and how to move to a real database later.

## Why JSON first

`db.js` is written as a small set of functions (`listStudents`,
`addStudent`, `receivePayment`, `dashboardStats`, …) that the route files
call. Nothing outside `db.js` knows or cares that the storage is a JSON
file. Moving to Postgres/Supabase means rewriting the *inside* of those
functions to run SQL instead of reading/writing the file — the routes and
the frontend don't change. That's the intended migration path from the
original product plan's `Supabase/PostgreSQL` choice.

## Entities

### schools
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| name | text | |
| county | text | |
| plan | text | Starter / School / Plus / Enterprise |
| paybillNumber | text | The school's own designated M-Pesa Paybill/Till — where parent payments actually land |
| status | text | `active` \| `suspended` — set by the platform administrator (`PATCH /superadmin/schools/:id`). Suspended blocks that school's admin login and hides it from `GET /schools/search` |
| createdAt | timestamp | |

Deleting a school (`DELETE /superadmin/schools/:id`) removes its row here
along with every `students`/`payments`/`users`/`reminderSettings`/
`notifications` row scoped to it — see `db.js` → `deleteSchool`.

### users
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| schoolId | integer → schools.id, **nullable** | Null only for the superadmin, who isn't scoped to a school |
| name | text | |
| email | text | Used to sign in |
| passwordHash | text | bcrypt hash — see README "Onboarding a new school" for how one gets generated |
| role | text | `admin` (one school) or `superadmin` (the platform, exactly one seeded account) |

`POST /api/auth/login` checks `email` + `passwordHash`. An `admin` gets a
JWT scoped to `schoolId`; a `superadmin` gets one with `schoolId: null`
that `requireSuperAdmin` (in `auth.js`) accepts for `/superadmin/*`, and
that `requireAuth` exempts from the schoolId match on ordinary admin
routes. See `backend/auth.js` for both middlewares.

### platform
Not a row-based table — a single object (`db.platform`) holding
site-wide state the superadmin controls:

| Field | Type | Notes |
|---|---|---|
| maintenanceMode | boolean | While true, `POST /auth/login` refuses `role: "admin"` accounts with `503`. Parent-facing routes and superadmin login are unaffected |
| versions | array of `{ id, version, notes, releasedAt }` | Append-only; the most recently released one is "current" for `GET /version` |

Read via `getPlatformInfo()`, written via `addPlatformVersion()` and
`setMaintenanceMode()` in `db.js`. Publishing a version note here is a
record-keeping action, not a deploy — see README "What the platform
administrator can do".

### leads
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| name | text | Contact person at the prospective school |
| schoolName | text | |
| phone | text | |
| email | text, nullable | |
| studentCount | text, nullable | e.g. `"101–300"` |
| message | text, nullable | |
| status | text | `new`, `contacted`, `onboarded`, or `declined` — set by the platform administrator via `PATCH /superadmin/leads/:id` |
| createdAt | timestamp | |

Created by the public "Request access" form (`POST /api/leads`) — this is
where a school's relationship with ElimuPay starts, before an admin account
exists for them. The platform administrator's "Leads" tab is what reads
and updates these.

### students
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| schoolId | integer → schools.id | |
| name | text | |
| className | text | |
| admissionNo | text | Unique per school. **This is the M-Pesa account reference parents must use.** |
| parentPhone | text | MSISDN, e.g. `254712000014` |
| expected | number | Fee expected this term |
| paid | number | Running total paid this term |
| balance | number | `expected - paid`, floored at 0 |
| createdAt | timestamp | |

### payments
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| schoolId | integer → schools.id | |
| reference | text | Internal transaction reference (stands in for the M-Pesa receipt number) |
| accountReference | text | Whatever the payer typed as the account number |
| payerPhone | text | |
| amount | number | |
| status | text | `matched` \| `unmatched` |
| studentId | integer → students.id, nullable | Null until matched |
| createdAt | timestamp | |

### reminderSettings
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| schoolId | integer → schools.id | |
| key | text | Stable identifier, e.g. `weekly_balance_reminder` |
| label | text | |
| description | text | |
| enabled | boolean | |

### notifications
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| schoolId | integer → schools.id | |
| studentId | integer → students.id | |
| type | text | e.g. `payment_confirmation` |
| message | text | Rendered message text |
| deliveryStatus | text | `queued` today — set this from the real SMS/WhatsApp provider's response once connected |
| createdAt | timestamp | |

### auditLogs
| Field | Type | Notes |
|---|---|---|
| id | integer | |
| userId | integer, nullable | Null for system-generated changes (e.g. an automated M-Pesa match) |
| action | text | e.g. `PAYMENT_RECONCILED`, `STUDENT_CREATED` |
| entity | text | e.g. `student:4` |
| before | object | State before the change |
| after | object | State after the change |
| at | timestamp | |

Every function in `db.js` that changes a student's balance writes one of
these — this is what answers "who changed this record and when" from the
original product requirements.

## Reconciliation logic

`receivePayment(schoolId, { reference, payerPhone, amount })` in `db.js` is
the one function that matters most:

1. Look up a student in the same school whose `admissionNo` matches
   `reference` (case-insensitively).
2. If found: increase `paid`, recompute `balance`, write an audit log entry,
   and queue a payment-confirmation notification. Store the payment as
   `matched`.
3. If not found: store the payment as `unmatched` with `studentId: null`,
   for the admin dashboard's review queue.

This is intentionally simple — production reconciliation will also want to
handle: partial admission-number typos, a parent paying for two children in
one transaction, and payments that arrive before a student is registered.

## Moving to Postgres/Supabase

1. Create tables matching the shapes above (Supabase's table editor or a
   migration file both work).
2. Reimplement each exported function in `db.js` using SQL/Supabase client
   calls instead of `fs.readFileSync`/`writeFileSync`, keeping the same
   function names and return shapes.
3. Add a connection string to `.env` and initialise the client at the top of
   `db.js`.
4. Delete `backend/data/db.json` and `ensureDataFile()` — the database is now
   the source of truth.

No changes are needed in `routes/*.js`, `server.js`, or the frontend.
