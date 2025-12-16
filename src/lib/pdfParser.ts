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
        const sample = tokens.slice(0, 80).map(t => t.str);
        const dates = tokens.filter(t => /^\d{2}\/\d{2}$/.test(t.str)).length;
        const values = tokens.filter(t => /^[\d\.]+,\d{2}[CD\*]?$/.test(t.str)).length;
        console.log('[PDF DEBUG] file:', file.name, 'page:', i, 'tokens:', tokens.length, 'dates:', dates, 'values:', values);
        console.log('[PDF DEBUG] first tokens:', sample);
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

  // Reading order: top-to-bottom (y desc), left-to-right (x asc)
  return tokens.sort((a, b) => (b.y - a.y) || (a.x - b.x));
}

function applyYearToDDMM(dateDDMM: string, year: number): string {
  // dateDDMM expected: DD/MM
  const [day, month] = dateDDMM.split('/');
  if (!day || !month) return `${year}-01-01`;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractSicoobTransactionsFromTokens(tokens: PdfToken[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // We intentionally parse in token stream order because, in these PDFs,
  // the value and the C/D suffix can be split into separate text items.

  const isDate = (s: string) => /^\d{2}\/\d{2}$/.test(s);
  const isValue = (s: string) => /^[\d\.]+,\d{2}[CD\*]?$/.test(s);
  const isSuffix = (s: string) => /^[CD]$/.test(s);

  const shouldSkipHistory = (desc: string) => {
    const d = desc.toUpperCase();
    return (
      d.startsWith('SALDO') ||
      d.includes('SALDO ') ||
      d.includes('BLOQ') ||
      d.includes('LIMITE')
    );
  };

  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i]?.str ?? '';

    if (!isDate(cur)) {
      i++;
      continue;
    }

    const dateDDMM = cur;
    i++;

    // Build description until we hit a value.
    const descParts: string[] = [];
    while (i < tokens.length && !isValue(tokens[i].str) && !isDate(tokens[i].str)) {
      const s = tokens[i].str;

      // Stop early if we're entering the "detail" lines of a PIX (Recebimento Pix, DOC.: etc.)
      // Those appear after the main history row and should not be treated as new transactions.
      const upper = s.toUpperCase();
      if (upper === 'RECEBIMENTO' || upper === 'PAGAMENTO' || upper.startsWith('DOC')) break;

      descParts.push(s);
      i++;
    }

    // Find a value token right after description
    if (i >= tokens.length || !isValue(tokens[i].str)) {
      // Could not complete a transaction; move on.
      continue;
    }

    let valueToken = tokens[i].str;
    i++;

    // Some PDFs split the suffix into the next token.
    if (!/[CD]$/.test(valueToken) && i < tokens.length && isSuffix(tokens[i].str)) {
      valueToken = `${valueToken}${tokens[i].str}`;
      i++;
    }

    const description = descParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!description || description.length < 3) continue;
    if (shouldSkipHistory(description)) continue;

    const valueStr = valueToken.replace(/[CD\*]$/i, '');
    const value = Number(valueStr.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value) || value === 0) continue;

    // If suffix missing (some credit rows), infer: treat as income unless looks like debit.
    const suffix = (valueToken.match(/[CD]$/i)?.[0] ?? '').toUpperCase();
    let type: TransactionType;
    if (suffix === 'D') type = 'expense';
    else if (suffix === 'C') type = 'income';
    else {
      const upper = description.toUpperCase();
      type = /\bDEB\b|\bDEB\.|EMIT|TARIFA|PAGAMENTO|SAQUE/.test(upper) ? 'expense' : 'income';
    }

    transactions.push({
      // temporarily keep DD/MM; we’ll apply year later
      date: dateDDMM,
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
