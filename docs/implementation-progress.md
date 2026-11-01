# Document analysis and local MCP — execution ledger

Approved source: docs/approved-plan.md, supplied by the owner. Additional request: after tool functionality, profit/savings use green, confirmed losses red, possible gains labeled estimated; animate changes with reduced-motion support and non-color indicators.

Repository: raducanuandrei/Costsieve. Branch: feat/document-analysis. Worktree: C:\Users\andre\.codex\worktrees\costsieve-documents. Original source A:\Costsieve remains intact. Native worktree tools are unavailable in this session, so Git's worktree fallback is used outside the primary checkout. No Lovable application or sync is authorized.

Execution method: inline, executing-plans and test-driven-development. One independent review at the end. Do not repeat the completed 0.1 engine build; retain its 30 regression tests.

Task 1: implemented; 35 engine tests pass (30 retained + 5 normalized-identity/action/guide tests). TDD RED verified before new code. New simulator targets source-specific records and rejects overlapping alternatives. Final review remains.
Task 2: implemented; 13 import/extraction/session tests pass, including actual PNG OCR and scanned PDF raster/OCR, not only mocks. Invoices require confirmation, unresolved invoice/payment groups block silent double counting, invalid fields require corrections/exclusions, TTL/reset and cancellation work. TDD RED verified. More adversarial coverage and final review remain.
Task 3: implemented — six tools, explicit approved-root file access, realpath/traversal/symlink checks, bounded file reads, response pagination, stdio-only protocol output. Real SDK subprocess client tests analysis/simulation/export and blocked paths.
Task 4: browser API integration fixture and documentation implemented. Real Chrome tests cover XLSX, text PDF, PNG OCR, confirmation, scenarios, export, reset, a mobile viewport, keyboard focus, reduced-motion preference and observed local-only static GETs. This is not the actual Lovable website. The public UI, its requested animations and production deployment remain explicitly deferred to the manual interface-integration stage.

Pre-flight interfaces: new SourceRef/recordId connects import adapters to engine evidence/actions. Confirmed imports retain the legacy engine's decimal strings and transaction kinds. MCP and browser share the same review/session API; all adapters validate inputs before computation.

Ruling: each file receives a session-local documentId; recordId combines it with its logical record index. Legacy sourceRow remains original and source-qualified evidence is added. Action conflicts reject overlapping targetRecordIds; the existing low-level percentage simulator remains compatible.

Ruling: importing the same purchase from a bank export and an invoice is source reconciliation, never achieved savings. Unknown OCR/money/dates and invoices always require confirmation; no unresolved data is silently included.

Ruling: UI integration uses manually reviewed exports only. No remote pushes, publishing, production domain changes or permission changes are needed to build/test the tool.

Ruling: local OCR uses bundled English/Romanian language assets copied from pinned npm packages, with no CDN or model API. Browser assets must use the same origin. Native PDF.js 6 destroys documents through loadingTask.destroy(); no obsolete API assumptions are retained.

Development fixture dependency ExcelJS was removed after it introduced deprecated transitive dependencies and audit findings. XLSX fixtures are generated from minimal OOXML via the already-required ZIP library. Current dependency audit reported zero vulnerabilities after removal.

Independent review found four material issues: multiple invoices could collapse into one; corrected OCR could bypass source reconciliation; large-ledger question targets exceeded MCP response bounds; scenario periods omitted contributing revenue dates. All were reproduced RED and fixed with regression tests. A residual same-supplier Invoice #/colon/nr. label case was also reproduced RED and fixed. The reviewer verified that all four original blockers are resolved.

Post-review export addition: CSV now includes new recommendation estimates, periods, caveats and source-qualified target IDs; its dedicated regression passed. MCP paginated CSV embeds pagination/detail-limit metadata rather than hiding omitted groups.

Final verification: npm test rebuilt all three packages and passed 60/60 tests; npm run test:browser rebuilt the browser bundle and passed the real Chrome integration test. npm audit reported zero known vulnerabilities across the installed dependency graph. Git diff --check and a focused private-key/token scan found no issues. CI configuration is added, but a hosted GitHub Actions run has not occurred.

Ready deliverables: local document-analysis engine/adapters, real OCR and invoice review/reconciliation, source-specific scenarios, implementation guides, local MCP, browser integration contract, tests and setup documentation. Production Lovable UI integration, requested animations, live sponsor destination, public deployment/domain checks and independent beta users remain outside the completed tool-core phase and are not claimed done.

The implementation is saved as a local feature-branch commit. Original A:\Costsieve sources are preserved. No Lovable source, plugin, app authorization, remote push, public publication, deployment or domain change has been performed.
