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
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    console.log('Extracted PDF text:', fullText.substring(0, 1000));

    return extractSicoobTransactions(fullText);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

function extractSicoobTransactions(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Sicoob pattern: DD/MM DESCRIPTION VALUE[C|D]
  // Example: "14/11 PIX REC.OUTRA IF MT 1,00C"
  // Example: "08/12 PIX EMIT.OUTRA IF 124,37D"
  
  // Pattern to match Sicoob transactions
  const transactionPattern = /(\d{2}\/\d{2})\s+([A-Za-zÀ-ÿ\s\.\-\/]+?)\s+([\d\.]+,\d{2})([CD])/g;
  
  // Lines to skip
  const skipPatterns = [
    /SALDO DO DIA/i,
    /SALDO ANTERIOR/i,
    /SALDO DISPONÍVEL/i,
    /SALDO BLOQUEADO/i,
    /LIMITE/i,
  ];

  let match;
  while ((match = transactionPattern.exec(text)) !== null) {
    const [, dateStr, description, valueStr, typeChar] = match;
    
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
    
    // Parse date (DD/MM) - assume current year
    const [day, month] = dateStr.split('/');
    const year = new Date().getFullYear();
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
