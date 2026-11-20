# Backend Implementation Plan

This document is the step-by-step guide for replacing the browser-only business
data in Prime AI Lab with a Cloudflare-hosted backend. Update it as decisions or
requirements change; implement the steps in order unless a dependency is noted.

Current progress: 49 of 65 checklist items (75%). Core patient, master, order,
result, attendance, report, billing, inventory, and lab profile workflows now
use Worker/D1 and private R2 storage.

## 1. Goals and confirmed scope

- Use Cloudflare Workers for the API and Cloudflare D1 (SQLite) for relational
  application data.
- Use one D1 database and one deployment per lab. Do not implement shared
  multi-lab tenancy in the first version.
- Do not implement the AI interpretation server or AI-provider integration as
  part of this backend.
- Do not provide public sign-up. The owner provisions usernames and passwords;
  plaintext passwords are never stored.
- Authenticate and authorize requests on the backend. Frontend role selection
  and navigation are not security controls.
- Start production databases without fictional patients, orders, or other demo
  records.
- Do not migrate the current localStorage data; it is demo-only and will be
  replaced by a clean production database.
- Consider Cloudflare R2 only for actual file uploads. Current candidates are
  the lab logo, owner signature, and payment QR. Report PDFs are generated in
  the browser today and are not currently stored.
- Retain local storage only for device preferences such as appearance and UI
  language unless synchronization is specifically required.

## 2. Current application behavior to preserve

Review these files before changing the corresponding workflow:

- Product scope: [README.md](README.md)
- Frontend structure: [ARCHITECTURE.md](ARCHITECTURE.md)
- Domain types and relationships: `src/shared/types/index.ts`
- Demo/default data and local-storage keys: `src/shared/data/initialStore.ts`
- Main local-store loading: `src/services/browserStorage.ts`
- Main store write path: `src/hooks/useAppCore.ts`
- Patient, master, and multi-test order workflows: `src/hooks/useLabWorkflows.ts`
- Result completion and reagent deduction: `src/hooks/useOrders.ts`
- Attendance persistence: `src/hooks/useAttendance.ts`
- Order-derived estimated revenue: `src/hooks/useRevenueData.ts`
- Billing data and persistence: `src/features/billing/types.ts`,
  `src/features/billing/billingService.ts`, and
  `src/features/billing/BillingPage.tsx`
- Inventory, import bills, payments, and stock deduction:
  `src/features/store-expenditure/types.ts` and
  `src/features/store-expenditure/services/storeExpenditureService.ts`
- Report generation, printing, and sharing: `src/hooks/usePatientReport.ts`
- Lab profile settings and private asset operations:
  `src/features/lab-settings/LabSettingsPage.tsx`,
  `src/services/labSettingsService.ts`, and `worker/labSettings.ts`
- Authentication/session and frontend role boundaries:
  `src/app/RoleLoginPage.tsx` and `src/app/AppLayout.tsx`

Important behavior:

- A patient may be assigned to a technician, sample collector, and referrer.
- One operation can add multiple test orders to a patient.
- Parameterized results may be saved while incomplete; an order is complete
  only when its required parameters have results.
- Completing an order may deduct configured reagents. The deduction must be
  atomic with result completion and must not happen twice.
- Attendance is recorded by technician and date; saving a date replaces or
  clears that date's entries as appropriate.
- Revenue is currently estimated from order dates and current catalogue prices.
  It is not a payment ledger or a measure of collected cash.
- Billing is separate from orders, stores invoice item/price snapshots, and
  currently supports Paid/Unpaid, not partial payments.
- Inventory import bills preserve purchase history; removing an item removes
  it from active stock tracking but should not erase historical bills.
- Lab profile and billing QR images are currently stored in browser storage.
- The current demo logins and role selection do not authenticate a real person.

## 3. Security requirements for provisioned password accounts

