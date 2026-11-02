import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importLedgerCsv, importSubscriptionsCsv, analyzeBusiness, simulateScenario, exportReportJson, exportSummaryCsv } from './index.ts';
import type { AnalysisOptions, ColumnMapping, LedgerColumn, ScenarioOptions, ScenarioResult } from './index.ts';

const help = `CostSieve — free, local business spending analysis

  node dist/src/cli.js --demo
  node dist/src/cli.js --ledger ledger.csv [--subscriptions subscriptions.csv]
    [--mapping columns.json] [--scenario assumptions.json]
    [--observation-start YYYY-MM-DD --observation-end YYYY-MM-DD]
    [--allow-partial] [--json report.json] [--csv summary.csv]

CSV data stays on this computer. Reports are written only when requested.
Existing output files are never overwritten. All recommendations require review.
The demo is synthetic. CostSieve does not guarantee savings or extra revenue.
`;

function textFile(path: string | URL, maxBytes = 20 * 1024 * 1024): string {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('Input must be a regular file within the size limit (20 MB CSV; 1 MB configuration).');
  return readFileSync(path, 'utf8');
}

function mappingFile(path: string): ColumnMapping {
  const value: unknown = JSON.parse(textFile(path, 1024 * 1024));
  const allowed: LedgerColumn[] = ['date', 'vendor', 'category', 'amount', 'currency', 'kind', 'transaction_id', 'description'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([key, header]) => !allowed.includes(key as LedgerColumn) || typeof header !== 'string' || !header.trim())) throw new Error('Mapping must contain documented canonical column names mapped to nonempty source header strings.');
  return value as ColumnMapping;
}

const terminal = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');

try {
  const { values } = parseArgs({ options: {
    help: { type: 'boolean' }, demo: { type: 'boolean' }, ledger: { type: 'string' }, subscriptions: { type: 'string' },
    mapping: { type: 'string' }, scenario: { type: 'string' }, json: { type: 'string' }, csv: { type: 'string' },
    'allow-partial': { type: 'boolean' }, 'observation-start': { type: 'string' }, 'observation-end': { type: 'string' },
  }, strict: true, allowPositionals: false });
  if (values.help) { console.log(help); process.exit(0); }
  if (Boolean(values.demo) === Boolean(values.ledger)) throw new Error('Choose either --demo or --ledger path. Use --help for input instructions.');
  if (values.demo && (values.subscriptions || values.mapping)) throw new Error('The synthetic demo uses its own inventory and canonical mapping. Use --ledger for your files.');
  const ledger = importLedgerCsv(values.demo ? textFile(new URL('../../fixtures/business-demo.csv', import.meta.url)) : textFile(values.ledger!), values.mapping ? mappingFile(values.mapping) : {});
  const subscriptions = values.demo ? importSubscriptionsCsv(textFile(new URL('../../fixtures/subscriptions-demo.csv', import.meta.url))) : values.subscriptions ? importSubscriptionsCsv(textFile(values.subscriptions)) : undefined;
  const options: AnalysisOptions = { allowPartial: values['allow-partial'] ?? false, dataOrigin: values.demo ? 'SYNTHETIC_DEMO' : 'USER_SUPPLIED' };
  if (subscriptions) options.subscriptions = subscriptions;
  if (values['observation-start']) options.observationStart = values['observation-start'];
  if (values['observation-end']) options.observationEnd = values['observation-end'];
  if (values.demo && !options.observationStart && !options.observationEnd) { options.observationStart = '2026-07-01'; options.observationEnd = '2026-09-30'; }
  const report = analyzeBusiness(ledger, options);
  let scenario: ScenarioResult | undefined;
  if (values.scenario) {
    const config: unknown = JSON.parse(textFile(values.scenario, 1024 * 1024));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Scenario configuration must be an object.');
    scenario = simulateScenario(ledger, { ...config, allowPartial: options.allowPartial } as ScenarioOptions);
  }
  const outputs = [values.json, values.csv].filter((value): value is string => Boolean(value)).map(path => resolve(path));
  if (new Set(outputs).size !== outputs.length || outputs.some(path => existsSync(path))) throw new Error('Output paths must be different and must not already exist. Choose new report filenames.');
  console.log(values.demo ? 'CostSieve — SYNTHETIC DEMO (not a real business audit)' : 'CostSieve — local business cost analysis');
  console.log(`${report.reviewStatus}\n${report.coverage.validRows}/${report.coverage.totalRows} ledger records included; ${report.coverage.excludedRows} excluded.`);
  console.log(`${report.period.firstTransaction} to ${report.period.lastTransaction}; dates grouped in UTC.`);
  console.log('\nRecorded amounts (currencies kept separate):');
  for (const row of report.currencies) console.log(`${row.currency}: net expenses ${row.netExpense}; net revenue ${row.netRevenue}; recorded surplus ${row.recordedSurplus}`);
  if (report.subscriptions.byCurrency.length) {
    console.log('\nSeparate subscription inventory — monthly equivalents, not added to ledger:');
    for (const row of report.subscriptions.byCurrency) console.log(`${row.currency}: commitment ${row.monthlyCommitment}; estimated unused-seat cost ${row.estimatedUnusedSeatCost}; ${row.entriesMissingUsage} entries without usage evidence.`);
  }
  console.log('\nReview candidates — no achieved savings assumed:');
  for (const finding of report.findings) console.log(`- ${finding.title}: ${terminal(finding.vendor)} (${finding.currency}; ${finding.evidenceSource} rows ${finding.evidenceRows.join(', ')})\n  ${finding.explanation}\n  ${finding.caveat}`);
  if (!report.findings.length) console.log('- No supported opportunity candidates in this input. This does not prove the absence of waste.');
  if (scenario) console.log(`\nHYPOTHETICAL scenario (${scenario.currency}): gross expenses ${scenario.baselineExpense} -> ${scenario.projectedExpense}; reduction ${scenario.hypotheticalSavings}; implementation cost ${scenario.implementationCost}; net benefit ${scenario.netBenefit}.\n${scenario.caveats.join('\n')}`);
  console.log('\nLimitations:');
  for (const limitation of report.limitations) console.log(`- ${limitation}`);
  for (const [path, content] of [[values.json, () => exportReportJson(report, scenario)], [values.csv, () => exportSummaryCsv(report, scenario)]] as const) {
    if (!path) continue;
    const absolute = resolve(path); mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${content()}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(`\nReport written locally: ${terminal(absolute)}`);
  }
} catch (error) {
  console.error(`CostSieve: ${terminal(error instanceof Error ? error.message : 'Analysis failed. Check your inputs.')}`);
  process.exitCode = 1;
}
