import Papa from 'papaparse';
import { parseDay, parseMagnitude } from './money.ts';
import type { ColumnMapping, ImportIssue, ImportResult, LedgerRow, Subscription, TransactionKind } from './types.ts';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 100_000;
const ledgerFields = ['date', 'vendor', 'category', 'amount', 'currency', 'kind'] as const;
const subscriptionFields = ['subscription_id', 'vendor', 'currency', 'amount_per_cycle', 'billing_cycle'] as const;
const kinds = new Set<TransactionKind>(['expense', 'revenue', 'expense_refund', 'revenue_refund', 'transfer']);

export function inspectCsv(text: string): { headers: string[]; records: string[][]; recordNumbers: number[]; errors: ImportIssue[] } {
  const fail = (code: string, message: string) => ({ headers: [], records: [], recordNumbers: [], errors: [{ row: null, code, message }] });
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) return fail('FILE_TOO_LARGE', 'CSV exceeds the 20 MB limit.');
  let headers: string[] = [], logicalRecord = 0, malformed = false, tooMany = false;
  const records: string[][] = [], recordNumbers: number[] = [];
  Papa.parse<string[]>(text, { delimiter: ',', skipEmptyLines: false, step(result, parser) {
    logicalRecord++;
    if (result.errors.length) { malformed = true; parser.abort(); return; }
    if (result.data.every(value => !value.trim())) return;
    if (!headers.length) { headers = result.data.map(value => value.trim()); return; }
    records.push(result.data); recordNumbers.push(logicalRecord);
    if (records.length > MAX_ROWS) { tooMany = true; parser.abort(); }
  } });
  if (malformed) return fail('MALFORMED_CSV', 'CSV quoting or structure is invalid. Check the export and try again.');
  if (tooMany) return fail('TOO_MANY_ROWS', 'CSV exceeds the 100,000-row limit.');
  if (!headers.length || headers.some(value => !value) || new Set(headers).size !== headers.length) return fail('INVALID_HEADERS', 'CSV requires unique, nonempty column headers.');
  return { headers, records, recordNumbers, errors: [] };
}

function required(value: string, field: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${field} is required.`);
  if (result.length > 500) throw new Error(`${field} must be at most 500 characters.`);
  return result;
}

function currency(value: string): string {
  const result = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new Error('Currency must be an explicit three-letter code; currencies are not converted.');
  return result;
}

function importTable<T>(text: string, fields: readonly string[], format: ImportResult<T>['format'], normalize: (get: (field: string) => string, row: number) => T, mapping: Record<string, string> = {}): ImportResult<T> {
  const parsed = inspectCsv(text);
  const result: ImportResult<T> = { rows: [], totalRows: parsed.records.length, errors: parsed.errors, format };
  if (result.errors.length) return result;
  const index = new Map(parsed.headers.map((header, i) => [header, i]));
  const mapped = fields.map(field => mapping[field] ?? field);
  const explicitMappings = Object.values(mapping);
  if (new Set(mapped).size !== mapped.length || mapped.some(field => !index.has(field)) || explicitMappings.some(field => !index.has(field))) {
    result.errors.push({ row: null, code: 'MISSING_COLUMNS', message: `Map distinct columns for: ${fields.join(', ')}.` });
    return result;
  }
  for (let i = 0; i < parsed.records.length; i++) {
    const record = parsed.records[i]!;
    const row = parsed.recordNumbers[i]!;
    if (record.length !== parsed.headers.length) {
      result.errors.push({ row, code: 'INVALID_ROW', message: 'Record has a different number of fields from the header.' });
      continue;
    }
    const get = (field: string) => record[index.get(mapping[field] ?? field) ?? -1] ?? '';
    try {
      result.rows.push(normalize(get, row));
    } catch (error) {
      result.errors.push({ row, code: 'INVALID_ROW', message: error instanceof Error ? error.message : 'Invalid record.' });
    }
  }
  return result;
}

export function importLedgerCsv(text: string, mapping: ColumnMapping = {}): ImportResult<LedgerRow> {
  const ids = new Set<string>();
  const result = importTable<LedgerRow>(text, ledgerFields, 'costsieve-ledger-v1', (get, sourceRow) => {
    const transactionId = get('transaction_id').trim();
    const kind = get('kind').trim() as TransactionKind;
    if (!kinds.has(kind)) throw new Error('kind must be expense, revenue, expense_refund, revenue_refund or transfer.');
    const row: LedgerRow = {
      sourceRow, date: parseDay(get('date')), vendor: required(get('vendor'), 'vendor'),
      category: get('category').trim() ? required(get('category'), 'category') : 'Uncategorized',
      amount: parseMagnitude(get('amount')), currency: currency(get('currency')), kind,
    };
    if (transactionId) {
      if (ids.has(transactionId)) throw new Error('DUPLICATE_ID');
      row.transactionId = required(transactionId, 'transaction_id');
    }
    const description = get('description').trim();
    if (description) row.description = required(description, 'description');
    if (transactionId) ids.add(transactionId);
    return row;
  }, mapping);
  for (const error of result.errors) {
    if (error.message === 'DUPLICATE_ID') { error.code = 'DUPLICATE_ID'; error.message = 'Repeated transaction ID excluded. Review the source records; no duplicate saving is assumed.'; }
  }
  return result;
}

export function importSubscriptionsCsv(text: string): ImportResult<Subscription> {
  const ids = new Set<string>();
  return importTable<Subscription>(text, subscriptionFields, 'costsieve-subscriptions-v1', (get, sourceRow) => {
    const subscriptionId = required(get('subscription_id'), 'subscription_id');
    if (ids.has(subscriptionId)) throw new Error('Repeated subscription ID; inventory entry excluded.');
    const billingCycle = get('billing_cycle').trim();
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') throw new Error('billing_cycle must be monthly or annual.');
    const row: Subscription = { sourceRow, subscriptionId, vendor: required(get('vendor'), 'vendor'), currency: currency(get('currency')), amountPerCycle: parseMagnitude(get('amount_per_cycle')), billingCycle };
    const seatsText = get('seats').trim();
    const activeText = get('active_seats').trim();
    if (Boolean(seatsText) !== Boolean(activeText)) throw new Error('Provide both seats and active_seats, or neither.');
    if (seatsText && activeText) {
      if (!/^\d+$/.test(seatsText) || !/^\d+$/.test(activeText)) throw new Error('Seat counts must be whole nonnegative integers.');
      const seats = Number(seatsText), active = Number(activeText);
      if (!Number.isSafeInteger(seats) || seats < 1 || !Number.isSafeInteger(active) || active < 0 || active > seats) throw new Error('seats must be positive and active_seats cannot exceed seats.');
      row.seats = seats; row.activeSeats = active;
    }
    ids.add(subscriptionId);
    return row;
  });
}
