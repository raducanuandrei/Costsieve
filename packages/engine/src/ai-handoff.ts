import { getActionGuide } from './actions.ts';
import type { BusinessAnalysis, simulateActions } from './actions.ts';
import type { GroupSummary } from './types.ts';
import { d } from './money.ts';

export function createAiHandoff(analysis: BusinessAnalysis, options: { currency: string; includeLabels?: boolean; scenario?: ReturnType<typeof simulateActions> }) {
  const { report } = analysis;
  const totals = report.currencies.find(row => row.currency === options.currency);
  if (!totals || !/^[A-Z]{3}$/.test(options.currency)) throw new Error('Select an available report currency.');
  if (options.scenario && options.scenario.currency !== options.currency) throw new Error('Scenario currency must match the selected report currency.');
  const vendors = report.byVendor.filter(row => row.currency === options.currency);
  const categories = report.byCategory.filter(row => row.currency === options.currency);
  const recommendations = analysis.recommendations.filter(row => row.currency === options.currency);
  const groups = (rows: GroupSummary[], prefix: string) => [...rows]
    .sort((a, b) => d(b.grossExpense).comparedTo(d(a.grossExpense)) || a.key.localeCompare(b.key))
    .slice(0, 10).map((row, i) => ({ label: options.includeLabels ? row.key.slice(0, 200) : `${prefix} ${i + 1}`, grossExpense: row.grossExpense, expenseRefunds: row.expenseRefunds, netExpense: row.netExpense, records: row.rows }));
  const documents = new Map<string, string>();
  const sourceName = (id: string) => { if (!documents.has(id)) documents.set(id, `Document ${documents.size + 1}`); return documents.get(id)!; };
  const scenario = options.scenario;
  return {
    schemaVersion: 'costsieve-ai-handoff-v1' as const,
    dataOrigin: report.dataOrigin,
    generatedAt: report.generatedAt,
    currency: options.currency,
    period: { from: report.period.firstTransaction, to: report.period.lastTransaction, timezone: 'UTC' as const, basis: 'Date range of the supplied report across currencies; selected-currency activity may cover a shorter period.' },
    privacy: { labelsIncluded: Boolean(options.includeLabels), notice: 'Totals and dates remain sensitive even with names hidden. Original documents, filenames, transaction IDs and raw descriptions are excluded. Your chosen AI provider receives anything you share with it.' },
    coverage: { status: report.status, totalRows: report.coverage.totalRows, validRows: report.coverage.validRows, excludedRows: report.coverage.excludedRows, note: 'Coverage describes supplied records, not business completeness. Excluded or unreadable sources can contain unknown amounts.' },
    totals: { grossExpense: totals.grossExpense, expenseRefunds: totals.expenseRefunds, netExpense: totals.netExpense, netRevenue: totals.hasRevenue ? totals.netRevenue : null, recordedResult: totals.hasRevenue ? totals.recordedSurplus : null, excludedTransfers: totals.transfers },
    groups: { vendors: groups(vendors, 'Vendor'), categories: groups(categories, 'Category') },
    detailCounts: { vendors: vendors.length, categories: categories.length, opportunities: recommendations.length },
    detailLimits: 'Full selected-currency totals; at most 10 vendor groups, 10 categories, 10 opportunities and 5 source locators per opportunity. Omitted details are not zero spending. Document aliases are local to this snapshot and do not identify connected account records.',
    opportunities: recommendations.slice(0, 10).map((item, i) => ({
      id: `Opportunity ${i + 1}`, kind: item.kind, title: getActionGuide(item.kind).title,
      estimatedSavings: item.estimatedSavings, classification: item.estimatedSavings === null ? 'REVIEW_REQUIRED' : 'ESTIMATED',
      period: { from: item.period.from, to: item.period.to }, targetCount: item.targetRecordIds.length, evidenceCount: item.evidence.length,
      evidence: item.evidence.slice(0, 5).map(source => ({ document: sourceName(source.documentId), kind: source.kind, record: source.record, ...(source.page ? { page: source.page } : {}) })),
      guide: getActionGuide(item.kind),
    })),
    scenario: scenario ? {
      classification: scenario.classification, period: { from: scenario.period.from, to: scenario.period.to },
      baselineExpense: scenario.baselineExpense, projectedExpense: scenario.projectedExpense,
      hypotheticalSavings: scenario.hypotheticalSavings, implementationCost: scenario.implementationCost, netBenefit: scenario.netBenefit,
      recordedResultBefore: scenario.recordedResultBefore, recordedResultAfter: scenario.recordedResultAfter,
      actionCount: scenario.effects.length,
    } : null,
    assumptions: [
      'Recorded result is not audited profit. Missing revenue is unknown, not zero. Currencies are separate; amounts are exact decimal strings.',
      'Review candidates are not proven waste or money recovered. Source reconciliation is not a saving.',
      'The scenario is hypothetical for its imported period, with revenue unchanged and declared implementation cost included. Refunds are unallocated; do not count reductions on refunded purchases as recoverable cash.',
      'A partial or bounded snapshot cannot establish full business profitability, current supplier pricing, contract rights, task duration or actual service usage.',
    ],
  };
}

export type AiHandoff = ReturnType<typeof createAiHandoff>;
export function renderAiHandoff(handoff: AiHandoff): string {
  return JSON.stringify(handoff, null, 2).replace(/`/g, '\\u0060').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
