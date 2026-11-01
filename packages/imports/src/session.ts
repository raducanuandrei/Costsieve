import { analyzeRecords, inspectCsv, validateLedgerRows, simulateActions, getActionGuide, exportAnalysisCsv } from '@costsieve/engine';
import type { BusinessAnalysis, CostAction, NormalizedRecord, ImportResult, RecommendationKind } from '@costsieve/engine';
import { normalizeAmount, normalizeDate } from './invoice.ts';
import type { DocumentExtractor, FileOptions, Fields, InputDocument, ReviewDecision, ReviewDraft, ReviewRecord } from './types.ts';

const synonyms: Record<string, string[]> = { date: ['date', 'timestamp', 'data', 'dată'], vendor: ['vendor', 'supplier', 'payee', 'merchant', 'furnizor'], category: ['category', 'categorie'], amount: ['amount', 'cost', 'value', 'suma', 'sumă', 'valoare'], currency: ['currency', 'moneda', 'monedă', 'ccy'], kind: ['kind', 'type', 'tip'], transactionId: ['transaction_id', 'transactionid', 'id'] };
const abortError = () => new Error('Analysis cancelled or aborted.');
const copy = <T>(value: T): T => structuredClone(value);

function reconciliationGroups(records: ReviewRecord[]): ReviewDraft['reconciliations'] {
  const groups = new Map<string, ReviewRecord[]>();
  for (const record of records) {
    try {
      const normalized = validateLedgerRows([{ ...record.fields, recordId: record.recordId, source: record.source }]).rows[0]!;
      const key = JSON.stringify([normalized.vendor.toLowerCase(), normalized.currency, normalized.amount, normalized.kind]);
      const group = groups.get(key) ?? []; group.push(record); groups.set(key, group);
    } catch { /* Invalid fields remain in review and cannot form a financial match. */ }
  }
  return [...groups.values()].filter(group => group.length > 1 && group.some(record => ['pdf', 'image'].includes(record.source.kind)) && new Set(group.map(record => record.source.documentId)).size > 1).map(group => ({ id: `reconcile:${group[0]!.recordId}`, recordIds: group.map(record => record.recordId), reason: 'The same vendor, currency, amount and direction appear in an invoice and another document. Confirm whether they represent the same purchase; dates alone do not prove a match.' }));
}

