import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => seo("About", "CostSieve is built by NovAPR Technologies."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="About" title="About CostSieve">
      <Section title="The project"><p>CostSieve is a free, open-source, privacy-first cost auditor for founders, small businesses and anyone running a business. It is built by NovAPR Technologies.</p></Section>
      <Section title="Source"><p>Read the code, report a problem or contribute on <a className="text-accent underline" href="https://github.com/raducanuandrei/Costsieve">GitHub</a>. CostSieve is licensed under MIT.</p></Section>
    </Page>
  );
}