There is no signup endpoint. A trusted operator bootstraps the first owner once;
the owner provisions staff usernames, passwords, roles, and role associations.
Store password verifiers using salted PBKDF2-HMAC-SHA-256, never plaintext.
Measure login CPU time in the deployed Worker before production use on the Free
plan's 10 ms limit.

Required controls:

- Unique, normalized usernames; use the same generic response for unknown
  usernames and incorrect passwords.
- Enforce a minimum password length and rate-limit login attempts by username
  and client IP using keyed identifiers.
- Backend-only credential verification and role authorization on every
  protected API route.
- Secure, random, opaque sessions in `Secure`, `HttpOnly`, `SameSite` cookies.
  Store only a hash of the session token in D1; enforce idle/absolute expiry,
  logout/revocation, and session rotation when authenticating again.
- CSRF protection for cookie-authenticated state-changing requests.
- Audit failed logins without recording passwords or session tokens.
- No public self-service signup. Only an authenticated owner may provision or
  disable staff accounts.
- Audit account creation, disablement, login failures, and role changes without
  recording credentials or session tokens.
- Use TLS, least privilege for Cloudflare credentials, separate environment
  secrets, and access-controlled deployment operations.

Confirmed initial roles are `owner`, `lab-technician`, and
`sample-collector`. The owner has full lab access, including user
administration. Technicians may use lab workflows, billing, and inventory, but
cannot administer users. Sample collectors may create patients and orders and
view only records they registered; they cannot access results, billing, or
inventory. Enforce these boundaries in the Worker, not only in the UI. The
current app also has a separate demo “head” login; replace it with an explicit
owner/admin permission rather than retaining a shared hard-coded credential.

## 4. Proposed relational model

Use text primary keys initially to preserve existing IDs during migration.
Define foreign keys, useful indexes, uniqueness constraints, and timestamps in
versioned D1 SQL migrations. Store money in integer paise and quantities in
integer hundredths; convert at the API boundary rather than storing floating
point amounts.

| Tables / records | Relationships and important constraints |
|---|---|
| `lab_settings` | One settings record per database. Store profile fields and, if R2 is enabled, private object keys for logo/signature. |
| `users`, `user_sessions` | Unique normalized username; salted password hash, role, active state, optional collector/technician link. Session table stores hashed tokens and expiry/revocation metadata. No signup route. |
| `lab_technicians`, `referrers`, `sample_collectors` | Lab master records. Archive rather than hard-delete records referenced by history. |
| `patients` | References assigned technician, collector, and referrer where present. Preserve creation time and whether registration originated from a collector workflow. |
| `tests`, `test_parameters`, `test_profiles`, `test_profile_tests`, `test_reagents` | Test catalogue, ordered parameters/groups, profile membership, and inventory requirements. Preserve parameter display order and supplied units/reference text. |
| `lab_orders`, `order_results` | Order references patient and test. Store each parameter result as text to support qualitative observations as well as numeric-looking values. Include status, creation and print metadata. |
| `attendance_records` | Technician/date/status; unique `(technician_id, date)`; record updater and update time. |
| `invoices`, `invoice_items` | Invoice snapshots including patient display details, test name, item amount, discount, total, status, method, and date. Do not recalculate historical invoice amounts from current catalogue prices. |
| `inventory_items`, `import_bills`, `bill_payments` | Inventory and purchase/payment history. Keep bill item-name/unit snapshots. Archive inventory items rather than removing referenced purchase history. |
| `stock_movements` | Append-only movements with quantity delta, source type/id, actor, and timestamp. Enforce idempotency for order reagent deductions. Current stock may be maintained as a checked balance. |
| `audit_events` | Append-only actor/action/entity/time records for sensitive changes. Minimize patient details in audit payloads. |

If partial payments become required, add an invoice payment ledger. Do not model
multiple payments by overloading the current Paid/Unpaid status.

## 5. Implementation sequence

### Phase 0 — Confirm the implementation contract

- [x] Confirm role definitions and route permissions for owner, technician,
  and sample collector.
