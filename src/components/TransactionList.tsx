import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Upload,
  MoreVertical,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Transaction, Category, PAYMENT_METHODS } from '@/types/finance';
import { cn } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
}

export function TransactionList({
  transactions,
  categories,
  onUpdate,
  onDelete,
}: TransactionListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getPaymentMethodLabel = (method: string | null) => {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label || '-';
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <ArrowDownCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">Nenhum lançamento</h3>
        <p className="text-sm text-muted-foreground">
          Adicione lançamentos manualmente ou importe um extrato
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => {
        const isUncategorized = !transaction.category;
        const filteredCategories = categories.filter(
          (c) => c.type === transaction.type
        );

        return (
          <div
            key={transaction.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl bg-card shadow-card transition-all duration-200 hover:shadow-card-hover animate-slide-up',
              isUncategorized && 'ring-2 ring-warning/50 bg-warning-muted'
            )}
          >
            <div
              className={cn(
                'flex-shrink-0 p-2 rounded-lg',
                transaction.type === 'income'
                  ? 'bg-income/10 text-income'
                  : 'bg-expense/10 text-expense'
              )}
            >
              {transaction.type === 'income' ? (
                <ArrowUpCircle className="h-5 w-5" />
              ) : (
                <ArrowDownCircle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{transaction.description}</p>
                {transaction.isImported && (
                  <Badge variant="secondary" className="text-xs">
                    <Upload className="h-3 w-3 mr-1" />
                    Importado
                  </Badge>
                )}
                {isUncategorized && (
                  <Badge
                    variant="outline"
                    className="text-xs border-warning text-warning"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Categorizar
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>
                  {format(new Date(transaction.date), "dd 'de' MMM", {
                    locale: ptBR,
                  })}
                </span>
                <span>•</span>
                {isUncategorized ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-warning hover:underline font-medium">
                        Selecionar categoria
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      {filteredCategories.map((cat) => (
                        <button
                          key={cat.id}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                          onClick={() =>
                            onUpdate(transaction.id, { category: cat.name })
                          }
                        >
                          {cat.name}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span>{transaction.category}</span>
                )}
                {transaction.paymentMethod && (
                  <>
                    <span>•</span>
                    <span>{getPaymentMethodLabel(transaction.paymentMethod)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'font-semibold text-lg',
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                )}
              >
                {transaction.type === 'expense' ? '-' : '+'}
                {formatCurrency(transaction.value)}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!transaction.isReconciled && (
                    <DropdownMenuItem
                      onClick={() =>
                        onUpdate(transaction.id, { isReconciled: true })
                      }
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Marcar como conciliado
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-expense"
                    onClick={() => onDelete(transaction.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
