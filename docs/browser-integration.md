# Browser integration contract

Use @costsieve/imports for browser adapters and session lifecycle, and @costsieve/engine for pure validated calculations. The Node-only entry @costsieve/imports/node must never be bundled into the website.

```typescript
import { AnalysisSession, createBrowserExtractor } from '@costsieve/imports';

const session = new AnalysisSession({ extractor: createBrowserExtractor('/costsieve-assets/') });
const controller = new AbortController();
const documents = await Promise.all([...fileInput.files].map(async file => ({
  name: file.name, bytes: new Uint8Array(await file.arrayBuffer())
})));
const draft = await session.prepare(documents, {
  signal: controller.signal,
  onProgress: progress => updateProgress(progress)
});
// Render extracted fields as text/input values, show errors, confirm invoices,
// and resolve proposed source reconciliations before calling complete.
const result = session.complete(draft.id, userDecisions);
const csv = session.report(draft.id, 'csv');
// Download locally via Blob/object URL; revoke it after use.
session.clear(draft.id);
```

The example illustrates integration callbacks, not a standalone runnable app. Store the session in application state, never localStorage/IndexedDB. Keep File objects/bytes only while needed for source review/retry, clear them on Reset, abort pending work and revoke all object URLs. Do not put audit details in routes, query strings, telemetry or console logs. A report route without a live result must prompt for a new analysis/demo.

Build prepares packages/imports/assets. Serve its contents under /costsieve-assets/ on the same origin, preserving worker/WASM/language files and dependency notices. Do not fall back to a CDN. Dynamic PDF.js and OCR code should load only when required. No file upload endpoint is needed. Software/static assets can be cached; document data must not be cached by a service worker.

## User flow

1. Select up to 20 supported documents. Show local-processing notice before selection and clear format/size errors. Allow worksheet, column mapping and locale choices where ambiguous.
2. Show a review table with document/page/row references. Invoice confirmations are required even when OCR appears confident. For corrections, catch new validation/reconciliation errors, read session.review(draft.id) again, and show the updated groups. Re-send intended confirmations/decisions when completing after a failed attempt.
3. Show recorded expenses/revenue/refunds per currency, partial coverage and known limitations. Then display recommendations and at most three initial context questions.
4. Present each recommendation's evidence, period, assumptions and action guide. Select zero actions by default. Reject overlapping alternatives and display declared implementation cost. Never add monthly inventory estimates to historical scenario savings.
5. Offer local CSV/JSON download, report printing in the site layer and Reset. No account gate or donation modal.

The root browser test runs a verification fixture in real Chrome: XLSX, text PDF, actual PNG OCR, invoice confirmation, same engine scenario, CSV export and cleared-state rejection. It observes HTTP requests and rejects nonlocal origins or document payload requests. It uses a 375px viewport, reduced-motion preference and keyboard focus checks. The separate `npm run test:site` test runs the transferred production site itself, including local OCR under its content policy, route navigation, retained corrections/scenario assumptions, positive/negative effects, exports, reset, mobile overflow, keyboard focus, reduced motion and automated accessibility checks. Cloudflare production routing and response headers still require a post-deployment smoke check.

## Accounting and extraction limits

One invoice per PDF/image; split invoice bundles. Detection of multiple identities is conservative and cannot prove that every arbitrary layout was recognized. Always review the original and confirm supplier/date/total/currency/type. Cached Excel formula values are used without executing formulas; missing/error caches need correction or exclusion. Invoice totals are recorded amounts, not independently verified payments or deductible/net-of-tax expenses. Do not silently mix accounting bases or call the displayed recorded result audited profit.
