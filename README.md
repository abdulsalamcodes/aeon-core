# schooler-core

The greenfield Aeon core from [`schooler-be/docs/architecture/ARCHITECTURE.md`](../schooler-be/docs/architecture/ARCHITECTURE.md) — **Phase 0 foundations**. A Postgres + Drizzle, RLS-isolated, modular monolith with a transactional outbox and a worker tier. The legacy Express/Mongo backend keeps running; features are ported here module by module (strangler).

> Status: **Phase 0 skeleton**. It compiles and runs against a real Postgres + Redis. One trivial module — **subjects** — is wired end-to-end (schema → RLS → service → routes → outbox → worker) to prove the stack. Phase 1 (identity + org graph) builds on this.

## What's here

| Concern | Where | ADR |
|---|---|---|
| Postgres client (pooled) | `src/db/client.ts` | ADR-1 |
| Schema (org → school → subjects, outbox) | `src/db/schema/*` | ADR-1/2/5 |
| Migrations incl. **RLS policies** | `src/db/migrations/*.sql` | ADR-2 |
| Tenant context (RLS bound per request) | `src/tenant/*` | ADR-2 |
| Transactional outbox + relay | `src/events/*` | ADR-5 |
| Event bus (Redis Streams) | `src/events/bus.ts` | ADR-5 |
| Worker tier | `src/worker/index.ts` | ADR-6 |
| Subjects module (vertical slice) | `src/modules/subjects/*` | ADR-3 |
| Module-boundary lint | `eslint.config.js` | ADR-3 |
| CI (Postgres + Redis, migrate, test) | `.github/workflows/core-ci.yml` | — |

## How tenant isolation works (the important bit)

1. `tenantResolver` resolves the active school for the request and stores it in an `AsyncLocalStorage` context.
2. Every service call runs inside `withTenant(tx => …)`, which opens a transaction and sets transaction-local GUCs: `app.current_school`, `app.current_org`, `app.org_wide`.
3. **RLS policies** (`0001_rls.sql`) filter every row by those GUCs. A query with no tenant context returns **zero rows**; a query that forgets its `WHERE` still cannot cross schools. Isolation is structural, not a discipline you can forget.

## Run it locally

```bash
cp .env.example .env            # point DATABASE_URL / REDIS_URL at local services
npm install
npm run db:migrate              # applies schema + RLS policies
npm run dev                     # API on :8080
npm run worker                  # relay + event consumers (separate process)
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
- Next: **Phase 1 — Identity + Org graph** (`account` / `person` / `membership` / `role`), porting auth so the three portals resolve through memberships.
