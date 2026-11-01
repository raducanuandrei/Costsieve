import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { createAiHandoff } from '@costsieve/engine';
import { Page, Panel, btn } from '@/components/site/layout';
import { useAnalysis } from '@/lib/analysis-context';
import { buildAiBrief } from '@/lib/ai-brief';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/your-ai')({
  head: () => seo('Try with your AI', 'A complete business audit workflow using your assistant’s existing connectors and research tools.'),
  component: YourAi,
});

function YourAi() {
  const api = useAnalysis();
  return <AiBrief key={api.draft?.id ?? 'no-report'} />;
}

function AiBrief() {
  const api = useAnalysis();
  const [includeReport, setIncludeReport] = useState(false);
  const [includeLabels, setIncludeLabels] = useState(false);
  const [currency, setCurrency] = useState('');
  const [approvedBrief, setApprovedBrief] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const analysis = api.result?.analysis;
  const selectedCurrency = currency || analysis?.report.currencies[0]?.currency || '';
  const blocked = includeReport && api.controls.dirty;
  const snapshot = includeReport && analysis && !blocked ? createAiHandoff(analysis, {
    currency: selectedCurrency, includeLabels,
    ...(api.scenario?.currency === selectedCurrency ? { scenario: api.scenario } : {}),
  }) : undefined;
  const brief = buildAiBrief(snapshot);
  const canTransfer = !blocked && (!includeReport || approvedBrief === brief);
  const changed = (action: () => void) => { action(); setApprovedBrief(null); setStatus(''); setError(''); };
  const copy = async () => {
    if (!canTransfer) return;
    setError(''); setStatus('');
    try { await navigator.clipboard.writeText(brief); setStatus('Reviewed audit brief copied. Paste it into your chosen AI application.'); }
    catch { setError('Your browser blocked copying. Select the preview to copy it manually, or download the audit brief.'); }
  };
  const download = () => {
    if (!canTransfer) return;
    const url = URL.createObjectURL(new Blob([brief], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'costsieve-ai-audit.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Page eyebrow="Your assistant, your choice" title="Try with your AI" intro="Give your assistant a complete audit workflow. It can use the connectors and research tools you already have, then ask you directly when essential context is missing.">
    <Panel title="Use existing connected accounts">
      <p>Copy the brief into your AI application, or download and install the complete skill in a client that supports SKILL.md. Ask it to check expenses, research comparable alternatives and find efficiency, automation and margin opportunities.</p>
      <p className="mt-3">The skill starts with available read-only connectors. It asks which company or period to use when ambiguous, and requests information only when approved sources cannot provide it. Capabilities depend on your AI client; this page does not connect accounts or perform the research itself.</p>
      <div className="mt-5 flex flex-wrap gap-3"><a className={btn.outline} href="/skills/costsieve-audit.zip" download="costsieve-audit.zip">Download complete skill</a><Link to="/docs" className={btn.outline}>Read setup guidance</Link></div>
    </Panel>
    <Panel title="1. Choose what to include" note="Business data excluded by default">
      {analysis ? <>
        <label className="check"><input type="checkbox" checked={includeReport} onChange={event => changed(() => setIncludeReport(event.target.checked))} />Include current report</label>
        {includeReport && <div className="mt-4 space-y-3">
          <label className="field max-w-xs">Report currency<select aria-label="Report currency" value={selectedCurrency} onChange={event => changed(() => setCurrency(event.target.value))}>{analysis.report.currencies.map(row => <option key={row.currency}>{row.currency}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={includeLabels} onChange={event => changed(() => setIncludeLabels(event.target.checked))} />Include vendor, customer and category names</label>
          <p>Only a bounded summary of the selected currency is included. Original files, filenames, transaction IDs and raw document text are excluded. Names are hidden unless selected; financial amounts and dates remain sensitive.</p>
          {api.scenario && api.scenario.currency !== selectedCurrency && <p>The applied scenario uses another currency and is omitted from this snapshot.</p>}
        </div>}
      </> : <p>No business report is attached. Your AI can start with its approved connectors. You can also <Link to="/analyze" className="text-accent underline">run a local analysis</Link> and return here to include a reviewed summary.</p>}
      {blocked && <p className="notice error mt-4" role="alert">Your scenario has pending changes. <Link to="/report" className="underline">Apply them in Report</Link>, or turn off Include current report to use the instructions alone.</p>}
      <p className="notice mt-4">CostSieve does not send this brief to an AI provider. When you share it with a cloud AI or use that application’s connectors, the information follows that provider’s data policy. Fully local processing requires a local model and compatible local tools.</p>
    </Panel>
    <Panel title="2. Review and use the brief">
      <label className="field">AI audit brief<textarea aria-label="AI audit brief" className="num ai-preview" readOnly rows={16} value={brief} spellCheck={false} /></label>
      {includeReport && <label className="check mt-4"><input type="checkbox" checked={approvedBrief === brief && !blocked} disabled={blocked} onChange={event => setApprovedBrief(event.target.checked ? brief : null)} />I reviewed this brief and choose to share these figures with my AI provider.</label>}
      <div className="mt-5 flex flex-wrap gap-3"><button className={btn.primary} type="button" disabled={!canTransfer} onClick={copy}>Copy audit brief</button><button className={btn.outline} type="button" disabled={!canTransfer} onClick={download}>Download audit brief</button></div>
      {status && <p className="mt-4" role="status">{status}</p>}{error && <p className="notice error mt-4" role="alert">{error}</p>}
      <p className="mt-4 text-xs">The skill separates verified cash effects, time released, service improvements and revenue hypotheses. It requires source evidence and implementation steps. Research and proposed savings are not actions already carried out.</p>
    </Panel>
  </Page>;
}