export class AnalysisSession {
  private state: { draft: ReviewDraft; touched: number; decision?: ReviewDecision; input?: ImportResult<NormalizedRecord>; result?: ReturnType<AnalysisSession['buildResult']> } | undefined;
  private generation = 0;
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly config: { extractor?: DocumentExtractor; now?: () => number; ttlMs?: number };
  constructor(config: { extractor?: DocumentExtractor; now?: () => number; ttlMs?: number } = {}) { this.config = config; }
  private clock() { return this.config.now?.() ?? Date.now(); }
  private touch() {
    if (!this.state) return;
    this.state.touched = this.clock();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.clear(), this.config.ttlMs ?? 30 * 60 * 1000);
    this.timer.unref?.();
  }
  private active(id: string) {
    if (this.state && this.clock() - this.state.touched >= (this.config.ttlMs ?? 30 * 60 * 1000)) this.clear();
    if (!this.state || this.state.draft.id !== id) throw new Error('No matching active analysis: cleared or expired. Prepare the documents again.');
    this.touch(); return this.state;
  }
  clear(id?: string) {
    if (id !== undefined && this.state?.draft.id !== id) throw new Error('No matching active analysis.');
    this.generation++; this.controller?.abort(); this.controller = undefined; this.state = undefined;
    if (this.timer) clearTimeout(this.timer); this.timer = undefined;
  }
  review(id: string) { return copy(this.active(id).draft); }

  async prepare(files: InputDocument[], options: { signal?: AbortSignal; fileOptions?: Record<string, FileOptions>; onProgress?: (event: { documentId: string; stage: string; progress: number }) => void } = {}) {
    this.clear();
    if (!Array.isArray(files) || files.length < 1 || files.length > 20) throw new Error('Select between 1 and 20 files.');
    if (files.some(file => !(file.bytes instanceof Uint8Array) || file.bytes.length > 20 * 1024 * 1024)) throw new Error('Each file must be at most 20 MiB.');
    if (files.reduce((sum, file) => sum + file.bytes.length, 0) > 50 * 1024 * 1024) throw new Error('Combined input exceeds 50 MiB.');
    const generation = this.generation;
    this.controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, this.controller.signal]) : this.controller.signal;
    const check = () => { if (signal.aborted || generation !== this.generation) throw abortError(); };
    check();
    const draft: ReviewDraft = { id: crypto.randomUUID(), documents: [], records: [], reconciliations: [] };
    let ocrPages = 0;
    for (const file of files) {
      check();
      const documentId = crypto.randomUUID();
      const extension = file.name.split('.').at(-1)?.toLowerCase();
      const kind = extension === 'csv' ? 'csv' : extension === 'xlsx' ? 'xlsx' : extension === 'pdf' ? 'pdf' : 'image';
      const document = { id: documentId, name: file.name, kind: kind as ReviewRecord['source']['kind'], issues: [] as string[] };
      draft.documents.push(document);
      try {
        if (!['csv', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg'].includes(extension ?? '')) throw new Error('Supported inputs: CSV, .xlsx, PDF, JPG and PNG. Re-save .xls/.xlsm as .xlsx or CSV.');
        const fileOptions = options.fileOptions?.[file.name] ?? {};
        const progress = (event: { stage: string; progress: number }) => { if (!signal.aborted && generation === this.generation) options.onProgress?.({ documentId, ...event }); };
        let extracted;
        if (kind === 'csv') {
          const parsed = inspectCsv(new TextDecoder('utf-8', { fatal: true }).decode(file.bytes));
          if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
          extracted = { kind: 'table' as const, ...parsed };
        } else {
          if (!this.config.extractor) throw new Error('Configure the browser or Node document extractor for Excel/PDF/images.');
          extracted = await this.config.extractor(file, { signal, fileOptions, onProgress: progress, consumeOcrPage() { if (++ocrPages > 50) throw new Error('Batch exceeds the 50 OCR-page limit.'); } });
        }
        check();
        if (extracted.kind === 'invoice') {
          if (extracted.pages > 20) throw new Error('PDF exceeds the 20-page limit.');
          const fields: Fields = { ...extracted.fields };
          if (fileOptions.kind) fields.kind = fileOptions.kind;
          draft.records.push({ recordId: `${documentId}:1`, source: { documentId, kind, record: 1, page: 1 }, fields, requiresConfirmation: true, issues: [] });
        } else {
          const headers = extracted.headers.map(header => header.trim());
          if (!headers.length || headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('Column headers must be unique and nonempty.');
          const indices = new Map<string, number>();
          for (const [field, names] of Object.entries(synonyms)) {
            const explicit = fileOptions.mapping?.[field];
            const matches = headers.map((name, index) => ({ name, index })).filter(({ name }) => explicit ? name === explicit : names.includes(name.toLowerCase()));
            if (matches.length > 1 || (explicit && matches.length !== 1)) throw new Error(`Confirm a unique column mapping for ${field}. Available headers: ${headers.join(', ')}.`);
            if (matches[0]) indices.set(field, matches[0].index);
          }
          if (new Set(indices.values()).size !== indices.size) throw new Error('Do not map the same column to multiple fields.');
          for (let i = 0; i < extracted.records.length; i++) {
            const row = extracted.records[i]!, fields: Fields = {};
            for (const [field, index] of indices) {
              const value = row[index];
              fields[field as keyof Fields] = value instanceof Date ? value.toISOString().slice(0, 10) : value === null || value === undefined ? '' : String(value).trim();
            }
            if (fileOptions.kind) fields.kind = fileOptions.kind;
            if (fields.amount !== undefined) fields.amount = normalizeAmount(fields.amount, fileOptions.decimalSeparator);
            if (fields.date !== undefined) fields.date = normalizeDate(fields.date, fileOptions.dateOrder);
            const source: ReviewRecord['source'] = { documentId, kind, record: extracted.recordNumbers[i] ?? i + 2 };
            if (extracted.sheet) source.sheet = extracted.sheet;
            draft.records.push({ recordId: `${documentId}:${source.record}`, source, fields, requiresConfirmation: false, issues: row.length !== headers.length ? ['Record length differs from the selected headers.'] : [] });
          }
        }
        if (draft.records.length > 100_000) throw new Error('Combined input exceeds the 100,000-record limit.');
        for (const record of draft.records.filter(record => record.source.documentId === documentId)) {
          try { validateLedgerRows([{ ...record.fields, recordId: record.recordId, source: record.source }]); }
          catch (error) { record.issues.push(error instanceof Error ? error.message : 'Invalid fields.'); }
        }
        progress({ stage: 'ready', progress: 1 });
      } catch (error) {
        check();
        if (draft.records.length > 100_000) throw error;
        draft.records = draft.records.filter(record => record.source.documentId !== documentId);
        document.issues.push(error instanceof Error ? error.message : 'Unable to extract this file.');
      }
    }
    check();
    draft.reconciliations = reconciliationGroups(draft.records);
    this.state = { draft, touched: this.clock() }; this.touch();
    return copy(draft);
  }

  private buildResult(input: ImportResult<NormalizedRecord>, decision: ReviewDecision, coverage: { totalRecords: number; confirmedRecords: number; excludedRecords: number; reconciledRecords: number; excludedDocuments: number }) {
    const analysis = analyzeRecords(input, { usage: decision.usage ?? [] });
    const partial = Boolean(coverage.excludedRecords || coverage.excludedDocuments);
    analysis.report.status = partial ? 'partial' : 'complete';
    analysis.report.coverage = { totalRows: coverage.totalRecords - coverage.reconciledRecords, validRows: coverage.confirmedRecords, excludedRows: coverage.excludedRecords, issues: partial ? [{ row: null, code: 'EXPLICIT_EXCLUSIONS', message: `${coverage.excludedRecords} records and ${coverage.excludedDocuments} documents explicitly excluded. Unreadable documents may contain additional unknown amounts.` }] : [] };
    if (partial) analysis.report.limitations.push('This analysis excludes explicitly selected records/documents. Missing amounts remain unknown; reported totals are partial.');
    return { analysis, coverage, status: partial ? 'partial' : 'complete', warning: 'Confirmed document reconciliation changes data coverage, not money saved. Results depend on the completeness and accounting basis of the supplied records.' };
  }

  complete(id: string, incoming: ReviewDecision) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || Object.keys(incoming).some(key => !['confirmedRecordIds', 'excludedRecordIds', 'excludedDocumentIds', 'corrections', 'reconciliations', 'separatePurchaseGroups', 'usage'].includes(key))) throw new Error('Unsupported review decision fields.');
    const state = this.active(id), decision: ReviewDecision = { ...state.decision, ...incoming };
    const byId = new Map(state.draft.records.map(record => [record.recordId, copy(record)]));
    const exclude = new Set(decision.excludedRecordIds ?? []), documents = new Set(decision.excludedDocumentIds ?? []), confirmed = new Set(decision.confirmedRecordIds ?? []);
    for (const recordId of [...exclude, ...confirmed]) if (!byId.has(recordId)) throw new Error('Decision references an unknown record.');
    for (const documentId of documents) if (!state.draft.documents.some(document => document.id === documentId)) throw new Error('Decision references an unknown document.');
    for (const document of state.draft.documents) if (document.issues.length && !documents.has(document.id)) throw new Error('Correct or explicitly exclude files with extraction errors.');
    for (const correction of decision.corrections ?? []) {
      const record = byId.get(correction.recordId); if (!record) throw new Error('Correction references an unknown record.');
      if (!correction.fields || Object.keys(correction.fields).some(field => !Object.hasOwn(synonyms, field))) throw new Error('Correction includes unsupported fields.');
      record.fields = { ...record.fields, ...correction.fields }; record.issues = [];
    }
    state.draft.records = copy([...byId.values()]);
    state.draft.reconciliations = reconciliationGroups(state.draft.records);
    if (decision.corrections?.length) { delete state.input; delete state.result; }
    const reconciled = new Set<string>();
    const kept = new Set<string>();
    for (const link of decision.reconciliations ?? []) {
      if (!byId.has(link.keepRecordId) || !link.excludeRecordIds.length || link.excludeRecordIds.includes(link.keepRecordId)) throw new Error('Invalid reconciliation selection.');
      if (exclude.has(link.keepRecordId) || documents.has(byId.get(link.keepRecordId)!.source.documentId) || link.excludeRecordIds.some(recordId => kept.has(recordId))) throw new Error('Reconciliation must keep an included record and cannot exclude another explicitly kept record.');
      const group = state.draft.reconciliations.find(group => group.recordIds.includes(link.keepRecordId) && link.excludeRecordIds.every(recordId => group.recordIds.includes(recordId)));
      if (!group) throw new Error('Reconciliation must refer to a proposed source group.');
      kept.add(link.keepRecordId);
      for (const recordId of link.excludeRecordIds) { exclude.add(recordId); reconciled.add(recordId); }
    }
    for (const group of state.draft.reconciliations) {
      const remaining = group.recordIds.filter(recordId => !exclude.has(recordId) && !documents.has(byId.get(recordId)!.source.documentId));
      if (remaining.length > 1 && !decision.separatePurchaseGroups?.includes(group.id)) throw new Error('Confirm invoice/payment reconciliation or explicitly confirm separate purchases before analysis.');
    }
    const rows: unknown[] = [];
    for (const record of byId.values()) {
      if (exclude.has(record.recordId) || documents.has(record.source.documentId)) continue;
      if (record.requiresConfirmation && !confirmed.has(record.recordId)) throw new Error('Confirm extracted invoice fields before including the invoice.');
      if (record.issues.length) throw new Error('Correct invalid fields or explicitly exclude the affected record.');
      rows.push({ ...record.fields, recordId: record.recordId, source: record.source });
    }
    if (!rows.length) throw new Error('No confirmed valid records remain.');
    const input = validateLedgerRows(rows);
    const coverage = { totalRecords: state.draft.records.length, confirmedRecords: input.rows.length, excludedRecords: state.draft.records.length - input.rows.length - reconciled.size, reconciledRecords: reconciled.size, excludedDocuments: documents.size };
    const result = this.buildResult(input, decision, coverage);
    state.input = input; state.result = result; state.decision = copy(decision);
    return copy(result);
  }
  result(id: string) { const state = this.active(id); if (!state.result) throw new Error('Complete and confirm the analysis first.'); return copy(state.result); }
  simulate(id: string, actions: CostAction[], options: { currency: string; implementationCost?: string }) { const state = this.active(id); if (!state.input) throw new Error('Confirm the analysis first.'); return simulateActions(state.input, actions, options); }
  guide(id: string, recommendationId: string) { const result = this.result(id); const item = result.analysis.recommendations.find(item => item.id === recommendationId); if (!item) throw new Error('Unknown recommendation.'); return getActionGuide(item.kind as RecommendationKind); }
  report(id: string, format: 'json' | 'csv') { const result = this.result(id); return format === 'csv' ? exportAnalysisCsv(result.analysis) : JSON.stringify(result, null, 2); }
}
