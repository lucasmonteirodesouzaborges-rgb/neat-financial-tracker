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
  isFuture: boolean;
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
      date: applyYearToDDMM(t.date, statementYear, t.isFuture),
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

  // Patterns - capture DD/MM or DD/MM/YY (for future transactions like 12/01/26)
  const datePattern = /^(\d{2}\/\d{2}(?:\/\d{2})?)\b/;
  // Brazilian value: 1.234,56 or 1234,56 followed by optional C/D/*
  const valuePattern = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*([CD\*])?/gi;

  const skipKeywords = ['SALDO', 'BLOQ', 'LIMITE', 'RESUMO', 'ANTERIOR', 'DISPONÍVEL'];
  
  // Detect "LANÇAMENTOS FUTUROS" section
  const futureSectionPatterns = [
    /LAN[CÇ]AMENTOS?\s*FUTUROS?/i,
    /LANC\.\s*FUTUROS?/i,
    /PREVISTOS?/i,
    /AGENDADOS?/i,
  ];
  
  let isFutureSection = false;

  const shouldSkip = (text: string) => {
    const upper = text.toUpperCase();
    return skipKeywords.some(kw => upper.includes(kw));
  };

  const hasAnyValue = (text: string) => {
    valuePattern.lastIndex = 0;
    return valuePattern.test(text);
  };
  
  const isFutureSectionHeader = (text: string) => {
    return futureSectionPatterns.some(pattern => pattern.test(text));
  };

  for (let i = 0; i < lines.length; i++) {
    let trimmed = lines[i]?.trim() ?? '';
    if (!trimmed) continue;
    
    // Check if we're entering the future transactions section
    if (isFutureSectionHeader(trimmed)) {
      isFutureSection = true;
      console.log('[PDF] Detectada seção de lançamentos futuros');
      continue;
    }

    // Skip obvious non-transaction lines early
    if (shouldSkip(trimmed)) continue;

    // Must start with date DD/MM
    const dateMatch = trimmed.match(datePattern);
    if (!dateMatch) continue;

    // Some Sicoob PDFs break a single transaction across multiple lines.
    // If the first line has the date but no value yet, append subsequent lines
    // until we find a value or hit a new date line.
    let combined = trimmed;
    while (!hasAnyValue(combined) && i + 1 < lines.length) {
      const next = (lines[i + 1] ?? '').trim();
      if (!next) {
        i++;
        continue;
      }
      if (datePattern.test(next)) break; // next transaction starts
      if (shouldSkip(next)) {
        i++;
        continue;
      }
      combined = `${combined} ${next}`.replace(/\s+/g, ' ').trim();
      i++;

      // Safety: we only need a couple of extra lines to reach the value
      if (combined.length > 400) break;
    }

    const date = dateMatch[1];

    // Find all values in the (possibly combined) line
    const values: { value: number; suffix: string; index: number }[] = [];
    let match;
    valuePattern.lastIndex = 0;

    while ((match = valuePattern.exec(combined)) !== null) {
      const numStr = match[1];
      const suffix = (match[2] || '').toUpperCase();
      const value = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(value) && value > 0) {
        values.push({ value, suffix, index: match.index });
      }
    }

    if (values.length === 0) continue;

    // Prefer values with C/D suffix (explicit credit/debit). Otherwise, use the first value.
    // (Sicoob statements generally have only one money column for transactions.)
    let selectedValue = values.find(v => v.suffix === 'C' || v.suffix === 'D');
    if (!selectedValue) selectedValue = values[0];

    // Extract description: text between date and value
    const dateEndIndex = (dateMatch.index ?? 0) + dateMatch[0].length;
    const valueStartIndex = selectedValue.index;
    let description = combined.substring(dateEndIndex, valueStartIndex).trim();
    description = description.replace(/\s+/g, ' ').trim();

    if (!description || description.length < 2) continue;

    // Determine transaction type
    let type: TransactionType;
    if (selectedValue.suffix === 'D') {
      type = 'expense';
    } else if (selectedValue.suffix === 'C') {
      type = 'income';
    } else {
      const descUpper = description.toUpperCase();
      const expenseKeywords = ['DEB', 'EMIT', 'TARIFA', 'PAGAMENTO', 'SAQUE', 'TED', 'DOC', 'PIX ENV', 'TRANSF.'];
      const incomeKeywords = ['REC', 'CRED', 'DEP', 'PIX REC', 'TRANSF REC'];

      if (expenseKeywords.some(kw => descUpper.includes(kw))) {
        type = 'expense';
      } else if (incomeKeywords.some(kw => descUpper.includes(kw))) {
        type = 'income';
      } else {
        type = 'expense';
      }
    }

    transactions.push({
      date,
      description: description.substring(0, 100),
      value: selectedValue.value,
      type,
      isFuture: isFutureSection,
    });
  }

  return transactions;
}

function applyYearToDDMM(dateStr: string, year: number, isFuture: boolean = false): string {
  const parts = dateStr.split('/');
  
  // Format DD/MM/YY - year already present (e.g., 12/01/26 → 2026-01-12)
  if (parts.length === 3) {
    const [day, month, yearShort] = parts;
    const fullYear = 2000 + parseInt(yearShort, 10);
    console.log(`[PDF] Data com ano completo: ${dateStr} → ${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Format DD/MM - need to determine year
  if (parts.length !== 2) return `${year}-01-01`;
  const [day, month] = parts;
  
  // For future transactions without explicit year, check if date would be in the past
  if (isFuture) {
    const today = new Date();
    const transactionMonth = parseInt(month, 10);
    const transactionDay = parseInt(day, 10);
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    if (transactionMonth < currentMonth || 
        (transactionMonth === currentMonth && transactionDay < currentDay)) {
      const nextYear = year + 1;
      console.log(`[PDF] Transação futura ${dateStr} ajustada para ano ${nextYear}`);
      return `${nextYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return parsed.map(row => {
    // Check if date is in the future
    const transactionDate = new Date(row.date);
    const isDateInFuture = transactionDate > today;
    
    // Transaction is pending if it's in the "LANÇAMENTOS FUTUROS" section OR if date is in the future
    const isPending = row.isFuture || isDateInFuture;
    
    if (isPending) {
      console.log(`[PDF] Transação futura detectada: ${row.description} - ${row.date}`);
    }
    
    return {
      date: row.date,
      description: row.description,
      category: null,
      value: row.value,
      type: row.type,
      status: isPending ? 'pending' as const : 'completed' as const,
      dueDate: isPending ? row.date : undefined,
      paymentMethod: null,
      isImported: true,
      isReconciled: !isPending,
    };
  });
}
