import { Transaction, TransactionType } from '@/types/finance';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface ParsedTransaction {
  date: string;
  description: string;
  value: number;
  type: TransactionType;
}

export async function parsePDF(file: File): Promise<ParsedTransaction[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allTextChunks: string[] = [];
    const allTransactions: ParsedTransaction[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const tokens = pageTextItemsToTokens(textContent.items as any[]);

      // Keep some text for year inference / debugging.
      allTextChunks.push(tokens.map(t => t.str).join(' '));

      const pageTx = extractSicoobTransactionsFromTokens(tokens);
      allTransactions.push(...pageTx);

      // Debug (will show in console logs)
      if (i === 1) {
        console.log('[PDF DEBUG] file:', file.name, 'page:', i, 'tokens:', tokens.length);
        console.log('[PDF DEBUG] page transactions:', pageTx);
      }
    }

    const fullText = allTextChunks.join('\n');

    // Infer year from statement header (DD/MM/YYYY) if present; fallback current year.
    const yearMatch = fullText.match(/\b\d{2}\/\d{2}\/(\d{4})\b/);
    const statementYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    // Apply year and final cleanup/dedupe.
    const withYear = allTransactions.map(t => ({
      ...t,
      date: applyYearToDDMM(t.date, statementYear),
    }));

    const unique = withYear.filter((t, index, self) =>
      index === self.findIndex(s =>
        s.date === t.date &&
        s.description === t.description &&
        s.value === t.value &&
        s.type === t.type
      )
    );

    console.log(`Extracted ${unique.length} Sicoob transactions from PDF`);
    return unique;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

type PdfToken = { str: string; x: number; y: number };

function pageTextItemsToTokens(items: any[]): PdfToken[] {
  const tokens: PdfToken[] = [];

  for (const item of items) {
    const raw = (item?.str ?? '').toString();
    const str = raw.replace(/\u00A0/g, ' ').trim();
    if (!str) continue;

    const transform = item?.transform;
    const x = Array.isArray(transform) ? Number(transform[4]) : 0;
    const y = Array.isArray(transform) ? Number(transform[5]) : 0;

    tokens.push({ str, x, y });
  }

  return tokens;
}

function applyYearToDDMM(dateDDMM: string, year: number): string {
  const [day, month] = dateDDMM.split('/');
  if (!day || !month) return `${year}-01-01`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractSicoobTransactionsFromTokens(tokens: PdfToken[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  const isDate = (s: string) => /^\d{2}\/\d{2}$/.test(s);
  const isValue = (s: string) => /^[\d\.]+,\d{2}[CD\*]?$/.test(s);
  const isSuffix = (s: string) => /^[CD]$/i.test(s);

  const shouldSkipHistory = (desc: string) => {
    const d = desc.toUpperCase();
    return (
      d.startsWith('SALDO') ||
      d.includes('SALDO ') ||
      d.includes('BLOQ') ||
      d.includes('LIMITE')
    );
  };

  // Group tokens into rows by Y coordinate using tolerance (PDF columns often have tiny Y differences)
  const sorted = [...tokens].sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const rows: PdfToken[][] = [];
  const yTolerance = 2; // points

  for (const t of sorted) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      rows.push([t]);
      continue;
    }

    const rowY = lastRow[0].y;
    if (Math.abs(t.y - rowY) <= yTolerance) {
      lastRow.push(t);
    } else {
      rows.push([t]);
    }
  }

  // Sort tokens within each row by X asc
  const normalizedRows = rows.map(r => r.sort((a, b) => a.x - b.x));

  for (const row of normalizedRows) {
    // Find date token in this row
    const dateToken = row.find(t => isDate(t.str));
    if (!dateToken) continue;

    const dateIdx = row.indexOf(dateToken);

    // Collect description: tokens after date that aren't value/suffix
    const descTokens: string[] = [];
    let valueToken: PdfToken | null = null;
    let suffixToken: PdfToken | null = null;

    // Check tokens AFTER date
    for (let i = dateIdx + 1; i < row.length; i++) {
      const t = row[i];
      if (isValue(t.str)) {
        valueToken = t;
      } else if (isSuffix(t.str)) {
        suffixToken = t;
      } else if (!valueToken) {
        descTokens.push(t.str);
      }
    }

    // Also check tokens BEFORE date (value column sometimes renders first due to X position)
    for (let i = 0; i < dateIdx; i++) {
      const t = row[i];
      if (isValue(t.str) && !valueToken) {
        valueToken = t;
      } else if (isSuffix(t.str) && !suffixToken) {
        suffixToken = t;
      }
    }

    if (!valueToken) continue;

    const description = descTokens.join(' ').replace(/\s+/g, ' ').trim();
    if (!description || description.length < 3) continue;
    if (shouldSkipHistory(description)) continue;

    // Combine value with suffix if separate
    let valueStr = valueToken.str;
    if (suffixToken && !/[CD]$/i.test(valueStr)) {
      valueStr = valueStr + suffixToken.str;
    }

    const numericPart = valueStr.replace(/[CD\*]$/i, '');
    const value = Number(numericPart.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value) || value === 0) continue;

    // Determine type from suffix
    const suffix = (valueStr.match(/[CD]$/i)?.[0] ?? '').toUpperCase();
    let type: TransactionType;
    if (suffix === 'D') type = 'expense';
    else if (suffix === 'C') type = 'income';
    else {
      const upper = description.toUpperCase();
      type = /\bDEB\b|\bDEB\.|EMIT|TARIFA|PAGAMENTO|SAQUE/.test(upper) ? 'expense' : 'income';
    }

    transactions.push({
      date: dateToken.str,
      description: description.substring(0, 100),
      value,
      type,
    });
  }

  return transactions;
}

export function convertPDFToTransactions(
  parsed: ParsedTransaction[]
): Omit<Transaction, 'id' | 'createdAt'>[] {
  return parsed.map(row => ({
    date: row.date,
    description: row.description,
    category: null,
    value: row.value,
    type: row.type,
    status: 'completed' as const,
    paymentMethod: null,
    isImported: true,
    isReconciled: true,
  }));
}
