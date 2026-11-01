# CostSieve

Free, open-source business cost analysis by NovAPR Technologies. Process documents locally, review the extracted data, understand recorded expenses, and compare explicit changes without inventing achieved savings.

## What works

- Local CSV and Excel .xlsx imports with column/worksheet/decimal/date choices.
- PDF invoices, scanned PDF pages, JPG/PNG invoices, with local English/Romanian OCR.
- Mandatory invoice confirmation, correction/exclusion of invalid data, and invoice/payment reconciliation review.
- Separate-currency spending summaries, source-qualified evidence, at most three initial context questions, seat-usage recommendations and implementation guides.
- Exact-record cost scenarios that reject overlapping alternatives, disclose their period and subtract declared implementation cost.
- Safe summary exports, session reset/30-minute inactivity expiry, browser-compatible API and seven local MCP tools, including an approved connected-ledger bridge.
- Try with your AI: complete portable audit skill, existing-connector discovery, autonomous public research and direct missing-context questions. Optional report sharing has a preview, hidden names by default and explicit confirmation.

## Install and check

Node.js 22.18+ is required. From the repository root:

```powershell
npm ci
npm run build
npm test
npm run test:browser
npm run test:site
```

Build prepares the OCR/PDF worker, WASM and language files from pinned installed dependencies. Dependency installation downloads software/assets, not document data. The engine makes no paid model API calls. Browser integration must serve the generated assets on its own origin.

On a clean Linux CI machine run `npx playwright install --with-deps chromium` before browser tests. Local browser tests use installed Chrome; CI uses Playwright Chromium.

## Use from an AI agent

Open `/your-ai` in the website to copy the complete audit workflow or download the installable `costsieve-audit` skill. No business report is required: the assistant starts with its existing approved connectors. An optional report snapshot excludes raw documents/identifiers and uses one currency. The website does not authenticate to a model provider or carry out the assistant's research. [Skill, setup and privacy details](docs/your-ai.md).

Launch the local stdio server directly with Node, specifying the directory it may read:

```powershell
node packages/mcp/dist/src/cli.js --allow-root "C:\Users\YourName\Invoices"
```

Configure these command/arguments in a client that supports local stdio MCP. Do not use a build command or noisy npm wrapper as the server command: stdout is reserved for the protocol. [Connection instructions](docs/mcp.md) describe the tools, review flow and privacy boundary. An actual SDK stdio client is tested; installation in every named AI product is not claimed.

**Local analysis does not imply a local AI model.** Your AI application may send returned fields/summaries to its provider. Raw OCR text is never returned by the MCP tools. The server has no remote URL, payment/cancellation tools or permission to widen its approved directories.

## Use in a browser

Run `npm run build`, then `npm run preview` to open the working site. `apps/web` preserves the supplied Lovable appearance and connects directly to the local analysis engine. The [browser integration guide](docs/browser-integration.md) documents the shared API. [Cloudflare instructions](docs/cloudflare.md) describe deployment of the static production build.

The canonical repository is raducanuandrei/Costsieve. The visual source was transferred manually from the separately owned motion-layer-mosaic repository. No Lovable GitHub App, Git sync, Lovable build plugin or automatic Lovable commits are required here. No production deployment or domain change is part of this implementation.

## Boundaries

One invoice per PDF/image file. Detected multiple invoice identities require splitting; extraction is heuristic, so review the original and confirm all fields. Legacy .xls/.xlsm and password-protected PDFs require conversion. This is not universal bank/accounting export support, tax software, invoice OCR with guaranteed accuracy, or a profit forecast.

Recorded result is derived from supplied revenue/expenses, not audited profit. Expenses alone cannot establish a business's profit or prove waste. Scenarios keep currencies/periods explicit and do not count source reconciliation as savings. Guides propose actions; the tool never changes a contract or moves money.

The project is MIT-licensed and free to use. The support page is present; its payment destination remains explicitly unconfigured. [Implementation guides](docs/action-guides.md) explain how to investigate and implement a recommended change. No deployed website is claimed.
