# @costsieve/engine

Local business spending analysis for any business with expense/revenue exports. This is a working TypeScript engine and CLI; the website and live integrations are separate future work.

## Run

Requires Node.js 22.18+ (tested on 24.12) and npm. From this directory:

```powershell
npm ci
npm run build
npm run demo
node dist/src/cli.js --demo --json reports/demo.json --csv reports/demo.csv
node dist/src/cli.js --ledger ledger.csv --subscriptions subscriptions.csv
node dist/src/cli.js --ledger ledger.csv --scenario assumptions.json --json reports/analysis.json
```

The engine makes no application network calls. Dependency installation needs network access; later analysis does not. Files are written only with explicit output options; existing outputs are never overwritten. Vendor/category summaries may still be sensitive, so share deliberately.

## Ledger CSV

```csv
date,vendor,category,amount,currency,kind,transaction_id,description
2026-09-01,Workspace,software,100,USD,expense,exp-001,Optional local note
2026-09-15,Sales,sales,3000,USD,revenue,rev-001,Optional local note
2026-09-16,Workspace,software,10,USD,expense_refund,ref-001,Optional local note
```

Required headers: date, vendor, category, amount, currency, kind. Blank category values become Uncategorized. Optional transaction_id and description stay in the local import and are omitted from default reports. Extra columns are ignored.

- Dates: real YYYY-MM-DD dates or timestamps with seconds and explicit Z/±HH:MM offsets. UTC grouping; locale dates, Excel serial dates and timezone-free timestamps are rejected.
- Amounts: nonnegative decimal magnitudes, at most 15 integer and 12 fractional digits. No symbols, grouping, exponents or negative sign. Direction is explicit: expense, revenue, expense_refund, revenue_refund or transfer. Bank sign conventions are not guessed.
- Currency: a three-letter user-supplied label, normalized to uppercase; not checked against a live ISO registry. Separate totals per currency, no FX conversion.
- Transaction IDs preserve leading zeros and must be unique across the file. Later repetitions are excluded for review. For account-scoped IDs, create composite IDs or omit them. Matching payments remain in totals unless source review establishes a duplicate.
- Quoted commas/multiline values work. Evidence uses logical CSV record numbers including the header and blank records; quoted multiline fields count as one record, not multiple physical lines.
- Limits: 20 MiB UTF-8 and 100,000 nonblank data records. Malformed headers/quoting block analysis. Invalid rows carry issues. Continuing with exclusions requires API allowPartial: true or CLI --allow-partial.

Use `--mapping columns.json` for renamed columns, not value conversion:

```json
{ "date": "Date", "vendor": "Payee", "category": "Category", "amount": "Amount", "currency": "Currency", "kind": "Type" }
```

This is canonical/mapped CSV support, not universal accounting/bank export compatibility.

## Analytics and evidence

For each currency: net expenses = gross expenses minus expense refunds; net revenue = gross revenue minus revenue refunds; recorded surplus = net revenue minus net expenses. Transfers are separate. Recorded surplus is not audited profit, cash balance or a tax calculation. Input completeness is not independently verified.

Vendor/category/month breakdowns reconcile to the ledger. Monthly comparisons require explicit `--observation-start YYYY-MM-DD --observation-end YYYY-MM-DD` covering the file. Only adjacent fully covered calendar months are compared; nonpositive baselines give an undefined percentage.

Review candidates include matching date/vendor/amount charges; a vendor representing at least 50% of gross expenses; and rolling three-month patterns with exactly one charge per month, each within 5% of the first in that window. These are documented review rules, not industry benchmarks or proof of waste. Candidates are never counted as achieved savings.

## Optional subscription inventory

```csv
subscription_id,vendor,currency,amount_per_cycle,billing_cycle,seats,active_seats
workspace,Workspace,USD,100,monthly,10,6
annual-tool,Design Tools,USD,480,annual,4,2
unknown,Hosting,USD,350,monthly,,
```

Cycles: monthly/annual. Supply both seat fields or neither. Paid seats must be positive; active seats range from zero to paid seats. Monthly equivalent divides annual cost by 12. Estimated unused-seat cost = monthly equivalent × inactive/paid seats, assuming current usage and uniform per-seat pricing. Estimates use 12 decimal places, half up.

Inventory is not automatically matched to or added to ledger spending. Annual contracts, minimum plans and bundled pricing may prevent immediate savings. Missing usage never becomes assumed waste. Do not add inventory opportunities to overlapping scenario effects.

## Scenarios

Example assumptions.json:

```json
{
  "currency": "USD",
  "changes": [
    { "id": "negotiation", "vendor": "Workspace", "reductionPercent": "20" },
    { "id": "review", "category": "software", "reductionPercent": "10" }
  ],
  "implementationCost": "25"
}
```

Use exact vendor/category labels; combined filters use AND. All expenses requires explicit allExpenses: true instead of filters. Decimal assumptions are strings. Empty changes means zero assumed savings. At most 50 ordered changes.

Apply changes sequentially to remaining selected expenses; round each row to 12 decimals per step, half up. A 20% reduction then 50% on 100 leaves 40, saving 60, not 70. Net benefit subtracts declared one-time implementation cost and can be negative.

Baseline = gross expense charges in the imported period. Refunds, revenue and transfers are excluded; expense refunds are disclosed separately because allocation to individual purchases is unknown. A reduction on an already-refunded purchase is not recoverable cash. No annual forecast, revenue lift, recurring implementation overhead, tax effect or equivalent business outcome is inferred.

## Browser API

Public entry: src/index.ts, compiled to dist/src/index.js. It excludes Node filesystem/process imports. The Node-only CLI is separate. The independent Costsieve repository now also contains document-review adapters and local MCP; use the root README and docs/browser-integration.md. No Lovable application or sync is authorized in that repository.

```typescript
import { importLedgerCsv, analyzeBusiness, simulateScenario, exportSummaryCsv } from '@costsieve/engine';

const ledger = importLedgerCsv(csvText, { vendor: 'Payee' });
// Show import issues and obtain an explicit choice before partial analysis.
const report = analyzeBusiness(ledger);
const scenario = simulateScenario(ledger, {
  currency: 'USD', changes: [{ id: 'review', vendor: 'Workspace', reductionPercent: '10' }]
});
const downloadText = exportSummaryCsv(report, scenario);
```

Pass typed ImportResult values returned by import functions, not fabricated/deserialized row objects. The host UI must clear state on Reset, avoid audit network/storage/analytics, render labels as text, and set dataOrigin: SYNTHETIC_DEMO when supplying the sample fixture. Successful browser bundling alone does not verify real UI privacy, responsiveness or accessibility.

JSON/CSV exports include provenance, coverage, summaries, findings, caveats and optional scenarios. CSV uses dimension/label/currency/metric/value/classification and neutralizes formula-like user labels. Raw descriptions, transaction IDs and records are omitted. No public share links.

## Checks and license

```powershell
npm test
npm run typecheck
npm run check:browser
npm audit --omit=dev
```

New code is MIT-licensed; preserve THIRD_PARTY_NOTICES.md when redistributing runtime dependencies. Package publication is disabled pending project setup. The project is free, with voluntary sponsorship planned on the website.

Not implemented: bank/API connections, provider-specific export presets, invoice OCR, vendor price comparison, sales/customer funnel analysis, automatic revenue forecasts, AI token pricing, Supabase feedback, Lovable screens or hosting.
