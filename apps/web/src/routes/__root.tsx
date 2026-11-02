import { createRootRoute, HeadContent, Link, Outlet } from '@tanstack/react-router';
import { SiteHeader, SiteFooter, Page, btn } from '@/components/site/layout';
import { AnalysisProvider } from '@/lib/analysis-context';

export const Route = createRootRoute({
  component: () => <AnalysisProvider><HeadContent /><SiteHeader /><main id="main"><Outlet /></main><SiteFooter /></AnalysisProvider>,
  notFoundComponent: () => <Page title="Page not found" intro="Choose an analysis or return home."><Link to="/" className={btn.primary}>Go home</Link></Page>,
  errorComponent: () => <Page title="This page could not load" intro="Reload to start a new local analysis. No error details are sent to a third party."><a href="/" className={btn.primary}>Return home</a></Page>,
});
