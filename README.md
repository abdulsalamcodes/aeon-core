# schooler-core

The greenfield Aeon core from [`schooler-be/docs/architecture/ARCHITECTURE.md`](../schooler-be/docs/architecture/ARCHITECTURE.md) — **Phase 0 foundations**. A Postgres + Drizzle, RLS-isolated, modular monolith with a transactional outbox and a worker tier. The legacy Express/Mongo backend keeps running; features are ported here module by module (strangler).

> Status: **Phases 0–4 complete and runnable end-to-end.** `EMBEDDED_DB=1 npm run dev` boots a working API with zero external infra (in-process Postgres); `npm run build` compiles to `dist/`; typecheck, lint, and 26 tests pass — including an integration test that drives login → enrolment → the cross-module ripple → idempotent payment against a real (embedded) database. Phase 0 = tenant/RLS + outbox + worker. Phase 1 = identity (accounts/persons/memberships/roles, scrypt+JWT auth). Phase 2 = People + Academics (enrolment + attendance/grades). Phase 3 = Finance (append-only multi-currency ledger, idempotent payments, `PaymentProvider` abstraction). **Phase 4 = Workflow + Notifications**: a reusable approval engine (definitions → instances → tasks, emits `WorkflowCompleted`) and an event-driven, SMS-first notification service with a pluggable `Channel` abstraction.
>
> The **enrolment ripple now spans three modules from one event**: `StudentEnrolled` → Academics seeds the attendance register, Finance bills the term's default fee, and Notifications SMSes the guardian — none calling another directly (ADR-5). This is the Rippling-style "system-of-record change ripples outward" thesis, working end-to-end.

## What's here

| Concern | Where | ADR |
|---|---|---|
| Postgres client (pooled) | `src/db/client.ts` | ADR-1 |
| Schema (org → school, identity, subjects, outbox) | `src/db/schema/*` | ADR-1/2/4/5 |
| Migrations incl. **RLS policies** | `src/db/migrations/*.sql` | ADR-2 |
| Tenant context (RLS bound per request) + login escape | `src/tenant/*` | ADR-2/4 |
| **Identity** (accounts/persons/memberships/roles/staff) | `src/modules/identity/*` | ADR-4 |
| Auth: password (scrypt), JWT (jose), middleware | `src/auth/*` | ADR-4 |
| **People** (enrollment → `StudentEnrolled`, guardianship) | `src/modules/people/*` | ADR-4/5 |
| **Academics** (attendance, grades, enrolment ripple) | `src/modules/academics/*` | ADR-5 |
| **Finance** (fee structures, append-only ledger, payments) | `src/modules/finance/*` | ADR-8 |
| `PaymentProvider` abstraction (stub + registry) | `src/payments/*` | ADR-11 |
| **Notifications** (event-driven, SMS-first) | `src/modules/notifications/*` | ADR-11 |
| `Channel` abstraction (sms/whatsapp/email) | `src/notifications/*` | ADR-11 |
| **Workflow** (approval engine: definitions/instances/tasks) | `src/modules/workflow/*` | ADR-10 |
| Transactional outbox + relay | `src/events/*` | ADR-5 |
| Event bus (Redis Streams) | `src/events/bus.ts` | ADR-5 |
| Worker tier | `src/worker/index.ts` | ADR-6 |
| Subjects module (vertical slice) | `src/modules/subjects/*` | ADR-3 |
| Module-boundary lint | `eslint.config.js` | ADR-3 |
| CI (Postgres + Redis, migrate, test) | `.github/workflows/ci.yml` | — |

## Identity & login (Phase 1)

One **account** = one human login (global). A **person** holds the PII (tenant-owned); **memberships** bind an account/person to a `school × role × scope`, so one human can be a teacher at one school and a guardian at another. `staff_profiles` carry HR data.

