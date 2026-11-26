import { createFileRoute } from "@tanstack/react-router";
import { btn, Page, Section } from "@/components/site/layout";
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
      <Section title="How to sponsor">
        <a
          className={btn.outline}
          href="https://www.paypal.me/ARaducanu920"
          target="_blank"
          rel="noopener noreferrer"
        >
          Donate with PayPal
        </a>
      </Section>
    </Page>
  );
}
