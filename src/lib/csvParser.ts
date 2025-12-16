import { Transaction, TransactionType } from '@/types/finance';

interface ParsedRow {
  date: string;
  description: string;
  value: number;
  type: TransactionType;
}

export function parseCSV(content: string): ParsedRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('data') || header.includes('date') || header.includes('valor');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const results: ParsedRow[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Try to parse different CSV formats
    const parts = line.split(/[,;]/).map(p => p.trim().replace(/^"|"$/g, ''));
    
    if (parts.length >= 3) {
      const dateStr = parts[0];
      const description = parts[1];
      const valueStr = parts[2].replace(/[R$\s]/g, '').replace(',', '.');
      const value = Math.abs(parseFloat(valueStr));

      if (!isNaN(value) && value > 0) {
        // Detect type based on value sign or description
        const isNegative = parts[2].includes('-') || valueStr.startsWith('-');
        const type: TransactionType = isNegative ? 'expense' : 'income';

        // Parse date (supports DD/MM/YYYY or YYYY-MM-DD)
        let parsedDate = dateStr;
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        results.push({
          date: parsedDate,
          description,
          value,
          type,
        });
      }
    }
  }

  return results;
}

export function convertToTransactions(parsed: ParsedRow[]): Omit<Transaction, 'id' | 'createdAt'>[] {
  return parsed.map(row => ({
    date: row.date,
    description: row.description,
    category: null,
    value: row.value,
    type: row.type,
    paymentMethod: null,
    isImported: true,
    isReconciled: true,
  }));
}
