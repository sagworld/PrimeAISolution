# Prime AI Lab

A React + TypeScript laboratory-management MVP with a responsive dashboard and work areas for Masters, Patients, Test results, Report generation and Reports.

## Run locally

```sh
npm install
npm run dev
```

Use Node.js 18.18 or newer. `npm run build` performs the TypeScript project check and creates a production build; `npm run lint` runs ESLint.

## Cloudflare Worker backend (in development)

Worker tooling requires Node.js 22.12 or newer. For a production-like local
check, build the frontend and run it with the Worker; during hot-reload
development, run Vite separately.

```sh
npm run db:migrate:local
npm run worker:typecheck
npm run build
npm run worker:dev
```

The local Worker listens on `http://127.0.0.1:8787` and uses a local D1
database and Wrangler's local R2 emulator. It serves the `dist` build, uses an
SPA fallback for client routes, and sends `/api/*` requests to the Worker
instead of the static fallback. The first migration creates the relational
schema without demo patients or orders. Demo browser data will not be migrated.
The frontend uses the authenticated Worker for patient, master, order, result,
attendance, billing, inventory, and lab profile workflows. Uploaded lab logos,
signatures, and payment QR images use authenticated private R2 routes. Do not run
`npm run worker:deploy` until the private R2 bucket exists, authentication
secrets are configured, and the environment and deployment settings have been
reviewed. The current Cloudflare account has the `prime-ai-lab` D1 database and
private `prime-ai-lab-private-assets` R2 bucket provisioned, and the initial
production schema has been applied without importing demo records. The Worker
is configured for `diagnova.primesolutions.app`; add `primesolutions.app` as an
active Cloudflare zone and update the domain registrar's nameservers before
deployment. Cloudflare will create the custom-domain DNS record and issue TLS
when the Worker is deployed. The public `workers.dev` hostname is disabled.
After the zone is active, create a local, git-ignored `.env.production` file
containing strong random `AUTH_HMAC_SECRET` and `BOOTSTRAP_TOKEN` values, then
build and deploy with `npx wrangler deploy --secrets-file .env.production`.
Never commit or share that file.
For another account, enable R2 in its dashboard before creating the bucket with
`npx wrangler r2 bucket create prime-ai-lab-private-assets`.

### Authentication setup

Sign-in uses provisioned usernames and passwords; public signup is disabled.
Passwords must be at least 12 characters and are stored as salted PBKDF2-HMAC
SHA-256 hashes, never as plaintext. Successful sign-in creates a server-side
session with an opaque token in a Secure, HttpOnly, SameSite cookie. Mutating
requests also require a CSRF token. Session and CSRF cookies use the `__Host-`
prefix and omit `Domain`, so they are sent only to the app host
(`diagnova.primesolutions.app`), not the root domain or other client subdomains.

For local development, copy `.dev.vars.example` to `.dev.vars` and set
development-only values. `.dev.vars` is git-ignored. Configure the authentication
HMAC secret and one-time owner bootstrap token as Cloudflare secrets in the
appropriate deployment environment. Both must be at least 32 characters. For
the first deployment, Wrangler can upload them as encrypted Worker secrets
from the git-ignored `.env.production` file described above. Bootstrap the
first owner using
`POST /api/auth/bootstrap` with the bootstrap token and the owner's username and
password. After bootstrapping, remove the token from that environment. Owners
can then provision or disable staff accounts through the authenticated API.
The Worker binds the private R2 bucket `prime-ai-lab-private-assets`; create
that bucket in the production Cloudflare account before deployment. Local
development uses Wrangler's local R2 emulator. Asset objects are not served
through public bucket URLs.
The Worker uses PBKDF2-HMAC-SHA-256 with 100,000 iterations, the maximum
supported by Cloudflare Workers Web Crypto. Require strong, unique passwords
and review Cloudflare's current CPU limits before production use.
For hot-reload development, apply migrations, start the Worker, then start Vite
with `npm run dev`. Vite proxies Worker API routes to port 8787. Optional AI
routes still use the separate local Node server and are intentionally
unavailable in the Cloudflare production deployment for now.

## Optional cloud AI explanations