- [x] Use provisioned username/password accounts with salted hashes and
  cookie-backed sessions; no public signup.
- [x] Confirm initial owner bootstrap and owner-only staff provisioning and
  disablement.
- [x] Keep patient invoices Paid/Unpaid for now; partial payments are supported
  for stock import bills through the separate bill-payment ledger.
- [ ] Define result correction/review rules, report release expectations,
  retention, and audit requirements.
- [ ] Confirm selected Cloudflare plan limits, D1 backup/export options, and
  India privacy/data-location requirements before real patient data is used.

### Phase 1 — Worker and environment foundation

- [x] Add a local Cloudflare Worker API with a D1 binding.
- [x] Add versioned D1 migrations (tracked in Phase 2).
- [ ] Establish separate local, staging, and production configuration.
- [ ] Keep credentials and environment secrets out of the frontend and source
  control.
- [x] Add health/readiness behavior that does not expose secrets or patient
  data.
- [x] Set up local and remote migration commands and a deployment command.

### Phase 2 — Schema and seed policy

- [x] Implement the tables and constraints in section 4.
- [x] Add indexes for patient search, order status/date, attendance date,
  invoice date/status, and inventory lookups as query patterns require.
- [x] Add only intentional, non-patient reference data to production. Never
  silently seed the fictional records in `initialStore.ts`.
- [x] Verify the local migration applies, is idempotent on a second run, has no
  foreign-key violations, and rejects a patient with a missing technician.
- [ ] Add schema tests for foreign keys, uniqueness, archival, and invalid
  references.

### Phase 3 — Authentication, authorization, and audit

- [x] Implement backend account provisioning; do not expose public signup.
- [x] Implement one-time owner bootstrap and owner-only staff provisioning.
- [x] Implement username/password login with salted PBKDF2 hashes and
  rate-limited credential checks.
- [x] Implement current-session lookup, logout, expiry, revocation, secure
  cookies, CSRF protection, and login throttling.
- [x] Add server-side owner checks to the account-management routes and verify
  authentication/CSRF failures. Apply route-specific role checks as domain
  endpoints are added.
- [x] Audit owner bootstrap, login failures, account provisioning,
  and disablement. Add explicit audit events for role changes if that feature
  is introduced.
- [x] Remove the hard-coded head credentials and demo-only login behavior from
  production flows.

Implemented auth routes are `POST /api/auth/bootstrap`,
`POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/logout`, owner-only `GET/POST /api/auth/users`, and owner-only
`DELETE /api/auth/users/:id`. Sessions use hashed random tokens in D1, secure
cookies, 30-minute idle and 8-hour absolute expiry, and CSRF checks on
state-changing authenticated requests. Login attempts are limited per username
and IP over 15-minute windows. Local smoke tests cover login, CSRF, account
provisioning/disablement, and logout/revocation. The frontend now signs in with
these credentials and gates owner and sample-collector UI; core domain data
operations are connected through the Phase 5 migration.

### Phase 4 — Domain API and atomic workflows

- [x] Add patient registration/search and test-catalogue read routes with
  server-side validation and role-scoped responses.
- [x] Add owner/technician master listing, creation, and archival routes for
  technicians, referrers, sample collectors, and tests. Preserve referenced
  records by archiving; prevent archiving technician/collector records linked
  to active accounts.
- [x] Add multi-test order creation with patient ownership and test-profile
  checks; the inserts are batched atomically.
- [x] Add manager order queue/result-save operations for parameterized and
  simple tests, plus collector-scoped order status reads with results redacted.
  Partial saves preserve omitted values; the server derives completion from
  nonblank required results.
- [x] Make result writes, stock validation/deduction, deterministic stock
  movements, order completion, and audit recording one D1 batch. Stock
  movement triggers enforce available stock and update balances; a failed
  deduction rolls the complete batch back. Repeated saves and corrections do
  not deduct reagents twice.
