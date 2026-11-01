import { createFileRoute } from "@tanstack/react-router";
import { Page, Section } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => seo("Privacy", "Your business data stays in your browser."),
  component: View,
});

function View() {
  return (
    <Page eyebrow="Privacy" title="Privacy">
      <Section title="In-browser only"><p>Files are read into browser memory. No upload endpoint, no automatic saving, no audit data in URLs or analytics.</p></Section>
      <Section title="No accounts or connections"><p>No sign-up, bank connection or model API key is required. OCR runs locally. Fonts, OCR models, workers and video are served from this site. Your browser downloads these assets; document contents are not included in those requests.</p></Section>
      <Section title="Clearing data"><p>Reset, refresh or close the tab to clear the working analysis. Sessions expire after 30 minutes of inactivity. Downloads and printed reports remain on your device until you delete them. The hosting service may process ordinary request metadata such as your IP address.</p></Section>
    </Page>
  );
}
