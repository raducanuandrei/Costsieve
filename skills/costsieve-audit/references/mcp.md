# CostSieve local calculation tools

Use only tools present in the host's discovered catalog and inspect their current input schemas. These are calculation/review tools, not new accounting connectors. The AI host's existing connectors provide approved source data. If CostSieve is absent, use a reliable available calculation tool and disclose the limitation; do not make the user install a server before doing independent research.

## Connector-ledger bridge

`prepare_connected_analysis({ csv, sourceLabel })` accepts a canonical CSV representation of approved connected ledger rows, at most 2 MiB UTF-8. The host may serialize connector-returned rows with a proper CSV writer. Fields: `date,vendor,category,amount,currency,kind,transaction_id` (last field optional). Dates: YYYY-MM-DD. Amounts: exact nonnegative decimal strings; currency: explicit three-letter code. Directions: expense, revenue, expense_refund, revenue_refund, transfer. Do not convert refunds into revenue or infer sign meaning without the source's definition.

Use a source label describing the approved connector/query and period without credentials. Retain original record/cell/document locators in your evidence ledger: returned CSV row references are a temporary representation of that source, not independent invoices. Do not add invoice records already represented by accounting transactions. Do not pass raw contract text, bank credentials, API keys or an entire account export outside the audit scope. Narrow an oversized source query or disclose batch coverage; replacing the session with the next batch does not combine totals.

## Review and calculations

- `prepare_analysis({paths,fileOptions?})`: optional alternative for files in explicitly approved local folders. Do not request exports when connectors already supply the needed data. One invoice per PDF/image; invoices require original-field confirmation. Paths cannot widen startup access.
- `prepare_analysis({draftId,offset,limit})`: inspect subsequent review records. The initial page is not the full population. Examine reported issues and reconciliation groups; do not confirm unseen invoice fields.
- `complete_analysis({draftId,decision})`: validate and calculate. Decisions include corrections, exclusions, confirmed invoice IDs, source reconciliation or confirmed separate purchases, and factual usage answers. Exclusions must remain visible as partial coverage. Confirm contract permission and uniform pricing before a seat-reduction estimate.
- `get_report({draftId,format,offset?,limit?})`: return the report and latest applied scenario. Page through details using nextOffset; preview truncation is not zero cost. Totals for displayed currencies cover all confirmed records in that session.
- `simulate_changes({draftId,currency,selections,implementationCost?})`: hypothetical effects for the imported period; selections use actual returned recommendation IDs with an explicit reductionPercent or replacementCost unless the recommendation has a supported action. Targets cannot overlap. Same vendor does not mean same expense or service. Revenue stays unchanged.
- `get_action_guide({draftId,recommendationId})`: implementation, verification and rollback guidance; supplement with the business's actual terms and operational constraints.
- `clear_analysis({draftId})`: clear the working session; original files are not deleted.

The server has one active analysis, 30-minute inactivity expiry, bounded responses and no account mutation tools. Do not assume a browser report and a separately started MCP server share the same session or IDs. A website handoff contains aliases and previews, not executable recommendation IDs. Existing source connectors and the AI provider retain their own access, data and usage policies.
