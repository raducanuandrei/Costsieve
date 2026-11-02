# Try with your AI

The `/your-ai` page supplies a complete, provider-neutral audit workflow. It is not a model login or a cloud inference service. The user can start with their assistant's existing approved connectors without uploading a ledger to CostSieve or exporting records manually.

## Use

1. Open Try with your AI from the homepage or report. Copy the brief into the chosen assistant, or download the complete skill archive and install its `costsieve-audit` folder in the client's supported skills directory. The archive includes SKILL.md, optional client UI metadata, MCP reference and the project license. It contains no business report or credentials. No global client configuration is modified by this website.
2. Ask the assistant to audit the business. It discovers the tools actually available in that host, establishes company/period where ambiguous and reads relevant approved accounting, files, usage and analytics sources. Capability discovery and scoped source reads come before requests for manual exports.
3. The assistant researches current first-party pricing/terms and comparable capabilities with its own available search tools. Missing essential facts produce direct questions to the user. Unavailable tools, unverified claims and incomplete data remain explicit gaps.
4. If CostSieve MCP is connected, its new `prepare_connected_analysis` tool accepts a bounded canonical CSV representation of already approved connected ledger data, followed by the normal validation/review/calculation flow. Original source locators remain in the assistant's evidence ledger. No new account connector or arbitrary filesystem access is created. See [MCP setup](mcp.md).

The skill distinguishes cash costs, hours/capacity, same-budget service improvement and revenue hypotheses. It preserves contract commitments, comparable periods/currencies/taxes and switching costs. Every proposed action needs evidence, prerequisites, an owner, verification and rollback. An AI agent does not execute purchases, cancellations, emails or other business changes merely because this skill was invoked.

## Optional browser report

Business data is excluded from the brief by default. With an active local report the user can include one currency, optionally reveal vendor/customer/category names, and preview the complete text. Copy/download of a report requires confirmation bound to that exact brief. Changes to inclusion/names/currency invalidate confirmation. Pending scenario edits block report transfer; use the instructions alone or apply the changes in Report.

The shared snapshot uses an explicit allowlist: full selected-currency totals, report period/basis, origin, coverage counts, at most ten vendor/category groups and opportunities, five source locators per opportunity and the same-currency applied scenario. Omission counts are disclosed; omitted details are not zero. Original documents, filenames, source IDs, sheet names, transaction IDs and raw descriptions are excluded. Hiding labels is not anonymity: amounts and dates remain sensitive. The report date range covers the supplied report across currencies; an applied scenario carries its own selected-currency period.

The site does not send the brief to an AI. The user's clipboard/download and any subsequent provider submission are separate from the in-memory analysis. The host's connectors may return private information to its AI provider under its policies and permissions. A local calculation server does not make a cloud model local. Fully local operation requires a local model and compatible local tools.

## Validation scope

The engine snapshot, package contents, local MCP bridge and website controls have automated tests. Fictional agent evaluations exercise existing-tool discovery, contract minimums, duplicate-source handling, unmatched refunds, annual versus monthly basis, missing ISO currency, unavailable web access and missing revenue. These evaluations are not live integrations with every AI client or accounting provider, legal accuracy certification, or evidence of achieved business savings. No model or paid API is required by the website; providers and connectors have their own usage limits and costs.

The skill is original CostSieve material under the repository's MIT license. It does not contain or claim to be Deloitte's software or an official Anthropic/OpenAI legal skill.
