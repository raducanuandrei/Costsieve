export type TransactionKind = 'expense' | 'revenue' | 'expense_refund' | 'revenue_refund' | 'transfer';

export interface LedgerRow {
  sourceRow: number;
  date: string;
  vendor: string;
  category: string;
  amount: string;
  currency: string;
  kind: TransactionKind;
  transactionId?: string;
  description?: string;
}

export interface Subscription {
  sourceRow: number;
  subscriptionId: string;
  vendor: string;
  currency: string;
  amountPerCycle: string;
  billingCycle: 'monthly' | 'annual';
  seats?: number;
  activeSeats?: number;
}

export interface ImportIssue {
  row: number | null;
  code: string;
  message: string;
}

export interface ImportResult<T> {
  rows: T[];
  totalRows: number;
  errors: ImportIssue[];
  format: 'costsieve-ledger-v1' | 'costsieve-subscriptions-v1';
}

export type LedgerColumn = 'date' | 'vendor' | 'category' | 'amount' | 'currency' | 'kind' | 'transaction_id' | 'description';
export type ColumnMapping = Partial<Record<LedgerColumn, string>>;

export interface MoneyTotals {
  grossExpense: string;
  expenseRefunds: string;
  netExpense: string;
  grossRevenue: string;
  revenueRefunds: string;
  netRevenue: string;
  recordedSurplus: string;
  transfers: string;
}

export interface GroupSummary extends MoneyTotals { currency: string; key: string; rows: number }
export interface CurrencySummary extends MoneyTotals { currency: string; hasRevenue: boolean }

export interface Finding {
  id: string;
  kind: 'spend_concentration' | 'possible_duplicate' | 'recurring_charge' | 'unused_seats' | 'unknown_seat_usage';
  classification: 'MEASURED' | 'ESTIMATED';
  currency: string;
  vendor: string;
  title: string;
  evidenceRows: number[];
  evidenceSource: 'ledger' | 'subscription_inventory';
  observedAmount: string | null;
  estimatedMonthlyOpportunity: string | null;
  explanation: string;
  caveat: string;
  evidence?: import('./actions.ts').SourceRef[];
  targetRecordIds?: string[];
}

export interface BusinessReport {
  schemaVersion: 'costsieve-business-v1';
  dataOrigin: 'USER_SUPPLIED' | 'SYNTHETIC_DEMO';
  reviewStatus: 'DRAFT — human review required';
  generatedAt: string;
  status: 'complete' | 'partial';
  currencyPolicy: string;
  period: { firstTransaction: string; lastTransaction: string; observationStart: string | null; observationEnd: string | null; timezone: 'UTC' };
  coverage: { totalRows: number; validRows: number; excludedRows: number; issues: ImportIssue[] };
  currencies: CurrencySummary[];
  byVendor: GroupSummary[];
  byCategory: GroupSummary[];
  byMonth: GroupSummary[];
  monthlyChanges: { currency: string; previousMonth: string; month: string; previousExpense: string; expense: string; delta: string; changePercent: string | null }[];
  subscriptions: {
    coverage: { totalRows: number; validRows: number; excludedRows: number; issues: ImportIssue[] };
    byCurrency: { currency: string; monthlyCommitment: string; estimatedUnusedSeatCost: string; entriesMissingUsage: number }[];
  };
  findings: Finding[];
  limitations: string[];
}
