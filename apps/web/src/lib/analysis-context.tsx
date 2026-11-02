import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { AnalysisSession, createBrowserExtractor, type ReviewDraft, type FileOptions, type ReviewDecision, type Fields } from '@costsieve/imports';
import type { CostAction, UsageAnswer, simulateActions } from '@costsieve/engine';
import demoCsv from '../../../../packages/engine/fixtures/business-demo.csv?raw';

type Result = ReturnType<AnalysisSession['result']>;
type Scenario = ReturnType<typeof simulateActions>;
type ScenarioControls = { currency: string; selection: Record<string, boolean>; percent: Record<string, string>; overhead: string; dirty: boolean };
const emptyControls = (): ScenarioControls => ({ currency: '', selection: {}, percent: {}, overhead: '0', dirty: false });
type ReviewControls = { edits: Record<string, Fields>; confirmed: string[]; excluded: string[]; excludedDocs: string[]; matches: Record<string, { keep: string; exclude: string[]; separate: boolean }>; page: number };
const emptyReview = (): ReviewControls => ({ edits: {}, confirmed: [], excluded: [], excludedDocs: [], matches: {}, page: 0 });
interface Value {
  draft: ReviewDraft | null; result: Result | null; scenario: Scenario | null; busy: boolean; progress: string; error: string;
  prepare(files: File[], options: Record<string, FileOptions>): Promise<void>;
  complete(decision: ReviewDecision): void; reset(): void; demo(): Promise<void>;
  controls: ScenarioControls; setControls: Dispatch<SetStateAction<ScenarioControls>>;
  usageAnswers: UsageAnswer[];
  reviewControls: ReviewControls; setReviewControls: Dispatch<SetStateAction<ReviewControls>>;
  simulate(actions: CostAction[], currency: string, implementationCost: string): boolean;
  download(format: 'json' | 'csv'): void;
}
const Context = createContext<Value | null>(null);
const newSession = (demo = false) => new AnalysisSession({ extractor: createBrowserExtractor(), dataOrigin: demo ? 'SYNTHETIC_DEMO' : 'USER_SUPPLIED' });

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AnalysisSession | null>(null), abort = useRef<AbortController | null>(null), generation = useRef(0);
  const [draft, setDraft] = useState<ReviewDraft | null>(null), [result, setResult] = useState<Result | null>(null), [scenario, setScenario] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const [controls, setControls] = useState<ScenarioControls>(emptyControls);
  const [usageAnswers, setUsageAnswers] = useState<UsageAnswer[]>([]);
  const [reviewControls, setReviewControls] = useState<ReviewControls>(emptyReview);
  const reset = useCallback(() => { generation.current++; abort.current?.abort(); ref.current?.clear(); ref.current = null; setDraft(null); setResult(null); setScenario(null); setControls(emptyControls()); setReviewControls(emptyReview()); setUsageAnswers([]); setBusy(false); setProgress(''); setError(''); }, []);
  useEffect(() => () => { abort.current?.abort(); ref.current?.clear(); }, []);
  useEffect(() => {
    if (!draft) return;
    let timer: ReturnType<typeof setTimeout>;
    const activity = () => {
      try { ref.current?.keepAlive(draft.id); } catch { reset(); return; }
      clearTimeout(timer); timer = setTimeout(reset, 30 * 60 * 1000);
    };
    activity();
    document.addEventListener('input', activity, true); document.addEventListener('click', activity, true); document.addEventListener('keydown', activity, true);
    return () => { clearTimeout(timer); document.removeEventListener('input', activity, true); document.removeEventListener('click', activity, true); document.removeEventListener('keydown', activity, true); };
  }, [draft, result, scenario, reset]);
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : 'Analysis failed. Check the documents and try again.');
  const prepare = async (files: File[], options: Record<string, FileOptions>) => {
    reset(); const token = generation.current;
    if (!files.length || files.length > 20 || files.some(file => file.size > 20 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) { setError('Choose 1–20 files, at most 20 MiB each and 50 MiB combined.'); return; }
    setBusy(true); setProgress('Reading documents locally…'); abort.current = new AbortController();
    try {
      const documents = await Promise.all(files.map(async file => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
      if (token !== generation.current) return;
      const session = newSession(); ref.current = session;
      const review = await session.prepare(documents, { signal: abort.current.signal, fileOptions: options, onProgress: event => { if (token === generation.current) setProgress(`${event.stage}: ${Math.round(event.progress * 100)}%`); } });
      if (token === generation.current) setDraft(review);
    } catch (cause) { if (token === generation.current) fail(cause); }
    finally { if (token === generation.current) setBusy(false); }
  };
  const complete = (decision: ReviewDecision) => {
    if (!draft || !ref.current) return; setError(''); setScenario(null);
    try { setResult(ref.current.complete(draft.id, decision)); setControls(emptyControls()); if (decision.usage) setUsageAnswers(decision.usage); }
    catch (cause) { fail(cause); try { setDraft(ref.current.review(draft.id)); } catch { reset(); setError('This analysis expired. Select your documents again.'); } }
  };
  const demo = async () => {
    reset(); const token = generation.current; setBusy(true);
    try {
      const session = newSession(true); ref.current = session;
      const review = await session.prepare([{ name: 'synthetic-demo.csv', bytes: new TextEncoder().encode(demoCsv) }]);
      if (token === generation.current) { setDraft(review); setResult(session.complete(review.id, {})); }
    } catch (cause) { if (token === generation.current) fail(cause); }
    finally { if (token === generation.current) setBusy(false); }
  };
  const simulate = (actions: CostAction[], currency: string, implementationCost: string) => {
    if (!draft || !ref.current) return false; setError(''); setScenario(null);
    try { setScenario(ref.current.simulate(draft.id, actions, { currency, implementationCost })); return true; } catch (cause) { fail(cause); return false; }
  };
  const download = (format: 'json' | 'csv') => {
    if (!draft || !ref.current) return;
    try { const content = ref.current.report(draft.id, format); const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `costsieve-report.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (cause) { fail(cause); }
  };
  return <Context.Provider value={{ draft, result, scenario, controls, setControls, reviewControls, setReviewControls, usageAnswers, busy, progress, error, prepare, complete, reset, demo, simulate, download }}>{children}</Context.Provider>;
}
export function useAnalysis() { const value = useContext(Context); if (!value) throw new Error('Analysis context is unavailable.'); return value; }
