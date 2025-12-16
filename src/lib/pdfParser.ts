import { Transaction, TransactionType } from '@/types/finance';

interface ParsedTransaction {
  date: string;
  description: string;
  value: number;
  type: TransactionType;
}

export async function parsePDF(file: File): Promise<ParsedTransaction[]> {
  try {
    // Dynamic import to avoid issues with module loading
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;
    
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

    console.log('Extracted PDF text:', fullText.substring(0, 500));

    return extractTransactionsFromText(fullText);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

function extractTransactionsFromText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Common patterns for bank statement transactions
  // Pattern 1: DD/MM/YYYY Description Value
  const datePattern = /(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{2})/g;
  const valuePattern = /[R$]?\s*-?\d{1,3}(?:\.\d{3})*(?:,\d{2})/g;
  
  // Split text into lines
  const lines = text.split(/\n|\r/).filter(line => line.trim());
  
  for (const line of lines) {
    // Try to find a date
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    // Try to find a value
    const valueMatches = line.match(valuePattern);
    if (!valueMatches || valueMatches.length === 0) continue;

    // Get the last value (usually the transaction amount)
    const valueStr = valueMatches[valueMatches.length - 1];
    const cleanValue = valueStr
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    const value = Math.abs(parseFloat(cleanValue));
    if (isNaN(value) || value === 0) continue;

    // Determine type based on sign or context
    const isNegative = valueStr.includes('-') || 
      line.toLowerCase().includes('débito') ||
      line.toLowerCase().includes('pagamento') ||
      line.toLowerCase().includes('saque') ||
      line.toLowerCase().includes('transferência enviada');
    
    const isPositive = line.toLowerCase().includes('crédito') ||
      line.toLowerCase().includes('depósito') ||
      line.toLowerCase().includes('recebimento') ||
      line.toLowerCase().includes('transferência recebida') ||
      line.toLowerCase().includes('pix recebido');

    const type: TransactionType = isPositive ? 'income' : (isNegative ? 'expense' : 'expense');

    // Extract description (everything between date and value)
    let description = line;
    if (dateMatch[0]) {
      description = description.replace(dateMatch[0], '').trim();
    }
    for (const val of valueMatches) {
      description = description.replace(val, '').trim();
    }
    // Clean up description
    description = description
      .replace(/\s+/g, ' ')
      .replace(/[^\w\sáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ-]/g, ' ')
      .trim();

    if (!description || description.length < 3) {
      description = 'Lançamento importado';
    }

    // Parse date
    let parsedDate = dateMatch[0];
    const parts = parsedDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      parsedDate = `${year}-${month}-${day}`;
    }

    transactions.push({
      date: parsedDate,
      description: description.substring(0, 100),
      value,
      type,
    });
  }

  // Remove duplicates based on date, description, and value
  const unique = transactions.filter((t, index, self) =>
    index === self.findIndex((s) => 
      s.date === t.date && 
      s.description === t.description && 
      s.value === t.value
    )
  );

  console.log(`Extracted ${unique.length} transactions from PDF`);
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
