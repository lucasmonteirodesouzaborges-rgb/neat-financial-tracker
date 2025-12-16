import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Upload,
  MoreVertical,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  Pencil,
  CheckSquare,
  Square,
  X,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onEdit?: (transaction: Transaction) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void;
  onBulkDelete?: (ids: string[]) => void;
}

export function TransactionList({
  transactions,
  categories,
  onUpdate,
  onDelete,
  onEdit,
  onBulkUpdate,
  onBulkDelete,
}: TransactionListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getPaymentMethodLabel = (method: string | null) => {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label || '-';
  };

  const isOverdue = (transaction: Transaction) => {
    if (transaction.status !== 'pending' || !transaction.dueDate) return false;
    const dueDate = new Date(transaction.dueDate);
    return isPast(dueDate) && !isToday(dueDate);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkCategorize = (categoryName: string) => {
    if (onBulkUpdate && selectedIds.size > 0) {
      onBulkUpdate(Array.from(selectedIds), { category: categoryName });
      clearSelection();
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      clearSelection();
    }
  };

  // Get unique categories from selected transactions
  const selectedTransactions = transactions.filter((t) => selectedIds.has(t.id));
  const bulkCategoryOptions = categories.filter((c) => 
    selectedTransactions.some((t) => t.type === c.type)
  );

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
      {/* Bulk Actions Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (selectionMode) {
                clearSelection();
              } else {
                setSelectionMode(true);
              }
            }}
          >
            {selectionMode ? (
              <>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-1" />
                Selecionar
              </>
            )}
          </Button>
          
          {selectionMode && (
            <>
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === transactions.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="h-4 w-4 mr-1" />
                  Categorizar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                {bulkCategoryOptions.length > 0 ? (
                  bulkCategoryOptions.map((cat) => (
                    <button
                      key={cat.id}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
                      onClick={() => handleBulkCategorize(cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Selecione itens do mesmo tipo
                  </p>
                )}
              </PopoverContent>
            </Popover>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Transaction Items */}
      {transactions.map((transaction) => {
        const isUncategorized = !transaction.category;
        const isPending = transaction.status === 'pending';
        const overdue = isOverdue(transaction);
        const filteredCategories = categories.filter(
          (c) => c.type === transaction.type
        );
        const isSelected = selectedIds.has(transaction.id);

        return (
          <div
            key={transaction.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl bg-card shadow-card transition-all duration-200 hover:shadow-card-hover animate-slide-up',
              isUncategorized && !isPending && 'ring-2 ring-warning/50 bg-warning-muted',
              isPending && 'bg-muted/50',
              overdue && 'ring-2 ring-expense/50 bg-expense-muted',
              isSelected && 'ring-2 ring-primary bg-primary/5'
            )}
          >
            {/* Selection Checkbox */}
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelection(transaction.id)}
                className="flex-shrink-0"
              />
            )}

            <div
              className={cn(
                'flex-shrink-0 p-2 rounded-lg',
                transaction.type === 'income'
                  ? 'bg-income/10 text-income'
                  : 'bg-expense/10 text-expense',
                isPending && 'opacity-60'
              )}
            >
              {transaction.type === 'income' ? (
                <ArrowUpCircle className="h-5 w-5" />
              ) : (
                <ArrowDownCircle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn('font-medium truncate', isPending && 'text-muted-foreground')}>
                  {transaction.description}
                </p>
                {isPending && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs',
                      overdue 
                        ? 'border-expense text-expense' 
                        : 'border-warning text-warning'
                    )}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {transaction.type === 'income' ? 'A Receber' : 'A Pagar'}
                  </Badge>
                )}
                {transaction.isImported && (
                  <Badge variant="secondary" className="text-xs">
                    <Upload className="h-3 w-3 mr-1" />
                    Importado
                  </Badge>
                )}
                {isUncategorized && !isPending && (
                  <Badge
                    variant="outline"
                    className="text-xs border-warning text-warning"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Categorizar
                  </Badge>
                )}
                {overdue && (
                  <Badge variant="destructive" className="text-xs">
                    Vencido
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>
                  {format(new Date(transaction.date), "dd 'de' MMM", {
                    locale: ptBR,
                  })}
                </span>
                {transaction.dueDate && (
                  <>
                    <span>•</span>
                    <span className={cn(overdue && 'text-expense font-medium')}>
                      Venc: {format(new Date(transaction.dueDate), "dd/MM", { locale: ptBR })}
                    </span>
                  </>
                )}
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
                  transaction.type === 'income' ? 'text-income' : 'text-expense',
                  isPending && 'opacity-60'
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
                <DropdownMenuContent align="end" className="z-50">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(transaction)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {isPending && (
                    <DropdownMenuItem
                      onClick={() =>
                        onUpdate(transaction.id, { 
                          status: 'completed',
                          isReconciled: true,
                          date: format(new Date(), 'yyyy-MM-dd')
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2 text-income" />
                      Marcar como {transaction.type === 'income' ? 'Recebido' : 'Pago'}
                    </DropdownMenuItem>
                  )}
                  {!transaction.isReconciled && !isPending && (
                    <DropdownMenuItem
                      onClick={() =>
                        onUpdate(transaction.id, { isReconciled: true })
                      }
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Marcar como conciliado
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
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
