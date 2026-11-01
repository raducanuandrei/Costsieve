import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Page, Panel, btn } from './layout';
import { useAnalysis } from '@/lib/analysis-context';
import { getActionGuide, type CostAction, type Recommendation, type UsageAnswer } from '@costsieve/engine';

const money = (currency: string, value: string) => `${currency} ${value}`;
const tone = (value: string) => value.startsWith('-') ? 'negative' : value === '0' ? 'neutral' : 'positive';

function UsageQuestion({ targets, label, onAnswer }: { targets: string[]; label: string; onAnswer: (answer: UsageAnswer) => void }) {
  const [paid, setPaid] = useState(''), [active, setActive] = useState(''), [uniform, setUniform] = useState(false), [allowed, setAllowed] = useState(false);
  return <form className="record-review space-y-3" onSubmit={event => { event.preventDefault(); onAnswer({ targetRecordIds: targets, paidSeats: Number(paid), activeSeats: Number(active), uniformPricing: uniform, reductionAllowed: allowed }); }}>
    <h3 className="text-foreground font-medium">{label}</h3><p>For a per-seat service, confirm usage and contract terms. Leave unanswered when these facts are unknown.</p>
    <div className="form-grid"><label className="field">Paid seats<input type="number" min="1" step="1" required value={paid} onChange={event => setPaid(event.target.value)} /></label><label className="field">Active seats<input type="number" min="0" step="1" required value={active} onChange={event => setActive(event.target.value)} /></label></div>
    <label className="check"><input type="checkbox" checked={uniform} onChange={event => setUniform(event.target.checked)} />Each seat has the same price</label>
    <label className="check"><input type="checkbox" checked={allowed} onChange={event => setAllowed(event.target.checked)} />The contract permits reducing these seats</label>
    <button className={btn.outline} type="submit">Update usage evidence</button>
  </form>;
}

function Guide({ recommendation }: { recommendation: Recommendation }) {
  const [open, setOpen] = useState(false); const guide = getActionGuide(recommendation.kind);
  return <div className="mt-4"><button type="button" className={btn.outline} aria-expanded={open} onClick={() => setOpen(!open)}>How to implement</button>{open && <section className="mt-4 space-y-3"><h4 className="text-foreground font-medium">{guide.title}</h4><ol className="list-decimal pl-5 space-y-2">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><p><strong>Verify:</strong> {guide.verification}</p><p><strong>Rollback:</strong> {guide.rollback}</p></section>}</div>;
}

