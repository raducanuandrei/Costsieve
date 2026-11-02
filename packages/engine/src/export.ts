import Papa from 'papaparse';
import type { BusinessReport, MoneyTotals } from './types.ts';
import type { ScenarioResult } from './scenario.ts';
import type { BusinessAnalysis, simulateActions } from './actions.ts';

function safeText(value: string): string {
  return /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}

export function exportSummaryCsv(report: BusinessReport, scenario?: ScenarioResult): string {
  const records: { dimension: string; label: string; currency: string; metric: string; value: string; classification: string }[] = [];
  const add = (dimension: string, label: string, currency: string, metric: string, value: string, classification = 'MEASURED') => {
    records.push({ dimension, label: safeText(label), currency: safeText(currency), metric, value: /^-?\d+(?:\.\d+)?$/.test(value) ? value : safeText(value), classification });
  };
  const metrics: (keyof MoneyTotals)[] = ['grossExpense', 'expenseRefunds', 'netExpense', 'grossRevenue', 'revenueRefunds', 'netRevenue', 'recordedSurplus', 'transfers'];
  for (const row of report.currencies) for (const metric of metrics) add('currency', row.currency, row.currency, metric, row[metric]);
  for (const [dimension, rows] of [['vendor', report.byVendor], ['category', report.byCategory], ['month', report.byMonth]] as const) {
    for (const row of rows) for (const metric of metrics) add(dimension, row.key, row.currency, metric, row[metric]);
  }
  for (const row of report.monthlyChanges) {
    add('monthly_change', `${row.previousMonth} -> ${row.month}`, row.currency, 'delta', row.delta);
    add('monthly_change', `${row.previousMonth} -> ${row.month}`, row.currency, 'changePercent', row.changePercent ?? 'undefined: nonpositive baseline');
  }
  for (const row of report.subscriptions.byCurrency) {
    add('subscription_inventory', row.currency, row.currency, 'monthlyCommitment', row.monthlyCommitment, 'ESTIMATED');
    add('subscription_inventory', row.currency, row.currency, 'estimatedUnusedSeatCost', row.estimatedUnusedSeatCost, 'ESTIMATED');
    add('subscription_inventory', row.currency, row.currency, 'entriesMissingUsage', String(row.entriesMissingUsage));
  }
  for (const finding of report.findings) {
    add('finding', finding.vendor, finding.currency, finding.kind, finding.explanation, finding.classification);
    if (finding.observedAmount !== null) add('finding', finding.vendor, finding.currency, 'observedAmount', finding.observedAmount, 'MEASURED');
    if (finding.estimatedMonthlyOpportunity !== null) add('finding', finding.vendor, finding.currency, 'estimatedMonthlyOpportunity', finding.estimatedMonthlyOpportunity, 'ESTIMATED');
    add('finding', finding.vendor, finding.currency, 'evidenceRows', `${finding.evidenceSource}: ${finding.evidenceRows.join(', ')}`, finding.classification);
    if (finding.evidence) add('finding', finding.vendor, finding.currency, 'evidenceSources', JSON.stringify(finding.evidence), finding.classification);
    add('finding', finding.vendor, finding.currency, 'caveat', finding.caveat, finding.classification);
  }
  for (const [metric, value] of Object.entries({ schemaVersion: report.schemaVersion, dataOrigin: report.dataOrigin, reviewStatus: report.reviewStatus, generatedAt: report.generatedAt, status: report.status, timezone: report.period.timezone, firstTransaction: report.period.firstTransaction, lastTransaction: report.period.lastTransaction, observationStart: report.period.observationStart ?? 'not declared', observationEnd: report.period.observationEnd ?? 'not declared', currencyPolicy: report.currencyPolicy, totalRows: String(report.coverage.totalRows), validRows: String(report.coverage.validRows), excludedRows: String(report.coverage.excludedRows), subscriptionTotalRows: String(report.subscriptions.coverage.totalRows), subscriptionValidRows: String(report.subscriptions.coverage.validRows), subscriptionExcludedRows: String(report.subscriptions.coverage.excludedRows) })) add('metadata', 'report', '', metric, value);
  report.limitations.forEach((text, index) => add('limitation', String(index + 1), '', 'assumption', text));
  for (const issue of report.coverage.issues) add('import_issue', String(issue.row ?? 'file'), '', issue.code, issue.message);
  for (const issue of report.subscriptions.coverage.issues) add('subscription_import_issue', String(issue.row ?? 'file'), '', issue.code, issue.message);
  if (scenario) {
    for (const metric of ['baselineExpense', 'observedExpenseRefunds', 'projectedExpense', 'hypotheticalSavings', 'implementationCost', 'netBenefit', 'basis'] as const) add('scenario', 'combined', scenario.currency, metric, scenario[metric], 'HYPOTHETICAL');
    for (const effect of scenario.effects) {
      for (const metric of ['reductionPercent', 'independentSavings', 'incrementalSavings'] as const) add('scenario_change', effect.id, scenario.currency, metric, effect[metric], 'HYPOTHETICAL');
    }
    for (const change of scenario.assumptions) {
      add('scenario_change', change.id, scenario.currency, 'vendor', change.vendor ?? '(not filtered)', 'HYPOTHETICAL');
      add('scenario_change', change.id, scenario.currency, 'category', change.category ?? '(not filtered)', 'HYPOTHETICAL');
      add('scenario_change', change.id, scenario.currency, 'allExpenses', String(change.allExpenses ?? false), 'HYPOTHETICAL');
    }
    scenario.caveats.forEach((text, index) => add('scenario_caveat', String(index + 1), scenario.currency, 'assumption', text, 'HYPOTHETICAL'));
  }
  return Papa.unparse(records, { newline: '\r\n', columns: ['dimension', 'label', 'currency', 'metric', 'value', 'classification'] });
}

