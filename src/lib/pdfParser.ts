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

type PdfToken = { str: string; x: number; y: number };

export async function parsePDF(file: File): Promise<ParsedTransaction[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allTransactions: ParsedTransaction[] = [];
    let statementYear = new Date().getFullYear();

    console.log(`[PDF] Iniciando parse de: ${file.name}, páginas: ${pdf.numPages}`);

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const tokens = extractTokens(textContent.items as any[]);

      // Reconstruct lines from tokens
      const lines = reconstructLines(tokens);

      console.log(`[PDF] Página ${i}: ${tokens.length} tokens, ${lines.length} linhas`);

      // Try to extract year from header on first page
      if (i === 1) {
        statementYear = extractYearFromLines(lines) || statementYear;
        console.log(`[PDF] Ano do extrato: ${statementYear}`);
      }

      // Extract transactions from lines
      const pageTx = extractTransactionsFromLines(lines);
      console.log(`[PDF] Página ${i}: ${pageTx.length} transações encontradas`);

      if (i === 1 && pageTx.length > 0) {
        console.log('[PDF] Primeiras transações:', pageTx.slice(0, 3));
      }

      allTransactions.push(...pageTx);
    }

    // Apply year and deduplicate
    const withYear = allTransactions.map(t => ({
      ...t,
      date: applyYearToDDMM(t.date, statementYear),
    }));

    const unique = deduplicateTransactions(withYear);

    console.log(`[PDF] Total extraído: ${unique.length} transações únicas`);
    return unique;
  } catch (error) {
    console.error('[PDF] Erro ao processar:', error);
    throw error;
  }
}

function extractTokens(items: any[]): PdfToken[] {
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

function reconstructLines(tokens: PdfToken[]): string[] {
  if (tokens.length === 0) return [];

  // Sort by Y descending (top to bottom), then X ascending (left to right)
  const sorted = [...tokens].sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const rows: PdfToken[][] = [];
  const yTolerance = 6; // Increased tolerance for Sicoob PDFs

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

  // Sort tokens within each row by X, then join into lines
  return rows.map(row => {
    const sortedRow = row.sort((a, b) => a.x - b.x);
    return sortedRow.map(t => t.str).join(' ');
  });
}

function extractYearFromLines(lines: string[]): number | null {
  for (const line of lines) {
    // Look for "PERÍODO: DD/MM/YYYY" or similar date patterns
    const match = line.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (match) {
      return Number(match[3]);
    }
  }
  return null;
}

function extractTransactionsFromLines(lines: string[]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Patterns
  const datePattern = /^(\d{2}\/\d{2})\b/;
  // Brazilian value: 1.234,56 or 1234,56 followed by optional C/D/*
  const valuePattern = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD\*])?/gi;

  const skipKeywords = ['SALDO', 'BLOQ', 'LIMITE', 'RESUMO', 'ANTERIOR', 'DISPONÍVEL'];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line should be skipped
    const upperLine = trimmed.toUpperCase();
    if (skipKeywords.some(kw => upperLine.includes(kw))) {
      continue;
    }

    // Check if line starts with date DD/MM
    const dateMatch = trimmed.match(datePattern);
    if (!dateMatch) continue;

    const date = dateMatch[1];

    // Find all values in the line
    const values: { value: number; suffix: string; index: number }[] = [];
    let match;
    valuePattern.lastIndex = 0;

    while ((match = valuePattern.exec(trimmed)) !== null) {
      const numStr = match[1];
      const suffix = (match[2] || '').toUpperCase();
      const value = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(value) && value > 0) {
        values.push({ value, suffix, index: match.index });
      }
    }

    if (values.length === 0) continue;

    // Use the last value (usually the transaction value, not balance)
    // In Sicoob, the pattern is usually: date | description | value C/D | balance
    // We want the first value that has a C/D suffix, or the first value if none have suffix
    let selectedValue = values.find(v => v.suffix === 'C' || v.suffix === 'D');
    if (!selectedValue) {
      selectedValue = values[0];
    }

    // Extract description: text between date and value
    const dateEndIndex = dateMatch.index! + dateMatch[0].length;
    const valueStartIndex = selectedValue.index;
    let description = trimmed.substring(dateEndIndex, valueStartIndex).trim();

    // Clean up description
    description = description.replace(/\s+/g, ' ').trim();

    if (!description || description.length < 2) continue;

    // Determine transaction type
    let type: TransactionType;
    if (selectedValue.suffix === 'D') {
      type = 'expense';
    } else if (selectedValue.suffix === 'C') {
      type = 'income';
    } else {
      // Infer from description keywords
      const descUpper = description.toUpperCase();
      const expenseKeywords = ['DEB', 'EMIT', 'TARIFA', 'PAGAMENTO', 'SAQUE', 'TED', 'DOC', 'PIX ENV'];
      const incomeKeywords = ['REC', 'CRED', 'DEP', 'PIX REC', 'TRANSF REC'];

      if (expenseKeywords.some(kw => descUpper.includes(kw))) {
        type = 'expense';
      } else if (incomeKeywords.some(kw => descUpper.includes(kw))) {
        type = 'income';
      } else {
        // Default based on typical patterns
        type = 'expense';
      }
    }

    transactions.push({
      date,
      description: description.substring(0, 100),
      value: selectedValue.value,
      type,
    });
  }

  return transactions;
}

function applyYearToDDMM(dateDDMM: string, year: number): string {
  const parts = dateDDMM.split('/');
  if (parts.length !== 2) return `${year}-01-01`;
  const [day, month] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function deduplicateTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
  return transactions.filter((t, index, self) =>
    index === self.findIndex(s =>
      s.date === t.date &&
      s.description === t.description &&
      s.value === t.value &&
      s.type === t.type
    )
  );
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
