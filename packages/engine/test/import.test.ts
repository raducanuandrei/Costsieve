import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importLedgerCsv, importSubscriptionsCsv } from '../src/import.ts';

const header = 'date,vendor,category,amount,currency,kind,transaction_id';
const csv = (rows: string[]) => [header, ...rows].join('\n');

test('imports exact decimal magnitudes, explicit directions and quoted multiline values', () => {
  const result = importLedgerCsv(csv([
    '2026-09-01,"Tools, Inc",software,0.100000000001,USD,expense,01',
    '2026-09-02,"Two\nLines",sales,20,EUR,revenue,02',
    '2026-09-03,Tools,software,5,USD,expense_refund,03',
    '2026-09-04,Bank,internal,100,USD,transfer,04',
  ]));
  assert.equal(result.rows.length, 4);
  assert.equal(result.rows[0]?.amount, '0.100000000001');
  assert.equal(result.rows[0]?.transactionId, '01');
  assert.equal(result.rows[1]?.vendor, 'Two\nLines');
  assert.equal(result.rows[2]?.kind, 'expense_refund');
  assert.deepEqual(result.errors, []);
});

test('maps supplied headers and normalizes offset-qualified timestamps to UTC', () => {
  const result = importLedgerCsv('When,Who,Group,Value,CCY,Direction\n2026-10-01T00:30:00+03:00,Acme,tools,10,usd,expense', {
    date: 'When', vendor: 'Who', category: 'Group', amount: 'Value', currency: 'CCY', kind: 'Direction',
  });
  assert.equal(result.rows[0]?.date, '2026-09-30');
  assert.equal(result.rows[0]?.currency, 'USD');
});

test('rejects invalid dates, ambiguous numbers, bad currency and unknown direction without silently dropping them', () => {
  const result = importLedgerCsv(csv([
    '2026-02-30,A,x,10,USD,expense,1',
    '2026-01-01T12:00:00,A,x,10,USD,expense,2',
    '2026-01-01,A,x,-1,USD,expense,3',
    '2026-01-01,A,x,1e3,USD,expense,4',
    '2026-01-01,A,x,0.0000000000001,USD,expense,5',
    '2026-01-01,A,x,1000000000000000,USD,expense,6',
    '2026-01-01,A,x,10,US,expense,7',
    '2026-01-01,A,x,10,USD,other,8',
    '2026-01-01,A,x,0,USD,expense,9',
  ]));
  assert.equal(result.totalRows, 9);
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 8);
  assert.equal(result.rows[0]?.amount, '0');
});

test('blocks malformed/ambiguous headers and incomplete CSV records', () => {
  for (const text of ['', 'date,date\n1,2', 'date,,amount\n1,x,2', 'date,vendor\n2026-01-01,A', `${header}\n2026-01-01,"open`]) {
    const result = importLedgerCsv(text);
    assert.ok(result.errors.length > 0);
    assert.equal(result.rows.length, 0);
  }
});

test('excludes repeated IDs for review and protects prototype-like vendor/category labels', () => {
  const result = importLedgerCsv(csv([
    '2026-01-01,__proto__,constructor,10,USD,expense,001',
    '2026-01-02,A,tools,20,USD,expense,001',
  ]));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.vendor, '__proto__');
  assert.equal(result.errors[0]?.code, 'DUPLICATE_ID');
});

test('rejects oversized input before parsing', () => {
  const result = importLedgerCsv('x'.repeat(20 * 1024 * 1024 + 1));
  assert.equal(result.errors[0]?.code, 'FILE_TOO_LARGE');
});

test('validates subscription inventory and requires actual seat evidence', () => {
  const result = importSubscriptionsCsv('subscription_id,vendor,currency,amount_per_cycle,billing_cycle,seats,active_seats\na,Tool,USD,120,monthly,10,4\nb,Annual,EUR,1200,annual,,\nc,Bad,USD,20,monthly,2,3\na,Duplicate,USD,1,monthly,1,0');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.activeSeats, 4);
  assert.equal(result.rows[1]?.seats, undefined);
  assert.equal(result.errors.length, 2);
});

test('does not reserve a transaction ID from a rejected row and rejects broken explicit mappings', () => {
  const result = importLedgerCsv(`${header},description\n2026-01-01,A,x,10,USD,expense,retry,${'x'.repeat(501)}\n2026-01-02,A,x,20,USD,expense,retry,valid`);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.amount, '20');
  assert.equal(result.errors.length, 1);
  const badMapping = importLedgerCsv(csv(['2026-01-01,A,x,10,USD,expense,1']), { transaction_id: 'missing-id-column' });
  assert.equal(badMapping.rows.length, 0);
  assert.ok(badMapping.errors.length > 0);
});

test('bounds row counts and detects UTF-8 size beyond the character count', () => {
  assert.equal(importLedgerCsv(`${header}\n${'2026-01-01,A,x,1,USD,expense,\n'.repeat(100_001)}`).errors[0]?.code, 'TOO_MANY_ROWS');
  assert.equal(importLedgerCsv('€'.repeat(8 * 1024 * 1024)).errors[0]?.code, 'FILE_TOO_LARGE');
});

test('preserves logical CSV record numbers across blank records and multiline fields', () => {
  const result = importLedgerCsv(`${header}\n\n2026-01-01,"Two\nLines",x,10,USD,expense,1\n\n2026-01-02,A,x,20,USD,expense,2\n`);
  assert.equal(result.totalRows, 2);
  assert.deepEqual(result.rows.map(row => row.sourceRow), [3, 5]);
});
