import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/methodology")({
  head: () => seo("Methodology", "How CostSieve calculates and what it never claims."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="Methodology" title="How the numbers work">
      <Section title="Currencies"><p>Each currency is summarized separately. Unlike currencies are never added together.</p></Section>
      <Section title="Recorded surplus"><p>Revenue minus expenses as recorded in your file. It is not audited profit.</p></Section>
      <Section title="Review candidates"><p>Items flagged with evidence, such as suspected duplicates. A flag is something to check, not recovered cash.</p></Section>
      <Section title="Seat usage"><p>For an eligible recurring service, an unused-seat estimate uses the recorded charges and your confirmed paid/active seat counts. It requires uniform seat pricing and a contract that permits reducing seats. Unknown usage produces no quantified saving.</p></Section>
      <Section title="Scenarios"><p>Hypothetical reductions apply to selected recorded expenses for the imported period. Net benefit subtracts your one-time implementation cost. Revenue stays unchanged; a projected recorded result appears only if revenue was supplied. Actions targeting the same expense cannot be added together. No automatic monthly or annual extrapolation is made.</p></Section>
      <Section title="Document review"><p>OCR can misread invoices. Confirm extracted fields against the original. Matching bank and invoice records must be reconciled or explicitly identified as separate purchases. Incomplete sources, taxes and omitted costs can change the outcome.</p></Section>
    </Page>
  );
}
