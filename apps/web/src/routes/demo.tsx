import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Page, btn } from '@/components/site/layout';
import { ResultsView } from '@/components/site/results-view';
import { useAnalysis } from '@/lib/analysis-context';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/demo')({ head: () => seo('Synthetic demo', 'Run the real local engine with clearly labeled sample business data.'), component: Demo });
function Demo() {
  const api = useAnalysis(), started = useRef(false);
  useEffect(() => { if (!api.result && !api.draft && !started.current) { started.current = true; void api.demo(); } }, []);
  if (api.result?.analysis.report.dataOrigin === 'SYNTHETIC_DEMO') return <ResultsView />;
  if (api.result || api.draft && !api.busy) return <Page title="Open the synthetic demo" intro="A local analysis is already active. Loading the demo replaces it in this tab."><div className="flex flex-wrap gap-3"><button type="button" className={btn.primary} onClick={api.demo}>Replace current analysis with demo</button><Link to="/report" className={btn.outline}>Keep my report</Link></div></Page>;
  return <Page title={api.busy ? 'Preparing the synthetic demo' : 'Synthetic demo'} intro={api.error || (api.busy ? 'Running the same engine used for your own documents…' : 'The previous analysis was cleared. Load a fresh set of sample records.')}>
    {!api.busy && <button type="button" className={btn.primary} onClick={api.demo}>Load synthetic demo</button>}
  </Page>;
}