The report viewer can request a parameter-by-parameter explanation in Marathi, English, or Hindi from Gemini or Groq. It compares each result with the supplied reference range, explains what the measurement generally represents, and may mention pattern-supported possible contributors to low or high values as general information—not as a cause or diagnosis for the patient. For low hemoglobin, it considers related CBC indices when supplied (such as MCV/MCH) and the patient's age as context; it must not claim a pattern that the values do not support. It also summarizes the overall pattern and suggests safe follow-up questions for a clinician, not treatment. Gemini offers a limited free tier; Groq availability, model pricing, and quotas depend on the account and selected model, so check the provider's current terms before use. On Gemini's free tier, submitted content may be used to improve Google's products. Test names, parameter values, units, supplied reference ranges, and patient age are sent to the selected provider; patient names, IDs, gender, and phone numbers are not sent. Use fictional data unless you have approval to send laboratory data to that provider.

The AI API currently runs as a separate local Node server and is intentionally
not included in the Cloudflare Worker deployment. AI explanations are therefore
unavailable in production until the route and provider secrets are configured
for production.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) or [Groq Console](https://console.groq.com/keys).
2. Copy `.env.example` to `.env`, set `AI_PROVIDER` to `gemini` or `groq`, and add the matching API key. Keep `.env` private; it is excluded from Git.
3. Start the local API with `npm run ai:server` and the frontend with `npm run dev`.
4. Open a report, select a language, and click **Explain results**.

Gemini is the default provider (`gemini-3.5-flash-lite`); Groq defaults to `openai/gpt-oss-20b`. Set `GEMINI_MODEL` or `GROQ_MODEL` to use another model available to your account. The API key stays on the server and is never sent to the browser. The AI API binds to `127.0.0.1`; Vite proxies `/api` requests to it. The API waits up to one minute for a provider response.

## Included workflows

- Maintain lab technician, referral partner, sample collector and test-catalogue records; define multiple named parameters for each new test. Add tests by Preoperative or ANC profile, with multiple tests selectable from the chosen profile; existing unprofiled tests remain available under Other tests.
- Register patients and add multiple tests to the lab queue in one operation.
- Sample collectors can register patients assigned to their account and track order status; test results remain restricted to lab staff.
- Enter individual test parameters, track pending/completed orders, and prepare patient reports.
- Generate a report for one test or print all tests for a selected patient. Configure result parameters for each test in the catalogue.
- Review daily, weekly and monthly collections with basic category analysis.
- Sign in with an owner-provisioned username and password. Owners can open Administration and switch between Attendance and Revenue; server-side authorization remains authoritative.
- Review estimated revenue by selected day, week or month, including daily totals and doctor/referrer, technician and sample-collector breakdowns. Figures use current test-catalogue prices and are not payment or profit records.
- Create and print patient invoices, track paid/unpaid totals, update payment methods, send invoice details through WhatsApp, use a payment QR on printed invoices, and export invoices as Tally XML. Invoice records are stored in D1 and the QR image is stored in private R2. This is not a payment processor or accounting integration.
- Manage inventory items, stock imports, stock balances, and import-bill payments, including partial payments. Inventory and bill records are stored in D1; completed test results deduct configured reagents on the server.
- Configure lab name, address, owner details, logo, and signature for printed reports. Profile text is stored in D1, while logo, signature, and payment QR images are stored in private R2; owners manage settings and authenticated lab staff can read the assets.
- Optionally generate a cloud AI explanation of supplied test values in Marathi, English, or Hindi.
- Appearance and language preferences remain local to each device. Report PDFs are generated in the browser and are not stored.

## Demo and clinical-use limitations

The main lab store starts empty and is loaded from D1 after sign-in; existing demo localStorage records are intentionally ignored. Billing, inventory, and lab profile records are stored in D1, with uploaded images in private R2. Do not enter real patient information or use this application for clinical care until all workflows, security, privacy, regulatory, backup, and clinical validation requirements are complete.

Cloud AI explanations are informational and may be incorrect or incomplete. Possible contributors are general educational information and do not identify the cause for a particular patient. The AI must not diagnose, prescribe medicines, or recommend changing treatment. It may suggest discussing results with a clinician, sharing relevant context, and repeating or adding tests only when advised by a clinician. Qualified laboratory and clinical professionals must validate data and approve reports before release. A production deployment requires an appropriately secured backend, privacy and regulatory review, and verified clinical workflows.
