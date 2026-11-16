# Prime AI Lab

A React + TypeScript laboratory-management MVP with a responsive dashboard and work areas for Masters, Patients, Test results, Report generation and Reports.

## Run locally

```sh
npm install
npm run dev
```

Use Node.js 18.18 or newer. `npm run build` performs the TypeScript project check and creates a production build; `npm run lint` runs ESLint.

## Optional cloud AI explanations

The report viewer can request a plain-language explanation in Marathi, English, or Hindi from Gemini or Groq. Gemini offers a limited free tier; Groq availability, model pricing, and quotas depend on the account and selected model, so check the provider's current terms before use. On Gemini's free tier, submitted content may be used to improve Google's products. Test names, parameter values, units, and supplied reference ranges are sent to the selected provider; patient names, IDs, ages, and phone numbers are not sent. Use fictional data unless you have approval to send laboratory data to that provider. The explanation should compare values only with supplied ranges and must not infer a disease or organ problem from an out-of-range result.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) or [Groq Console](https://console.groq.com/keys).
2. Copy `.env.example` to `.env`, set `AI_PROVIDER` to `gemini` or `groq`, and add the matching API key. Keep `.env` private; it is excluded from Git.
3. Start the local API with `npm run ai:server` and the frontend with `npm run dev`.
4. Open a report, select a language, and click **Explain results**.

Gemini is the default provider (`gemini-3.5-flash-lite`); Groq defaults to `openai/gpt-oss-20b`. Set `GEMINI_MODEL` or `GROQ_MODEL` to use another model available to your account. The API key stays on the server and is never sent to the browser. The AI API binds to `127.0.0.1`; Vite proxies `/api` requests to it. The API waits up to one minute for a provider response.

## Included workflows

- Maintain lab technician, referral partner, sample collector and test-catalogue records; define multiple named parameters for each new test.
- Register patients and add multiple tests to the lab queue in one operation.
- Enter individual test parameters, track pending/completed orders, and prepare patient reports.
- Generate a report for one test or print all tests for a selected patient. Sample CBC and Peripheral Blood Smear tests include parameter-level examples.
- Review daily, weekly and monthly collections with basic category analysis.
- Optionally generate a cloud AI explanation of supplied test values in Marathi, English, or Hindi.
- Persist demo workspace state in the browser's local storage.

## Demo and clinical-use limitations

The starter data is fictional. This MVP has no authentication, production database, backups, user access controls, audit logs, or regulatory safeguards. Do not enter real patient information or use it for clinical care.

Cloud AI explanations are informational and may be incorrect or incomplete. They are not a diagnosis, prognosis, or treatment recommendation; only supplied reference ranges are intended to be discussed. Qualified laboratory and clinical professionals must validate data and approve reports before release. A production deployment requires an appropriately secured backend, privacy and regulatory review, and verified clinical workflows.
