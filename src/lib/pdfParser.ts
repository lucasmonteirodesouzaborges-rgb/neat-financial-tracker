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

    const lines: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      lines.push(...pageTextItemsToLines(textContent.items as any[]));
    }

    const fullText = lines.join('\n');

    // Try to infer year from the statement header (DD/MM/YYYY)
    const yearMatch = fullText.match(/\b\d{2}\/\d{2}\/(\d{4})\b/);
    const statementYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    console.log('Extracted PDF lines (sample):', lines.slice(0, 20));

    return extractSicoobTransactions(fullText, statementYear);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

function pageTextItemsToLines(items: any[]): string[] {
  // Group PDF.js text items by their Y position to reconstruct lines.
  const byY = new Map<number, { x: number; str: string }[]>();

  for (const item of items) {
    const str = (item?.str ?? '').toString();
    if (!str.trim()) continue;

    const transform = item?.transform;
    const x = Array.isArray(transform) ? Number(transform[4]) : 0;
    const yRaw = Array.isArray(transform) ? Number(transform[5]) : 0;
    const y = Math.round(yRaw * 10) / 10; // reduce noise

    const arr = byY.get(y) ?? [];
    arr.push({ x, str });
    byY.set(y, arr);
  }

  const sortedY = Array.from(byY.keys()).sort((a, b) => b - a);
  const lines: string[] = [];

  for (const y of sortedY) {
    const parts = (byY.get(y) ?? []).sort((a, b) => a.x - b.x).map(p => p.str);
    const line = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }

  return lines;
}

function extractSicoobTransactions(text: string, statementYear: number): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  const normalizedText = text.replace(/\u00A0/g, ' ');

  // Sicoob pattern: DD/MM DESCRIPTION VALUE[C|D]
  // Example: "14/11 PIX REC.OUTRA IF MT 1,00C"
  // Example: "08/12 PIX EMIT.OUTRA IF 124,37D"

  // Match a single transaction; supports "1,00C" and "1,00 C"
  const transactionPattern = /(\d{2}\/\d{2})\s+(.+?)\s+([\d\.]+,\d{2})\s*([CD])(?=\s|$)/gi;
  
  // Lines to skip
  const skipPatterns = [
    /SALDO DO DIA/i,
    /SALDO ANTERIOR/i,
    /SALDO DISPONÍVEL/i,
    /SALDO BLOQUEADO/i,
    /LIMITE/i,
  ];

  let match;
  while ((match = transactionPattern.exec(normalizedText)) !== null) {
    const [, dateStr, description, valueStr, typeCharRaw] = match;
    const typeChar = typeCharRaw.toUpperCase();
    
    // Skip balance lines
    const shouldSkip = skipPatterns.some(pattern => pattern.test(description));
    if (shouldSkip) continue;
    
    // Clean description
    const cleanDesc = description
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!cleanDesc || cleanDesc.length < 3) continue;
    
    // Parse value (Brazilian format: 1.000,00 -> 1000.00)
    const cleanValue = valueStr
      .replace(/\./g, '')
      .replace(',', '.');
    const value = parseFloat(cleanValue);
    
    if (isNaN(value) || value === 0) continue;
    
    // C = Credit (income), D = Debit (expense)
    const type: TransactionType = typeChar === 'C' ? 'income' : 'expense';
    
    // Parse date (DD/MM) using inferred statement year
    const [day, month] = dateStr.split('/');
    const year = statementYear;
    const parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    transactions.push({
      date: parsedDate,
      description: cleanDesc.substring(0, 100),
      value,
      type,
    });
  }

  // Remove duplicates
  const unique = transactions.filter((t, index, self) =>
    index === self.findIndex((s) => 
      s.date === t.date && 
      s.description === t.description && 
      s.value === t.value &&
      s.type === t.type
    )
  );

  console.log(`Extracted ${unique.length} Sicoob transactions from PDF`);
  return unique;
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
