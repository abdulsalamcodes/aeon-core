# Aeon Roadmap

Deferred features and future work for the Aeon platform (`aeon-core` backend +
`aeon-web` frontend). This is the single home for anything intentionally left
for later — the product itself only advertises what ships today.

Status legend: **Next** = required before onboarding real, paying schools ·
**Planned** = clear value, not blocking launch · **Exploring** = wanted, not yet
scoped.

---

## Notifications — real delivery

Today every channel is a log stub (`src/notifications/log-channel.ts`); the
enrolment ripple's "notify guardian" step writes a log line, it does not send.

- **Next** — Wire an SMS provider for Nigeria (Termii or Africa's Talking) behind
  the existing channel registry.
- **Next** — Connect the email channel to a real transport via `src/email/email.ts`
  (currently password-reset emails also depend on this).
- **Planned** — Delivery status tracking and retries surfaced in the UI.

## Payments — deepening (Paystack is live for NGN)

Online fee payment and per-term subscription billing work end-to-end against
Paystack. Remaining work:

- **Next** — Provision live keys and register the webhook URL
  (`/v1/public/payments/webhook/paystack`) in the Paystack dashboard.
- **Next** — Per-school Paystack **subaccounts** so fees settle into each school's
  own bank account and Aeon never holds funds.
- **Planned** — Per-student **dedicated virtual accounts** so bank transfers
  reconcile automatically against the right student.
- **Planned** — Invoices + receipts: an invoices table and downloadable receipts
  (the Billing panel currently shows an empty invoices state).
- **Planned** — Automated per-term subscription invoicing and payment reminders.
- **Exploring** — Additional gateways through the existing `PaymentProvider`
  abstraction — Flutterwave and mobile money (M-Pesa, MTN MoMo, Orange Money) —
  routed by currency for multi-country support.

## Auth & sessions

Refresh tokens are live for the staff/admin console (silent re-auth on access-token
expiry). Remaining:

- **Planned** — Extend refresh tokens to the student/parent portal and the
  super-admin portal (both still hold short-lived access tokens only).
- **Planned** — Server-side refresh-token store for revocation and rotation
  (today refresh tokens are stateless).
- **Planned** — Real email verification (`/v1/auth/verify-email` is currently a
  no-op).

## Rate limiting & abuse

An in-memory fixed-window limiter protects the login and webhook surfaces
(`src/lib/rate-limit.ts`).

- **Next** — Move counters to a shared store (Redis) so limits hold across
  multiple instances.
- **Planned** — Per-account (per-email) login throttling in addition to per-IP,
  to protect schools behind a shared NAT without weakening brute-force defence.

## Object storage

Photo uploads use a provider abstraction (`src/storage/`) with a Cloudflare R2
implementation and an inline data-URL fallback for dev. When R2 is configured,
the browser uploads bytes **directly to R2 via a presigned URL** — they never
pass through the API (`POST /v1/uploads/photo/presign`).

- **Next** — Configure R2 credentials in production (`R2_*` env vars).
- **Next** — Enforce a max object size on direct uploads. Presigned PUT URLs do
  not cap size; use a presigned POST policy (or a bucket lifecycle/size rule).
- **Planned** — Now that photos skip the API, the `express.json` 12 MB limit is
  only needed for CSV imports and the dev inline-upload fallback — it can be
  lowered once CSV import sizing is confirmed.
- **Planned** — Add further `ObjectStorageProvider` implementations (AWS S3,
  MinIO) if a deployment needs them — the interface already supports it.
- **Exploring** — CDN in front of the public bucket; signed URLs for reading
  private documents.

## Billing enforcement

- **Planned** — Enforce plan student limits server-side (Starter ≤100, Growth
  ≤1,000). The limits are currently displayed but not enforced.

## Platform & production infrastructure

Everything currently runs on embedded PGlite for dev/test.

- **Next** — Managed Postgres with a pooled connection (PgBouncer) and migrations
  run in the deploy pipeline.
- **Next** — Redis for the outbox relay / worker tier (`src/worker/`).
- **Next** — Error tracking (e.g. Sentry), log aggregation, uptime monitoring.
- **Next** — Automated backups and a documented disaster-recovery procedure.
- **Planned** — Security headers (helmet), secrets management, an audit-log
  retention policy.

## Security & compliance

- **Next** — Confirm the production `CORS_ORIGINS` allowlist and required
  `JWT_SECRET` / `JWT_REFRESH_SECRET` are set (the app now refuses to boot in
  production without them).
- **Planned** — NDPR privacy policy, terms of service, and a data-processing
  agreement for schools (the compliance export/erase endpoints already exist).

## Product depth

- **Planned** — Multi-curriculum support (e.g. British / French streams with
  distinct grading and reporting). The grading scheme is configurable today, but
  running multiple curricula in one school is not yet a feature.
- **Planned** — Non-NGN payment paths (the ledger is already multi-currency).
- **Exploring** — Offline-first capture for attendance and grades during outages.

## Web frontend

- **Planned** — Automated test coverage for `aeon-web` (currently none; the
  backend has a suite).
- **Planned** — Real customer logos / case studies on the landing page once
  schools are live (the earlier placeholder testimonials and stats were removed).

## Repository hygiene

- **Next** — The workspace root and `docs/` are not under version control; only
  `aeon-core` and `aeon-web` are git repos. Decide whether the root, docs, and
  this roadmap should live in their own repo.
