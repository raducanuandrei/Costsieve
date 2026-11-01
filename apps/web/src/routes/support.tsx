import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/support")({
  head: () => seo("Support", "Voluntary support keeps CostSieve free and maintained."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="Support" title="Sponsor CostSieve">
      <Section title="Always free"><p>Analysis, reports and downloads stay free. There is no paid tier and no account gate.</p></Section>
      <Section title="Why sponsor"><p>Voluntary support funds maintenance of this open-source project.</p></Section>
      <Section title="How to sponsor"><p><span className="rounded-sm border border-dashed border-border px-3 py-2 text-sm">Sponsor link coming soon</span></p></Section>
    </Page>
  );
}
