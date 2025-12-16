export type TransactionType = 'income' | 'expense';

export type TransactionStatus = 'completed' | 'pending';

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'boleto';

export interface Transaction {
  id: string;
  date: string;
  dueDate?: string; // Data de vencimento para pendentes
  description: string;
  category: string | null;
  value: number;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: PaymentMethod | null;
  isImported: boolean;
  isReconciled: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Vendas', type: 'income', color: '#10B981' },
  { id: '2', name: 'Serviços', type: 'income', color: '#06B6D4' },
  { id: '3', name: 'Investimentos', type: 'income', color: '#8B5CF6' },
  { id: '4', name: 'Outros (Entrada)', type: 'income', color: '#6366F1' },
  { id: '5', name: 'Fornecedores', type: 'expense', color: '#EF4444' },
  { id: '6', name: 'Salários', type: 'expense', color: '#F97316' },
  { id: '7', name: 'Aluguel', type: 'expense', color: '#EC4899' },
  { id: '8', name: 'Utilidades', type: 'expense', color: '#F59E0B' },
  { id: '9', name: 'Marketing', type: 'expense', color: '#84CC16' },
  { id: '10', name: 'Impostos', type: 'expense', color: '#14B8A6' },
  { id: '11', name: 'Outros (Saída)', type: 'expense', color: '#64748B' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];