export function ResultsView() {
  const api = useAnalysis();
  const { currency, selection, percent, overhead, dirty } = api.controls;
  const setCurrency = (currency: string) => api.setControls(old => ({ ...old, currency }));
  const setSelection = (value: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => api.setControls(old => ({ ...old, selection: typeof value === 'function' ? value(old.selection) : value }));
  const setPercent = (value: (old: Record<string, string>) => Record<string, string>) => api.setControls(old => ({ ...old, percent: value(old.percent) }));
  const setOverhead = (overhead: string) => api.setControls(old => ({ ...old, overhead }));
  const setDirty = (dirty: boolean) => api.setControls(old => ({ ...old, dirty }));
  const usage = api.usageAnswers;
  if (!api.result || !api.draft) return null;
  const { report, recommendations, questions } = api.result.analysis;
  const currentCurrency = currency || report.currencies[0]!.currency;
  const current = recommendations.filter(item => item.currency === currentCurrency);
  const selectedActions: CostAction[] = current.filter(item => selection[item.id]).map(item => item.action ?? { id: item.id, targetRecordIds: item.targetRecordIds, reductionPercent: percent[item.id] ?? '0' });
  const scenario = dirty ? null : api.scenario;
  const apply = () => { setDirty(!api.simulate(selectedActions, currentCurrency, overhead)); };
  const adjust = (action: () => void) => { action(); setDirty(true); };
  return <Page eyebrow={report.dataOrigin === 'SYNTHETIC_DEMO' ? 'Synthetic demo' : 'Local report'} title={report.dataOrigin === 'SYNTHETIC_DEMO' ? 'Demo spending report' : 'Your spending report'} intro="Review the recorded costs, choose supported changes and compare their estimated effect. No saving is assumed or achieved automatically.">
    {report.dataOrigin === 'SYNTHETIC_DEMO' && <p className="notice">SYNTHETIC DEMO. These are sample business records, not customer results.</p>}
    {api.error && <div className="notice error" role="alert">{api.error}</div>}
    <div className="flex flex-wrap gap-3 print:hidden"><Link to="/your-ai" className={btn.primary}>Try with your AI</Link><button type="button" className={btn.outline} disabled={dirty} onClick={() => api.download('csv')}>Export CSV</button><button type="button" className={btn.outline} disabled={dirty} onClick={() => api.download('json')}>Export JSON</button><button type="button" className={btn.outline} onClick={() => window.print()}>Print / PDF</button><button type="button" className={btn.outline} onClick={api.reset}>Reset analysis</button></div>
    <p className="text-sm text-muted-foreground">Records: {api.result.coverage.confirmedRecords} included, {api.result.coverage.excludedRecords} excluded, {api.result.coverage.reconciledRecords} source records reconciled. Period: {report.period.firstTransaction} to {report.period.lastTransaction}, UTC. {api.result.status === 'partial' ? 'Partial coverage: omitted amounts remain unknown.' : 'Coverage describes the supplied records, not independently verified business completeness.'}</p>
    <div className="grid gap-4 md:grid-cols-2">{report.currencies.map(item => <Panel key={item.currency} title={`Recorded amounts: ${item.currency}`} note="No currency conversion">
      <dl className="metric-list"><div><dt>Net recorded expenses</dt><dd data-testid="net-expense" className="num">{money(item.currency, item.netExpense)}</dd></div><div><dt>Net recorded revenue</dt><dd className="num">{money(item.currency, item.netRevenue)}</dd></div>{item.hasRevenue ? <div><dt>Recorded result</dt><dd data-testid="recorded-result" className={`num economic ${tone(item.recordedSurplus)}`}>{money(item.currency, item.recordedSurplus)}</dd></div> : <div><dt>Recorded result</dt><dd>Revenue data is missing</dd></div>}<div><dt>Expense refunds</dt><dd className="num">{money(item.currency, item.expenseRefunds)}</dd></div></dl>
      <p className="mt-3 text-xs">Recorded result is not audited profit. Transfers are excluded; refunds are accounted for separately.</p>
    </Panel>)}</div>
    <Panel title="Spending breakdowns"><div className="grid gap-6 lg:grid-cols-3">{[['By vendor', report.byVendor], ['By category', report.byCategory], ['By month', report.byMonth]].map(([title, data]) => <div key={String(title)}><h3 className="font-medium text-foreground mb-3">{String(title)}</h3><div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Group</th><th scope="col">Net expenses</th></tr></thead><tbody>{(data as typeof report.byVendor).slice(0, 50).map(item => <tr key={`${item.currency}:${item.key}`}><th scope="row" className="break-words">{item.key}</th><td className="num">{money(item.currency, item.netExpense)}</td></tr>)}</tbody></table></div>{(data as typeof report.byVendor).length > 50 && <p>First 50 groups shown. The local export contains all groups.</p>}</div>)}</div></Panel>
    {questions.length > 0 && <Panel title="Refine the recommendations" note="Optional context, at most three initial questions"><div className="space-y-4">{questions.map(question => <UsageQuestion key={question.id} targets={question.targetRecordIds} label={api.draft!.records.find(row => question.targetRecordIds.includes(row.recordId))?.fields.vendor ?? 'Review service usage'} onAnswer={answer => { const next = [...usage.filter(item => !item.targetRecordIds.some(id => answer.targetRecordIds.includes(id))), answer]; api.complete({ usage: next }); }} />)}</div></Panel>}
    <Panel title="Review candidates and possible changes" note="Nothing selected by default">
      <label className="field max-w-xs">Scenario currency<select aria-label="Scenario currency" value={currentCurrency} onChange={event => adjust(() => { setCurrency(event.target.value); setSelection({}); })}>{report.currencies.map(item => <option key={item.currency}>{item.currency}</option>)}</select></label>
      <div className="mt-5 space-y-5">{current.map((item, index) => <article key={item.id} className="record-review">
        <h3 className="text-foreground font-medium">{item.title}</h3><p className="mt-2">{item.explanation}</p>
        <p className="mt-2 text-xs">Evidence: {item.evidence.slice(0, 5).map(source => `${source.kind} ${source.page ? `page ${source.page}` : `row ${source.record}`}`).join('; ')}{item.evidence.length > 5 ? `; ${item.evidence.length} records in total` : ''}. Period: {item.period.from} to {item.period.to}.</p>
        <p className="mt-2">{item.estimatedSavings === null ? 'Potential saving: not quantified without an explicit assumption.' : `Potential saving on these recorded charges: ${money(item.currency, item.estimatedSavings)} (estimate).`}</p><p className="mt-2 text-xs">{item.caveat}</p>
        <label className="check mt-4"><input type="checkbox" aria-label={`Select action ${index + 1}`} checked={Boolean(selection[item.id])} onChange={event => adjust(() => setSelection(old => ({ ...old, [item.id]: event.target.checked })))} />Include this change in my scenario</label>
        {!item.action && <label className="field mt-3 max-w-xs">Assumed reduction (%) for action {index + 1}<input type="number" min="0" max="100" step="any" value={percent[item.id] ?? '0'} onChange={event => adjust(() => setPercent(old => ({ ...old, [item.id]: event.target.value })))} /></label>}
        <Guide recommendation={item} />
      </article>)}{!current.length && <p>No supported review candidates for this currency. That does not prove there is no waste.</p>}</div>
      <div className="mt-6 flex flex-wrap items-end gap-4"><label className="field max-w-xs">Implementation cost<input type="number" min="0" step="any" value={overhead} onChange={event => adjust(() => setOverhead(event.target.value))} /><span className="text-xs">One-time amount in {currentCurrency}</span></label><button type="button" className={btn.primary} onClick={apply}>Apply scenario</button></div>
      {dirty && <p className="mt-3" role="status">Apply your changes to update the estimate and enable exports.</p>}
      {scenario && <section className="scenario-result mt-6" key={`${scenario.currency}:${scenario.netBenefit}`} aria-label="Hypothetical scenario" aria-live="polite"><h3 className="font-medium text-foreground">Potential effect, not money already saved</h3><dl className="metric-list mt-4"><div><dt>Gross recorded expenses</dt><dd className="num">{money(scenario.currency, scenario.baselineExpense)}</dd></div><div><dt>Projected expenses</dt><dd className="num">{money(scenario.currency, scenario.projectedExpense)}</dd></div><div><dt>Hypothetical reduction</dt><dd className={`num economic ${tone(scenario.hypotheticalSavings)}`}>{money(scenario.currency, scenario.hypotheticalSavings)}</dd></div><div><dt>Net benefit after implementation cost</dt><dd data-testid="net-benefit" data-tone={tone(scenario.netBenefit)} className={`num economic ${tone(scenario.netBenefit)}`}>{scenario.netBenefit.startsWith('-') ? '' : '+'}{money(scenario.currency, scenario.netBenefit)}</dd></div>{scenario.recordedResultAfter !== null && <div><dt>Projected recorded result, revenue unchanged</dt><dd className={`num economic ${tone(scenario.recordedResultAfter)}`}>{money(scenario.currency, scenario.recordedResultAfter)}</dd></div>}</dl><p className="mt-4">{scenario.period.from} to {scenario.period.to}. {scenario.assumptions}</p><p className="mt-2 text-xs">{scenario.basis}</p></section>}
    </Panel>
    <Panel title="Assumptions and limitations"><ul className="list-disc pl-5 space-y-2">{report.limitations.map(text => <li key={text}>{text}</li>)}</ul><p className="mt-4">{api.result.warning}</p></Panel>
  </Page>;
}
