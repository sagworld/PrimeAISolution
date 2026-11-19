# Prime AI Lab

A React + TypeScript laboratory-management MVP with a responsive dashboard and work areas for Masters, Patients, Test results, Report generation and Reports.

## Run locally

```sh
npm install
npm run dev
```

Use Node.js 18.18 or newer. `npm run build` performs the TypeScript project check and creates a production build; `npm run lint` runs ESLint.

## Optional cloud AI explanations

The report viewer can request a parameter-by-parameter explanation in Marathi, English, or Hindi from Gemini or Groq. It compares each result with the supplied reference range, explains what the measurement generally represents, and may mention pattern-supported possible contributors to low or high values as general information—not as a cause or diagnosis for the patient. For low hemoglobin, it considers related CBC indices when supplied (such as MCV/MCH) and the patient's age as context; it must not claim a pattern that the values do not support. It also summarizes the overall pattern and suggests safe follow-up questions for a clinician, not treatment. Gemini offers a limited free tier; Groq availability, model pricing, and quotas depend on the account and selected model, so check the provider's current terms before use. On Gemini's free tier, submitted content may be used to improve Google's products. Test names, parameter values, units, supplied reference ranges, and patient age are sent to the selected provider; patient names, IDs, gender, and phone numbers are not sent. Use fictional data unless you have approval to send laboratory data to that provider.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) or [Groq Console](https://console.groq.com/keys).
2. Copy `.env.example` to `.env`, set `AI_PROVIDER` to `gemini` or `groq`, and add the matching API key. Keep `.env` private; it is excluded from Git.
3. Start the local API with `npm run ai:server` and the frontend with `npm run dev`.
4. Open a report, select a language, and click **Explain results**.

Gemini is the default provider (`gemini-3.5-flash-lite`); Groq defaults to `openai/gpt-oss-20b`. Set `GEMINI_MODEL` or `GROQ_MODEL` to use another model available to your account. The API key stays on the server and is never sent to the browser. The AI API binds to `127.0.0.1`; Vite proxies `/api` requests to it. The API waits up to one minute for a provider response.

## Included workflows

- Maintain lab technician, referral partner, sample collector and test-catalogue records; define multiple named parameters for each new test. Add tests by Preoperative or ANC profile, with multiple tests selectable from the chosen profile; existing unprofiled tests remain available under Other tests.
- Register patients and add multiple tests to the lab queue in one operation.
- Enter individual test parameters, track pending/completed orders, and prepare patient reports.
- Generate a report for one test or print all tests for a selected patient. Sample CBC and Peripheral Blood Smear tests include parameter-level examples.
- Review daily, weekly and monthly collections with basic category analysis.
- Open the Administration area to sign in and switch between the horizontal Attendance and Revenue tabs. Attendance supports a date range, a separate attendance date picker, P/A/L status buttons saved with the Save attendance button, technician-wise summaries and editable date-grouped history for all saved records. Revenue groups Doctor/referrer, Lab technicians and Sample collectors into tabs, with daily, weekly and monthly filters for the selected category; a custom date range is also available. The demo login is `head` / `lab123`; the browser-only login is not real access control.
- Review estimated revenue by selected day, week or month, including daily totals and doctor/referrer, technician and sample-collector breakdowns. Figures use current test-catalogue prices and are not payment or profit records.
- Optionally generate a cloud AI explanation of supplied test values in Marathi, English, or Hindi.
- Persist demo workspace state in the browser's local storage.

## Demo and clinical-use limitations

The starter data is fictional. This MVP has no authentication, production database, backups, user access controls, audit logs, or regulatory safeguards. Do not enter real patient information or use it for clinical care.

Cloud AI explanations are informational and may be incorrect or incomplete. Possible contributors are general educational information and do not identify the cause for a particular patient. The AI must not diagnose, prescribe medicines, or recommend changing treatment. It may suggest discussing results with a clinician, sharing relevant context, and repeating or adding tests only when advised by a clinician. Qualified laboratory and clinical professionals must validate data and approve reports before release. A production deployment requires an appropriately secured backend, privacy and regulatory review, and verified clinical workflows.