export function exportReportJson(report: BusinessReport, scenario?: ScenarioResult): string {
  return JSON.stringify(scenario ? { ...report, scenario } : report, null, 2);
}

export function exportAnalysisCsv(analysis: BusinessAnalysis, scenario?: ReturnType<typeof simulateActions>): string {
  const records: { dimension: string; label: string; currency: string; metric: string; value: string; classification: string }[] = [];
  for (const item of analysis.recommendations) {
    const values = { explanation: item.explanation, caveat: item.caveat, period: `${item.period.from} to ${item.period.to}`, targets: item.targetRecordIds.join(', '), ...(item.estimatedSavings !== null ? { estimatedSavings: item.estimatedSavings } : {}) };
    for (const [metric, value] of Object.entries(values)) records.push({ dimension: 'recommendation', label: safeText(item.id), currency: item.currency, metric, value: safeText(value), classification: item.estimatedSavings === null ? 'MEASURED' : 'ESTIMATED' });
  }
  if (scenario) for (const metric of ['baselineExpense', 'projectedExpense', 'hypotheticalSavings', 'implementationCost', 'netBenefit', 'recordedResultBefore', 'recordedResultAfter', 'basis', 'assumptions'] as const) {
    const value = scenario[metric];
    if (value !== null) records.push({ dimension: 'scenario', label: 'selected actions', currency: scenario.currency, metric, value: /^-?\d+(?:\.\d+)?$/.test(value) ? value : safeText(value), classification: 'HYPOTHETICAL' });
  }
  if (scenario) records.push({ dimension: 'scenario', label: 'selected actions', currency: scenario.currency, metric: 'period', value: `${scenario.period.from} to ${scenario.period.to}`, classification: 'HYPOTHETICAL' });
  if (!records.length) return exportSummaryCsv(analysis.report);
  const appended = Papa.unparse(records, { header: false, newline: '\r\n', columns: ['dimension', 'label', 'currency', 'metric', 'value', 'classification'] });
  return `${exportSummaryCsv(analysis.report)}\r\n${appended}`;
}