- [x] Add owner-only attendance range reads and date-level saves. Saving a date
  replaces records for active technicians, blank statuses clear that
  technician's record, and archived technician history is retained.
- [x] Add owner/technician invoice creation, listing, and payment status/method
  updates with server-validated billable tests and paise-based totals.
  Patient/test display details, item names, item prices, discount, and final
  amount are snapshotted at creation.
- [x] Add owner/technician inventory item listing and management, atomic stock
  imports, bill payment history and bounded payments, soft archival, and
  paginated stock movement history. Active test reagents prevent item archival.
- [x] Add date-filtered report summaries and owner-only revenue breakdowns.
  Estimated order revenue uses current catalogue prices; invoice billed, paid,
  and unpaid amounts are reported separately and are not presented as profit.
- [ ] Use parameterized SQL and return consistent validation, authorization,
  conflict, and server-error responses.

### Phase 5 — Frontend migration

- [x] Introduce a typed same-origin API client, authenticated-session service,
  and reusable asynchronous action state for loading and errors. Add
  feature-specific services as each workflow is migrated.
- [x] Replace main-store local persistence in `useAppCore` and
  `browserStorage.ts` with API-backed operations. Start with an empty store and
  hydrate it from the authenticated Worker session; old demo localStorage is
  ignored and is not imported.
- [x] Migrate patient registration/editing, master creation, order creation,
  result saves, attendance, and reports to Worker-backed data. The Worker
  remains responsible for result completion and reagent deductions.
- [x] Migrate invoice creation, history, payment updates, inventory items,
  import bills, and bill payments to authenticated Worker APIs. Keep only the
  payment QR in private asset storage.
- [x] Migrate lab profile text settings to D1 and logo, signature, and payment
  QR images to authenticated private R2 routes.
- [x] Keep device-only appearance and language preferences local unless
  synchronization is required.
- [x] Replace main-store `storage`-event synchronization with authenticated
  server refresh.
- [x] Enforce role-based UI for usability while keeping the Worker as the
  actual security boundary.
- [x] Do not build a demo-data import/migration tool.

The main lab store, billing/inventory records, and lab profile settings are no
longer persisted in the browser. Existing demo records remain ignored.
Appearance and language preferences remain local; report PDFs remain generated
in the browser.

### Phase 6 — Optional R2 file storage

- [x] Decide to store the lab logo, signature, and payment QR in private R2;
  owners can change them and authenticated managers can read them.
- [x] Create the production private R2 bucket before deployment.
- [x] Bind R2 in Worker configuration and store only object keys in D1.
- [x] Implement authenticated upload/read/delete routes with file size and
  MIME/type validation.
- [x] Do not expose public file URLs for private assets.
- [x] Keep report PDFs in the browser unless persistent report storage is
  separately required and retention/access rules are defined.

### Phase 7 — Cloudflare frontend and API deployment

- [x] Serve the Vite production build from Cloudflare Workers Static Assets
  with the Worker API on the same origin; keep `/api/*` requests in the Worker.
- [x] Configure SPA fallback and verify API routes are not swallowed by asset
  fallback.
- [x] Keep optional AI interpretation on the local Node server for now; it is
  intentionally unavailable in the Cloudflare production deployment.
- [x] Create the production D1 database and configure its Worker binding
  without importing browser demo data.
- [ ] Configure the authentication HMAC and one-time bootstrap values as
  Cloudflare secrets; never store them in the repository.
- [x] Apply the production schema migrations without importing browser demo
  data.
- [ ] Provision the first owner using the one-time bootstrap process after
  authentication secrets and a deployment URL are ready.
- [x] Configure `diagnova.primesolutions.app` as the custom domain and keep
  authentication cookies host-only for client-subdomain isolation.
- [ ] Verify custom domain, TLS, session cookies, and frontend-to-API behavior
  in staging before production deployment.

### Phase 8 — Verification and rollout