`POST /v1/auth/login` verifies the account, then reads its memberships across schools via the `app.current_account` RLS escape (a principal may always read its own memberships before a tenant is chosen), and mints a JWT bound to the chosen membership. `tenantResolver` reads that JWT to bind RLS for every subsequent request. `GET /v1/auth/me` returns the principal's active membership + all memberships.

`provisionService.addPrincipal()` is the onboarding primitive (account + person + membership in one go); `ensureSystemRoles()` seeds the system roles.

## How tenant isolation works (the important bit)

1. `tenantResolver` resolves the active school for the request and stores it in an `AsyncLocalStorage` context.
2. Every service call runs inside `withTenant(tx => …)`, which opens a transaction and sets transaction-local GUCs: `app.current_school`, `app.current_org`, `app.org_wide`.
3. **RLS policies** (`0001_rls.sql`) filter every row by those GUCs. A query with no tenant context returns **zero rows**; a query that forgets its `WHERE` still cannot cross schools. Isolation is structural, not a discipline you can forget.

## Run it locally

**Zero infra (embedded Postgres):** the fastest way to see it work — runs an
in-process Postgres (PGlite), auto-migrates, and seeds a demo school + admin.

```bash
npm install
EMBEDDED_DB=1 npm run dev        # API on :8080, no Postgres/Redis needed
# login: admin@demo.aeon / Demo-Pass-123
curl -s localhost:8080/health
TOKEN=$(curl -s -XPOST localhost:8080/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@demo.aeon","password":"Demo-Pass-123"}' | jq -r .data.accessToken)
curl -s localhost:8080/v1/auth/me -H "authorization: Bearer $TOKEN"
curl -s -XPOST localhost:8080/v1/subjects -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"name":"Mathematics"}'
```

`src/integration.test.ts` runs the whole flow end-to-end against embedded
Postgres: migrate → login → enrol → the three-module ripple → idempotent payment.

**Real Postgres + Redis (production-like):**

```bash
cp .env.example .env             # point DATABASE_URL / REDIS_URL at local services
npm run db:migrate               # applies schema + RLS policies
npm run dev                      # API on :8080
npm run worker                   # relay + event consumers (separate process)
```

Smoke test the vertical slice (tenant supplied via header in Phase 0):

```bash
# seed an org + school first (psql), then:
curl -XPOST localhost:8080/v1/subjects \
  -H 'content-type: application/json' \
  -H "x-org-id: <ORG_UUID>" -H "x-school-id: <SCHOOL_UUID>" \
  -d '{"name":"Mathematics"}'
# → creates the subject AND an outbox row in one txn; the worker logs
#   "reacted to SubjectCreated" after the relay ships it to the bus.
```

## Phase 0 exit criteria (from ARCHITECTURE.md)

- [x] Postgres + Drizzle + migrations
- [x] RLS scaffolding + per-request tenant context middleware
- [x] Modular-monolith skeleton with boundary enforcement (lint)
- [x] Outbox table + relay
- [x] Redis + worker tier
- [x] CI (typecheck, lint, migrate, test)
- [x] A trivial module (`subjects`) runs end-to-end on the new stack

## Notes

- Migrations here are hand-written for the skeleton; `npm run db:generate` regenerates canonical migrations from `src/db/schema` going forward.
- The relay/worker should connect as a `BYPASSRLS` role so it can drain every tenant's outbox (see comment in `0001_rls.sql`).
- `accounts` is global (no RLS) — protected at the app/role layer; login happens before a tenant exists.
- Remaining Phase 4 tail (not yet built): SaaS **billing/plans**, a **public API + outbound webhooks** surface, and a **read replica** for reporting.
- Biggest remaining integration: **port the web portals** (`schooler-web`) to authenticate against `/v1/auth` and read/write the new core, then cut over from the legacy Express/Mongo backend module by module.
- Provider/channel stubs (`StubProvider`, `LogChannel`) are where **Paystack/Flutterwave** and **Termii/Africa's Talking** implementations plug in — no finance/notification code changes.
