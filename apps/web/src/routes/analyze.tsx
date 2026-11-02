import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Page, Panel, btn } from '@/components/site/layout';
import { ResultsView } from '@/components/site/results-view';
import { useAnalysis } from '@/lib/analysis-context';
import { seo } from '@/lib/seo';
import type { Fields, FileOptions, ReviewDecision } from '@costsieve/imports';

export const Route = createFileRoute('/analyze')({ head: () => seo('Analyze business costs', 'Import CSV, Excel, invoices or scans locally and review the extracted data.'), component: Analyze });
const names: Record<keyof Fields, string> = { date: 'Date', vendor: 'Vendor', category: 'Category', amount: 'Amount', currency: 'Currency', kind: 'Type', transactionId: 'Transaction ID' };
const fields = ['date', 'vendor', 'category', 'amount', 'currency', 'kind'] as const;
const kinds = ['expense', 'revenue', 'expense_refund', 'revenue_refund', 'transfer'] as const;

function Analyze() {
  const api = useAnalysis();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]), [options, setOptions] = useState<Record<string, FileOptions>>({});
  const { edits, confirmed, excluded, excludedDocs, matches, page } = api.reviewControls;
  const setEdits = (value: (old: Record<string, Fields>) => Record<string, Fields>) => api.setReviewControls(old => ({ ...old, edits: value(old.edits) }));
  const setConfirmed = (confirmed: string[]) => api.setReviewControls(old => ({ ...old, confirmed }));
  const setExcluded = (excluded: string[]) => api.setReviewControls(old => ({ ...old, excluded }));
  const setExcludedDocs = (excludedDocs: string[]) => api.setReviewControls(old => ({ ...old, excludedDocs }));
  const setMatches = (value: (old: typeof matches) => typeof matches) => api.setReviewControls(old => ({ ...old, matches: value(old.matches) }));
  const setPage = (page: number) => api.setReviewControls(old => ({ ...old, page }));
  useEffect(() => { if (!api.draft) { setFiles([]); setOptions({}); } }, [api.draft?.id]);
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const setOption = (name: string, next: Partial<FileOptions>) => setOptions(old => ({ ...old, [name]: { ...old[name], ...next } }));
  const submit = () => {
    if (!api.draft) return;
    const decision: ReviewDecision = {
      confirmedRecordIds: confirmed, excludedRecordIds: excluded, excludedDocumentIds: excludedDocs,
      corrections: Object.entries(edits).map(([recordId, fields]) => ({ recordId, fields })),
      reconciliations: Object.values(matches).filter(match => match.keep && match.exclude.length).map(match => ({ keepRecordId: match.keep, excludeRecordIds: match.exclude })),
      separatePurchaseGroups: Object.entries(matches).filter(([, match]) => match.separate).map(([id]) => id),
    };
    api.complete(decision);
  };
  if (api.result) return <ResultsView />;
  const records = [...(api.draft?.records ?? [])].sort((a, b) => Number(b.requiresConfirmation || b.issues.length > 0) - Number(a.requiresConfirmation || a.issues.length > 0));
  const visible = records.slice(page * 25, (page + 1) * 25);
  return <Page eyebrow="Private analysis" title={api.draft ? 'Review your documents' : 'Analyze your spending'} intro="Your documents are processed on this device. No account, bank connection or upload endpoint.">
    {api.error && <div className="notice error" role="alert">{api.error}</div>}
    {!api.draft && <Panel title="1. Add business documents" note="20 MiB per file · 50 MiB total">
      <p>CSV, Excel .xlsx, PDF invoices, JPG and PNG. Scans use local text recognition. Use one invoice per PDF/image.</p>
      <label className="field mt-5">Business documents<input ref={fileInput} type="file" multiple accept=".csv,.xlsx,.pdf,.jpg,.jpeg,.png" disabled={api.busy} onChange={event => setFiles(Array.from(event.target.files ?? []))} /></label>
      {files.map(file => <details key={file.name} className="mt-4 rounded border border-border p-3"><summary className="cursor-pointer text-foreground break-all">{file.name}: import options</summary>
        <div className="form-grid mt-4">
          <label className="field">Worksheet<input value={options[file.name]?.sheet ?? ''} onChange={event => setOption(file.name, { sheet: event.target.value })} placeholder="Choose when workbook has several sheets" /></label>
          <label className="field">Number format<select aria-label="Number format" value={options[file.name]?.decimalSeparator ?? ''} onChange={event => setOption(file.name, { decimalSeparator: event.target.value as '.' | ',' })}><option value="">Canonical decimal values</option><option value=".">1,234.56</option><option value=",">1.234,56</option></select></label>
          <label className="field">Date format<select aria-label="Date format" value={options[file.name]?.dateOrder ?? ''} onChange={event => setOption(file.name, { dateOrder: event.target.value as 'DMY' | 'MDY' })}><option value="">ISO dates</option><option value="DMY">Day / month / year</option><option value="MDY">Month / day / year</option></select></label>
          <label className="field">Document direction<select aria-label="Document direction" value={options[file.name]?.kind ?? ''} onChange={event => setOption(file.name, { kind: event.target.value as FileOptions['kind'] })}><option value="">Use the type column; confirm invoices</option>{kinds.map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select></label>
        </div>
        <p className="mt-4">For unusual CSV/Excel headers, enter the exact source column names below. Empty fields use automatic matching.</p>
        <div className="form-grid mt-3">{fields.map(field => <label className="field" key={field}>{names[field]} column<input value={options[file.name]?.mapping?.[field] ?? ''} onChange={event => setOptions(old => { const mapping = { ...old[file.name]?.mapping }; if (event.target.value) mapping[field] = event.target.value; else delete mapping[field]; return { ...old, [file.name]: { ...old[file.name], mapping } }; })} /></label>)}</div>
      </details>)}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={btn.primary} disabled={!files.length || api.busy} onClick={() => api.prepare(files, options)}>Review documents</button>{api.busy && <button type="button" className={btn.outline} onClick={() => { api.reset(); setFiles([]); setOptions({}); if (fileInput.current) fileInput.current.value = ''; }}>Cancel processing</button>}</div>
      {api.busy && <p className="mt-3" role="status">{api.progress || 'Processing locally…'}</p>}
    </Panel>}
    {api.draft && <>
      <Panel title="2. Verify the extracted information" note={`${records.length} records`}>
        <p>Check the original invoices. Confirm supplier, date, total, currency and direction. A total is not proof of payment or audited profit.</p>
        {api.draft.documents.map(document => <div key={document.id} className="mt-4 break-words"><strong className="text-foreground">{document.name}</strong>{document.issues.map(issue => <p key={issue} className="text-loss">{issue}</p>)}{document.issues.length > 0 && <label className="check"><input type="checkbox" checked={excludedDocs.includes(document.id)} onChange={() => setExcludedDocs(toggle(excludedDocs, document.id))} />Exclude this unreadable document; report will be partial</label>}</div>)}
        <div className="mt-5 space-y-4">{visible.map((record, index) => {
          const ordinal = page * 25 + index + 1, values = { ...record.fields, ...edits[record.recordId] };
          return <fieldset key={record.recordId} className="record-review"><legend>Record {ordinal} · {record.source.kind} {record.source.page ? `page ${record.source.page}` : `row ${record.source.record}`}</legend>
            <p className="text-xs mb-3 break-all">{api.draft!.documents.find(document => document.id === record.source.documentId)?.name}{record.source.sheet ? ` / ${record.source.sheet}` : ''}</p>
            {record.issues.map(issue => <p key={issue} className="text-loss text-sm mb-2">{issue}</p>)}
            <div className="form-grid">{fields.map(field => <label className="field" key={field}>{names[field]}<span className="sr-only"> for record {ordinal}</span>{field === 'kind' ? <select value={values.kind ?? ''} onChange={event => setEdits(old => ({ ...old, [record.recordId]: { ...old[record.recordId], kind: event.target.value } }))}><option value="">Choose a type</option>{kinds.map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select> : <input value={values[field] ?? ''} inputMode={field === 'amount' ? 'decimal' : 'text'} onChange={event => setEdits(old => ({ ...old, [record.recordId]: { ...old[record.recordId], [field]: event.target.value } }))} />}</label>)}</div>
            {record.requiresConfirmation && <label className="check mt-4"><input type="checkbox" aria-label={`Confirm invoice ${ordinal}`} checked={confirmed.includes(record.recordId)} onChange={() => setConfirmed(toggle(confirmed, record.recordId))} />I checked these fields and this file contains one invoice.</label>}
            <label className="check mt-3"><input type="checkbox" checked={excluded.includes(record.recordId)} onChange={() => setExcluded(toggle(excluded, record.recordId))} />Exclude record {ordinal}; show partial coverage</label>
          </fieldset>;
        })}</div>
        {records.length > 25 && <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label="Record pages"><button type="button" className={btn.outline} disabled={!page} onClick={() => setPage(page - 1)}>Previous records</button><span>{page * 25 + 1}–{Math.min((page + 1) * 25, records.length)} of {records.length}</span><button type="button" className={btn.outline} disabled={(page + 1) * 25 >= records.length} onClick={() => setPage(page + 1)}>Next records</button></nav>}
      </Panel>
      {api.draft.reconciliations.map(group => {
        const match = matches[group.id] ?? { keep: '', exclude: [], separate: false };
        const update = (next: Partial<typeof match>) => setMatches(old => ({ ...old, [group.id]: { ...match, ...next } }));
        return <Panel key={group.id} title="Check a possible invoice/payment match"><p>{group.reason}</p><label className="field mt-4">Keep this record for the same purchase<select value={match.keep} onChange={event => update({ keep: event.target.value, exclude: match.exclude.filter(id => id !== event.target.value) })}><option value="">No link selected</option>{group.recordIds.map(id => { const row = api.draft!.records.find(record => record.recordId === id)!; return <option key={id} value={id}>{row.fields.date} · {row.fields.vendor} · {row.fields.amount} {row.fields.currency} · {row.source.kind}</option>; })}</select></label>
          <p className="mt-4">Exclude only the records represented by that purchase, not other billing months.</p>
          {group.recordIds.filter(id => id !== match.keep).map(id => { const row = api.draft!.records.find(record => record.recordId === id)!; return <label className="check mt-2" key={id}><input type="checkbox" disabled={!match.keep} checked={match.exclude.includes(id)} onChange={() => update({ exclude: toggle(match.exclude, id) })} />Represented elsewhere: {row.fields.date} · {row.fields.vendor} · {row.fields.amount} {row.fields.currency} · {row.source.kind}</label>; })}
          <label className="check mt-4"><input type="checkbox" checked={match.separate} onChange={() => update({ separate: !match.separate })} />Any remaining records in this group are separate purchases.</label>
        </Panel>;
      })}
      <div className="flex flex-wrap gap-3"><button type="button" className={btn.primary} onClick={submit}>Analyze confirmed data</button><button type="button" className={btn.outline} onClick={api.reset}>Choose other files</button></div>
    </>}
  </Page>;
}
