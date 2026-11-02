import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, FileSearch, SlidersHorizontal, Download } from "lucide-react";
import hero from "@/assets/hero-sieve.jpg";
import { MotionBackdrop } from "@/components/site/motion-backdrop";
import { btn } from "@/components/site/layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Free, private business cost auditor", "Analyze business spending in your browser. Free, open-source, no account, no uploads."),
  component: Home,
});

const steps = ["Select CSV, Excel, PDF or invoice images", "Review extracted fields and confirm invoices", "Resolve matching source records", "Read the report and test changes", "Export your plan locally"];
const features = [
  {
    icon: BarChart3,
    title: "Spending analytics",
    desc: "Vendor, category and month breakdowns, kept separate per currency. Totals come from your reviewed records.",
    wide: true,
  },
  {
    icon: FileSearch,
    title: "Review candidates",
    desc: "Evidence-based items to check, with the reasoning shown.",
    wide: false,
  },
  {
    icon: SlidersHorizontal,
    title: "Your own scenarios",
    desc: "Adjust costs yourself. Nothing starts with an invented saving.",
    wide: false,
  },
  {
    icon: Download,
    title: "Safe exports",
    desc: "CSV and JSON you download locally. Your numbers never leave the browser unless you choose to save them.",
    wide: true,
  },
];

function Home() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <MotionBackdrop poster={hero} videoSrc="/hero-loop.mp4" />
        <div className="mx-auto max-w-6xl px-5 pb-28 pt-28 sm:pt-40">
          <p className="num text-xs uppercase tracking-widest text-accent">Free · Open source · Private</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight text-silver sm:text-6xl">
            See where your business money goes.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Add expenses, revenue or invoices. See spending patterns, review possible waste and calculate what a change could save. Your files are processed in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/analyze" className={btn.primary}>Start an analysis</Link>
            <Link to="/demo" className={btn.outline}>View synthetic demo</Link>
          </div>
          <Link to="/your-ai" className="mt-5 inline-block py-2 text-sm text-accent underline">Try with your AI and existing connectors</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className={`card-3d group p-6 sm:p-8 ${f.wide ? "lg:col-span-2" : ""}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/60 text-accent">
                <f.icon className="icon-animated h-5 w-5" strokeWidth={1.5} />
              </div>
              <h2 className="mt-5 text-lg font-medium">{f.title}</h2>
              <p className={`mt-2 text-sm leading-relaxed text-muted-foreground ${f.wide ? "max-w-lg" : ""}`}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-10 px-5 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-semibold">How it works</h2>
          <ol className="mt-6 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-4 border-b border-border pb-3">
                <span className="num text-accent">0{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card-3d p-6">
          <h2 className="text-2xl font-semibold">Your data stays with you</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Processed in browser memory only</li>
            <li>No automatic saving or document uploads</li>
            <li>Local OCR, no model API keys, no tracking of your figures</li>
          </ul>
          <Link to="/privacy" className="mt-5 inline-block text-sm text-accent hover:underline">Read the privacy details</Link>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-5">
        <div className="flex flex-wrap items-center justify-between gap-4 card-3d p-6">
          <div>
            <h2 className="text-xl font-semibold">Sponsor us</h2>
            <p className="mt-1 text-sm text-muted-foreground">CostSieve stays free. Voluntary support keeps it maintained.</p>
          </div>
          <Link to="/support" className={btn.outline}>Learn about support</Link>
        </div>
      </section>
    </>
  );
}
