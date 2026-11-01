import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/changelog")({
  head: () => seo("Changelog", "Release notes for CostSieve."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="Changelog" title="Changelog">
      <Section title="0.2.0 | November 2026"><p>Local CSV, Excel, PDF and image imports; invoice confirmation; source reconciliation; spending breakdowns; usage questions; scenarios with implementation costs; action guides; CSV, JSON and print exports; local MCP tools. The original Lovable visual design now connects to the CostSieve engine.</p></Section>
    </Page>
  );
}