- [ ] Test authentication, role boundaries, session expiry/revocation, CSRF,
  and account provisioning.
- [ ] Test patient/order relationships, partial/completed results, attendance
  upserts, invoice snapshots, and archive behavior.
- [ ] Test duplicate reagent deduction, insufficient stock, and concurrent
  stock updates.
- [ ] Test schema initialization and restore using representative synthetic
  data; no demo localStorage migration is required.
- [ ] Deploy to staging and validate registration through reporting, plus
  billing and inventory flows.
- [ ] Document backup/export and restore procedures; verify a restore before
  launch.
- [ ] Complete India privacy/regulatory review and clinical workflow
  validation before entering real patient data.

The production schema is applied and verified empty of users, patients, and
orders. The Cloudflare zone for `primesolutions.app` is not active and registrar
nameservers have not been changed. Secrets have not been set, the first owner
has not been bootstrapped, and no deployment has been performed.

## 6. API shape guidelines

Prefer workflow-specific endpoints over replacing the browser's entire
`Store` object. Authentication endpoints implemented so far are:

- `POST /api/auth/bootstrap`, `POST /api/auth/login`, `GET /api/auth/me`,
  `POST /api/auth/logout`, owner-only `GET/POST /api/auth/users`, and
  owner-only `DELETE /api/auth/users/:id`

Domain endpoints implemented so far are `GET /api/tests`,
`GET/POST /api/patients`, `PATCH /api/patients/:id`,
`POST /api/patients/:id/orders`,
`GET /api/orders` (including date-range filters and collector-scoped,
result-redacted reads), `PUT /api/orders/:id/results`, and
manager-only `POST /api/orders/print`,
`GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`,
owner-only `GET /api/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/masters`,
owner-only `GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD` and
`PUT /api/attendance/:date`,
manager `GET /api/lab/settings`, owner `PUT /api/lab/settings`,
manager `GET /api/lab/assets/:kind`, owner `POST/DELETE /api/lab/assets/:kind`,
owner/technician `GET/POST /api/invoices` and `PATCH /api/invoices/:id`,
`GET/POST /api/inventory/items`, `PATCH/DELETE /api/inventory/items/:id`,
`GET /api/inventory/items/:id/movements`, `GET/POST /api/import-bills`, and
`POST /api/import-bills/:id/payments`,
`POST /api/masters/lab-technicians`, `POST /api/masters/referrers`,
`POST /api/masters/sample-collectors`, `POST /api/masters/tests`, and `DELETE`
on each master resource with its ID (archive).
Sample collectors can see only patients they registered, cannot submit another
collector assignment, and can create orders only for their own patients. Their
master list is limited to referrers and their own collector record; their test
catalogue response omits prices, result parameters, and reagent/inventory
usage. Manager-created tests validate parameter groups, profiles, and active
material reagents; duplicate reagent entries are combined.

Result correction currently remains available to owners and technicians to
preserve the existing UI behavior. Saving a blank parameter can return an order
to `Pending`; existing reagent deductions are retained and are not repeated.
Confirm the correction/review policy and report-release requirements before
production rollout.

Patient invoice creation currently supports the UI's Paid/Unpaid statuses and
Cash/Online payment methods; patient invoice partial payments are out of scope
for now. Stock import bills do support multiple partial payments through their
separate payment ledger. Report date ranges currently use India local dates
(UTC+05:30), matching the app's India-focused date behavior; confirm the lab's
operating timezone before a multi-region rollout.

## 7. Operational and privacy notes

- Treat patient and laboratory data as sensitive. Use synthetic data for
  development and staging.
- Keep backups and migration exports access-controlled; test restoration, not
  just export creation.
- Verify Cloudflare plan limits and data-location/retention requirements rather
  than assuming a free plan is sufficient for production workloads.
- Complete privacy and regulatory review applicable to India before launch.
- Do not send patient data to the excluded AI service as part of this backend
  work.
