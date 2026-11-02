import { createFileRoute, Link } from '@tanstack/react-router';
import { Page, btn } from '@/components/site/layout';
import { ResultsView } from '@/components/site/results-view';
import { useAnalysis } from '@/lib/analysis-context';
import { seo } from '@/lib/seo';
export const Route = createFileRoute('/report')({ head: () => seo('Your local report', 'Your active CostSieve report is held only in this tab.'), component: Report });
function Report() {
  const api = useAnalysis();
  return api.result ? <ResultsView /> : <Page title="No active report" intro="Start an analysis or open the synthetic demo. Refreshing or closing the tab clears your data."><div className="flex flex-wrap gap-3"><Link to="/analyze" className={btn.primary}>Begin an analysis</Link><Link to="/demo" className={btn.outline}>Open the demo</Link></div></Page>;
}
