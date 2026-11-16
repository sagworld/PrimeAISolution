# Prime AI Lab

A React + TypeScript laboratory-management MVP with a responsive dashboard and work areas for Masters, Patients, Test results, Report generation and Reports.

## Run locally

```sh
npm install
npm run dev
```

Use Node.js 18.18 or newer. `npm run build` performs the TypeScript project check and creates a production build; `npm run lint` runs ESLint.

## Optional local AI explanations

The report viewer can request a plain-language explanation in Marathi, English, or Hindi from a local Ollama model. No patient name, ID, age, or phone number is sent to the model; only test names, entered parameter values, units, and the supplied reference ranges are included. The explanation should compare values only with supplied ranges and must not infer a disease or organ problem from an abnormal result. The AI API binds to `127.0.0.1`; Vite proxies `/api` requests to it.

1. Install Ollama for Windows from [ollama.com](https://ollama.com/).
2. In a terminal, download the free local model: `ollama pull qwen2.5:3b`. The first run downloads several GB and requires enough disk space and memory.
3. Keep Ollama running, then start the app's local AI API in a second terminal: `npm run ai:server`.
4. Start the frontend with `npm run dev` and open a report. Select a language and click **Explain results**.

The model can be changed with `OLLAMA_MODEL` (defaults to `qwen2.5:3b`). The local API port can be changed with `AI_SERVER_PORT` (defaults to `3001`); update the Vite proxy in `vite.config.ts` if you change the API port. The Ollama URL defaults to `http://127.0.0.1:11434`; non-local Ollama URLs are intentionally rejected. The model stays loaded for 30 minutes after use; explanations are kept short to reduce latency. First-time loading can take a few minutes; the API waits up to five minutes before timing out.

## Included workflows

- Maintain lab technician, referral partner, sample collector and test-catalogue records; define multiple named parameters for each new test.
- Register patients and add multiple tests to the lab queue in one operation.
- Enter individual test parameters, track pending/completed orders, and prepare patient reports.
- Generate a report for one test or print all tests for a selected patient. Sample CBC and Peripheral Blood Smear tests include parameter-level examples.
- Review daily, weekly and monthly collections with basic category analysis.
- Optionally generate a local AI explanation of supplied test values in Marathi, English, or Hindi.
- Persist demo workspace state in the browser's local storage.

## Demo and clinical-use limitations

The starter data is fictional. This MVP has no authentication, production database, backups, user access controls, audit logs, or regulatory safeguards. Do not enter real patient information or use it for clinical care.

Local AI explanations are informational and may be incorrect or incomplete. They are not a diagnosis, prognosis, or treatment recommendation; only supplied reference ranges are intended to be discussed. Qualified laboratory and clinical professionals must validate data and approve reports before release. A production deployment requires an appropriately secured backend, privacy and regulatory review, and verified clinical workflows.
