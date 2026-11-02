import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/docs")({
  head: () => seo("Docs", "How to prepare CSVs and use CostSieve."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="Docs" title="Documentation">
      <Section title="Input files"><p>Choose CSV or XLSX expense/revenue records, PDF invoices, or JPG/PNG invoice photos. Use one invoice per document. Limits: 20 files, 20 MiB per file, 50 MiB combined, 20 pages per PDF and 100,000 ledger records. OCR reads English and Romanian locally.</p></Section>
      <Section title="Ledger columns"><p>Use date, vendor, category, amount, currency and kind. Dates should use YYYY-MM-DD, currencies use three-letter codes, and kind is expense, revenue, expense_refund, revenue_refund or transfer. Amounts must be non-negative; the kind defines their meaning. Optional transactionId helps identify matches. Advanced options map different headers, select a worksheet and specify date/decimal formats.</p><pre tabIndex={0} aria-label="Example CSV record" className="table-scroll record-review text-xs">{'date,vendor,category,amount,currency,kind\n2026-09-01,Example service,software,100,USD,expense'}</pre></Section>
      <Section title="Running an analysis"><p>Select your documents, review extracted fields and correct errors. Confirm each invoice after checking its supplier, date, total and currency. Resolve matching invoice/ledger sources before analysis. Source matches are not counted as savings. Excluded documents and records make coverage partial.</p></Section>
      <Section title="Scenarios and implementation"><p>Choose a review candidate, enter an assumed reduction and any implementation cost, then apply the scenario. Overlapping actions are rejected. Usage-based estimates require your seat counts and contract confirmation. Each candidate includes implementation, verification and rollback steps.</p></Section>
      <Section title="Exports"><p>CSV and JSON download to your device, including the applied scenario. Print / PDF opens your browser’s print dialog. Reset, refresh or close the tab to clear the working analysis; inactive sessions expire after 30 minutes.</p></Section>
      <Section title="Try with your AI"><p>Copy the audit brief or download the complete skill from the Try with your AI page. Your assistant discovers existing approved connectors, researches alternatives through its available tools and asks you directly for missing context. No local report is required. Optional report inclusion shows the exact text before copying/downloading; names are hidden by default, but figures and dates remain sensitive. Cloud AI processing follows your provider’s policy.</p></Section>
      <Section title="Local agent connection"><p>The repository also contains a local MCP server with explicitly allowed folders. Read the <a className="text-accent underline" href="https://github.com/raducanuandrei/Costsieve/blob/feat/document-analysis/docs/mcp.md">MCP setup guide</a> before connecting an agent: summaries returned to that agent follow its provider’s data policy.</p></Section>
    </Page>
  );
}
