import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const nav = [
  { to: "/analyze", label: "Analyze" },
  { to: "/support", label: "Support" },
] as const;

const footerLinks = [
  { to: "/demo", label: "Demo" },
  { to: "/methodology", label: "Methodology" },
  { to: "/docs", label: "Docs" },
  { to: "/privacy", label: "Privacy" },
  { to: "/about", label: "About" },
  { to: "/changelog", label: "Changelog" },
  { to: "/report", label: "Report" },
  { to: "/support", label: "Sponsor us" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/60 backdrop-blur-xl backdrop-saturate-150">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 rounded bg-card px-3 py-2 text-sm">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <img src="/favicon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg shadow-md" />
          CostSieve
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm text-muted-foreground sm:grid-cols-3">
        <div>
          <p className="font-display text-foreground">CostSieve</p>
          <p className="mt-1">Free, open-source business cost auditor.</p>
          <p className="mt-1">by NovAPR Technologies</p>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
          {footerLinks.map((l) => (
            <li key={l.label}><Link to={l.to} className="hover:text-foreground">{l.label}</Link></li>
          ))}
        </ul>
        <p>Source code: <a className="text-accent underline" href="https://github.com/raducanuandrei/Costsieve">GitHub repository</a>.</p>
      </div>
    </footer>
  );
}

export function Page({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-5 pt-16">
      {eyebrow && <p className="num text-xs uppercase tracking-widest text-accent">{eyebrow}</p>}
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
      {intro && <div className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</div>}
      <div className="mt-10 space-y-8">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function Panel({ title, children, note }: { title: string; children?: ReactNode; note?: string | undefined }) {
  return (
    <section className="card-3d p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display font-medium text-foreground">{title}</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export const btn = {
  primary: "btn-3d",
  outline: "btn-3d-dark",
  disabled: "btn-3d-off",
};
