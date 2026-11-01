import type { Fields } from './types.ts';

export function normalizeAmount(value: string, separator?: '.' | ','): string {
  let text = value.trim();
  if (separator) {
    text = text.replace(/[\s\u00a0]/g, '');
    const pattern = separator === ',' ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,12})?$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,12})?$/;
    if (!pattern.test(text)) return text;
    text = separator === ',' ? text.replaceAll('.', '').replace(',', '.') : text.replaceAll(',', '');
  }
  return /^\d{1,15}(?:\.\d{1,12})?$/.test(text) ? text.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
}

export function normalizeDate(value: string, order?: 'DMY' | 'MDY'): string {
  if (!order) return value.trim();
  const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value.trim());
  if (!match) return value.trim();
  const day = order === 'DMY' ? match[1]! : match[2]!, month = order === 'DMY' ? match[2]! : match[1]!;
  return `${match[3]}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function extractInvoiceFields(raw: string): Fields {
  const references = [...raw.matchAll(/(?:^|\n)\s*(?:tax\s+)?(?:invoice|factur[aă])(?:\s+(?:no|nr|number)\.?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/._-]{0,40})/gi)].map(match => match[1]!.replace(/[.,;:]+$/, '').toUpperCase()).filter(reference => /\d/.test(reference));
  const suppliers = [...raw.matchAll(/^(?:supplier|furnizor|seller)\s*[:\-]\s*([^\r\n]+)/gim)].map(match => match[1]!.trim().toLowerCase());
  if (new Set(references).size > 1 || new Set(suppliers).size > 1) throw new Error('This document contains multiple invoice identities. Split it into one invoice per file before analysis.');
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const supplier = /(?:supplier|furnizor|seller)\s*[:\-]\s*([^\r\n]+)/i.exec(raw)?.[1]?.trim();
  const vendor = supplier ?? lines.find(line => !/^(?:invoice|factur[aă]|date|data|subtotal|total|vat|tva)\b/i.test(line)) ?? '';
  const dateText = /(?:invoice\s*date|date|data(?:\s*facturii)?)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})/i.exec(raw)?.[1] ?? '';
  const preferred = lines.filter(line => /^(?:grand\s+total|total\s+de\s+plat[aă]|amount\s+due|de\s+plat[aă])\b/i.test(line));
  const totalLines = preferred.length ? preferred : lines.filter(line => /^total\s*[:=\s]/i.test(line) && !/^total\s*(?:VAT|TVA|tax|taxe|without|f[aă]r[aă])/i.test(line));
  const amounts = totalLines.map(line => /(?:[A-Z]{3}\s*)?(\d[\d\s.,]*)(?:\s*[A-Z]{3}|\s*€|\s*\$)?\s*$/i.exec(line)?.[1]?.trim()).filter((value): value is string => Boolean(value));
  const unique = [...new Set(amounts)];
  let amount = unique.length === 1 ? unique[0]! : '';
  if (/,\d{2}$/.test(amount)) amount = normalizeAmount(amount, ',');
  else if (/\.\d{2}$/.test(amount)) amount = normalizeAmount(amount, '.');
  else amount = normalizeAmount(amount);
  const currencies = [...new Set((totalLines.join('\n').match(/\b(?:USD|EUR|RON|GBP|CHF|CAD|AUD|JPY)\b/gi) ?? []).map(code => code.toUpperCase()))];
  const currency = currencies.length === 1 ? currencies[0]! : totalLines.some(line => line.includes('€')) && !currencies.length ? 'EUR' : '';
  return { vendor: vendor.slice(0, 500), date: dateText.includes('-') ? dateText : normalizeDate(dateText, 'DMY'), amount, currency, category: 'Uncategorized', kind: 'expense' };
}
