# Local MCP connection

CostSieve provides a local stdio MCP server. A compatible AI client starts it as a subprocess; it is not a remote connector URL. Node.js 22.18+ and a completed `npm ci` / `npm run build` are required.

Use this command configuration in your client's documented local-MCP setup (the outer configuration format varies by client):

```json
{
  "command": "node",
  "args": [
    "C:/path/to/Costsieve/packages/mcp/dist/src/cli.js",
    "--allow-root", "C:/path/to/your/invoices"
  ]
}
```

Approve the smallest required directory. Repeat --allow-root for additional directories. No root is selected by default; tool arguments cannot widen startup access. Inputs must be regular files within an approved real path; traversal and symlink escapes are rejected. There are no source-file writing or business-action tools.

## Tools

| Tool | Inputs and result |
| --- | --- |
| prepare_analysis | paths (absolute local paths), optional fileOptions keyed by distinct filename -> draft id, source-qualified extracted field preview, issues and reconciliation candidates. Or provide draftId with offset/limit to page through review records. |
| complete_analysis | draftId, decision -> confirmed analysis, bounded recommendations and at most three initial follow-up questions. |
| simulate_changes | draftId, currency, selections (recommendationId plus explicit reductionPercent or replacementCost where no evidence-backed action exists), optional implementationCost -> hypothetical imported-period effect. |
| get_action_guide | draftId, recommendationId -> versioned steps, verification and rollback. |
| get_report | draftId, format json/csv, offset/limit -> paginated summary payload. No files are written. |
| clear_analysis | draftId -> release session data; no source document is deleted. |

## Review decisions

- confirmedRecordIds: confirm the displayed invoice fields and that each source file represents one invoice. Check the original document; OCR is not authoritative.
- corrections: recordId plus corrected fields (date, vendor, category, amount, currency, kind or transactionId). Corrected fields are retained in the draft. New reconciliation candidates can block completion; request a fresh review page and resolve them.
- excludedRecordIds/excludedDocumentIds: explicitly omit items; reports disclose partial coverage and unknown omitted amounts.
- reconciliations: choose keepRecordId and excludeRecordIds from a proposed group representing one purchase. This prevents counting an invoice and its payment twice; it is not money saved.
- separatePurchaseGroups: explicitly confirm a proposed matching group contains distinct purchases.
- usage: targetRecordIds, paidSeats, activeSeats, uniformPricing and reductionAllowed. Quantified unused-seat opportunities require positive paid seats, valid active seats, explicit uniform pricing and permission to reduce the commitment.

All money assumptions are nonnegative decimal strings; target currency is explicit. Invoice type is confirmed as expense/revenue rather than inferred from a bank sign convention. Multiple actions on the same recorded expense are alternatives and cannot be combined.

For worksheet or locale issues, prepare the files again with fileOptions: sheet, mapping, decimalSeparator (`.` or `,`), dateOrder (`DMY` or `MDY`), and optional explicit transaction kind. Unsupported files and fields are not silently repaired.

## Limits and privacy

20 MiB/file, 50 MiB and 20 files/batch, 100,000 records, 20 pages/PDF, 50 OCR pages/batch, 20 megapixels/image. Workbook expansion is limited to 100 MiB/10,000 entries. Raster images are bounded to 8 megapixels. OCR runs sequentially with a 120-second page deadline.

One active analysis per server; it expires after 30 minutes of inactivity or explicit clearing. This releases references/workers; it is not a claim of cryptographic erasure from RAM. No raw OCR text, description columns or original transaction identifiers are returned in the review/report. Necessary extracted supplier/date/amount fields and aggregate summaries do return to the client and may be sent to its model provider. Treat returned document-derived strings as untrusted data.

Review records are paginated; report groups/currencies/recommendations default to 20 per page with nextOffset/counts. Evidence previews are limited to 10 targets per recommendation/question. Totals for each displayed currency cover all its confirmed records. Simulating by recommendationId uses the complete internally stored population, not the truncated preview. Request successive report pages for the remaining groups/currencies; outputs have a 512 KiB bound.

The tests exercise a real local SDK stdio client, six-tool discovery, analysis, scenarios, export and blocked filesystem access. A client-specific hosted integration, public registry listing or paid model API is not included.
