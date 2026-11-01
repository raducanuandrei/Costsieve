import type { SourceRef, UsageAnswer } from '@costsieve/engine';

export type Fields = Partial<Record<'date' | 'vendor' | 'category' | 'amount' | 'currency' | 'kind' | 'transactionId', string>>;
export interface InputDocument { name: string; bytes: Uint8Array }
export interface FileOptions { sheet?: string; mapping?: Record<string, string>; decimalSeparator?: '.' | ','; dateOrder?: 'DMY' | 'MDY'; kind?: 'expense' | 'revenue' | 'expense_refund' | 'revenue_refund' | 'transfer' }
export interface ExtractionOptions { signal: AbortSignal; fileOptions: FileOptions; onProgress: (progress: { stage: string; progress: number }) => void; consumeOcrPage: () => void }
export type ExtractedDocument = { kind: 'table'; headers: string[]; records: unknown[][]; recordNumbers: number[]; sheet?: string } | { kind: 'invoice'; fields: Fields; pages: number; method: 'pdf-text' | 'ocr' };
export type DocumentExtractor = (file: InputDocument, options: ExtractionOptions) => Promise<ExtractedDocument>;
export interface ReviewRecord { recordId: string; source: SourceRef; fields: Fields; requiresConfirmation: boolean; issues: string[] }
export interface ReviewDraft { id: string; documents: { id: string; name: string; kind: SourceRef['kind']; issues: string[] }[]; records: ReviewRecord[]; reconciliations: { id: string; recordIds: string[]; reason: string }[] }
export interface ReviewDecision {
  confirmedRecordIds?: string[];
  excludedRecordIds?: string[];
  excludedDocumentIds?: string[];
  corrections?: { recordId: string; fields: Fields }[];
  reconciliations?: { keepRecordId: string; excludeRecordIds: string[] }[];
  separatePurchaseGroups?: string[];
  usage?: UsageAnswer[];
}
