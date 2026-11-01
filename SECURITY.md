# Security and privacy boundaries

CostSieve processes documents in the user's browser or a local stdio MCP process. The static website has no document-upload endpoint, user-account database or model API key. Source code protections are not a certification or a guarantee against compromise.

## Implemented controls

- Files: 1–20 per batch, 20 MiB per file and 50 MiB combined. Only CSV, XLSX, PDF, JPG and PNG are supported. CSV decoding is strict UTF-8. CSV/selected worksheet limits are 100,000 records, 256 columns and 65,536 characters per field; financial fields retain their stricter engine validation. NUL-containing CSV is rejected. CSV limit failures return no partial parsed data.
- Workbooks: inspect ZIP metadata before workbook parsing, with 100 MiB declared expanded data and 10,000 entries. Compare local headers with the central directory for entry names/counts, compression and available sizes, without inflating entries. Reject mismatches, unsafe/duplicate entry names, VBA, ActiveX and embedded objects. Streamed ZIP data descriptors remain supported. Export values to CSV/XLSX if a workbook uses these features. No macros or spreadsheet formulas are executed; cached cell values still need review.
- Images/PDF: check complete PNG/IHDR and JPEG frame headers, filename/type agreement and a 20-megapixel source-image cap before OCR. PDF input is parsed as document data rather than rendered through an interactive PDF viewer. Limit PDF files to 20 pages, OCR to 50 pages per batch, raster canvases to approximately 8 megapixels and cancellable page/OCR work to 120 seconds. Existing page confirmation and source reconciliation remain mandatory.
- Output: React renders untrusted labels as text. CSV exports neutralize formula-like text while preserving numeric signs. Raw documents, filenames and transaction IDs do not enter the optional AI snapshot; the exact snapshot must be reviewed before copying/downloading.
- Browser headers: same-origin CSP for scripts/workers/network, no embedded objects or framing, no MIME sniffing, no referrer, same-origin opener/resource policies and HSTS for 30 days. HSTS excludes subdomain/preload expansion. Same-origin WebAssembly and inline styles are retained for local OCR and the existing interface. Header presence in source must be verified on the actual HTTPS deployment.
- MCP: source-file reads are read-only and confined to explicit allowed roots using realpath checks. The connected-ledger bridge accepts at most 2 MiB UTF-8 CSV; it does not authenticate to accounts or widen filesystem access. Summaries shared with the host AI follow that provider's policies.
- Dependencies: CI builds/tests the application, exercises real browser/OCR workflows and audits the complete dependency graph. Weekly Dependabot configuration proposes npm/Actions updates for review once present on the default branch. Updates are not merged automatically.

## Limits and operating responsibilities

Input bounds reduce resource abuse and parser exposure. They do not make document parsing a process sandbox or antivirus service. ZIP metadata preflight does not prove that every archive stream is valid, and worksheet bounds apply after the workbook library parses cells. Dependencies and browsers must stay patched. A compromised site build or browser environment can still expose data processed in that environment.

The audit skill treats retrieved documents as untrusted data and requests read-only tools and separate authorization for business changes. These instructions do not enforce another AI host's permissions or eliminate prompt injection. Restrict connector access in that host, inspect evidence and approve consequential actions there.

The public site should serve over healthy HTTPS, keep GitHub/Cloudflare administrative access protected, and verify domain routing, response headers and account-level security rules. See [Cloudflare release checks and prepared scan-path rule](docs/cloudflare.md). Do not collect raw financial documents in analytics, public issues or logs. Business-data downloads, printouts, clipboard contents and user submission to another AI provider remain outside the in-memory session.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting if it is enabled for this repository. A dedicated private reporting channel has not yet been verified/configured. If none is available, open a public issue requesting private contact without exploit secrets, customer documents, account identifiers or credentials. Use synthetic records and include the affected version, reproducible steps and expected/observed behavior. No security response SLA, penetration-test certification or bug bounty is claimed.

References: [OWASP file handling](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [OWASP AI prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html), [Cloudflare response headers](https://developers.cloudflare.com/pages/configuration/headers/).
