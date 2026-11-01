import { zipSync, strToU8 } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function workbook(sheets: { name: string; rows: (string | number | null)[][] }[]) {
  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${escape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  for (const [index, sheet] of sheets.entries()) entries[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cell === null ? '' : `<c r="${String.fromCharCode(65 + c)}${r + 1}"${typeof cell === 'number' ? '' : ' t="inlineStr"'}>${typeof cell === 'number' ? `<v>${cell}</v>` : `<is><t>${escape(cell)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
  return zipSync(entries);
}

export async function invoicePdf(pages = 1) {
  const document = await PDFDocument.create(); const font = await document.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = document.addPage([600, 800]);
    ['Acme Tools', 'Invoice 001', 'Date: 2026-09-01', 'Subtotal: 100.00 USD', 'VAT: 20.00 USD', 'Grand total: 120.00 USD'].forEach((text, line) => page.drawText(text, { x: 50, y: 730 - line * 35, size: 20, font }));
  }
  return document.save();
}
