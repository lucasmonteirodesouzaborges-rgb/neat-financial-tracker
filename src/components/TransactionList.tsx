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
  X,
  Tag,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  onUpdate: (id: string, updates: Partial<Transaction>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onEdit?: (transaction: Transaction) => void;
  onBulkUpdate?: (ids: string[], updates: Partial<Transaction>) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
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
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  
  // Pending bulk changes - accumulated before confirmation
  const [pendingChanges, setPendingChanges] = useState<Partial<Transaction>>({});

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
    setPendingChanges({});
  };

  // Queue changes instead of applying immediately
  const queueCategoryChange = (categoryName: string) => {
    setPendingChanges(prev => ({ ...prev, category: categoryName }));
  };

  const queueStatusChange = (status: 'completed' | 'pending') => {
    if (status === 'completed') {
      setPendingChanges(prev => ({ ...prev, status: 'completed', isReconciled: true }));
    } else {
      setPendingChanges(prev => ({ ...prev, status: 'pending', isReconciled: false }));
    }
  };

  const queueDescriptionChange = () => {
    if (newDescription.trim()) {
      setPendingChanges(prev => ({ ...prev, description: newDescription.trim() }));
      setNewDescription('');
      setEditingDescription(false);
    }
  };

  const removePendingChange = (key: keyof Transaction) => {
    setPendingChanges(prev => {
      const updated = { ...prev };
      delete updated[key];
      // Also remove related fields
      if (key === 'status') {
        delete updated.isReconciled;
      }
      return updated;
    });
  };

  // Apply all pending changes
  const confirmBulkChanges = () => {
    if (onBulkUpdate && selectedIds.size > 0 && Object.keys(pendingChanges).length > 0) {
      onBulkUpdate(Array.from(selectedIds), pendingChanges);
      clearSelection();
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      clearSelection();
    }
  };

  // Check if there are pending changes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Get pending changes summary
  const getPendingChangesSummary = () => {
    const changes: string[] = [];
    if (pendingChanges.category) changes.push(`Categoria: ${pendingChanges.category}`);
    if (pendingChanges.status) changes.push(`Status: ${pendingChanges.status === 'completed' ? 'Realizado' : 'Pendente'}`);
    if (pendingChanges.description) changes.push(`Descrição: ${pendingChanges.description}`);
    return changes;
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
          <div className="flex flex-col gap-3">
            {/* Pending Changes Preview */}
            {hasPendingChanges && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-sm font-medium text-primary">Alterações pendentes:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {getPendingChangesSummary().map((change, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="text-xs cursor-pointer hover:bg-destructive/20"
                      onClick={() => {
                        if (change.startsWith('Categoria')) removePendingChange('category');
                        if (change.startsWith('Status')) removePendingChange('status');
                        if (change.startsWith('Descrição')) removePendingChange('description');
                      }}
                    >
                      {change}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <Button 
                  size="sm" 
                  className="ml-auto"
                  onClick={confirmBulkChanges}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Confirmar Edição ({selectedIds.size})
                </Button>
              </div>
            )}

            {/* Bulk Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={pendingChanges.category ? 'secondary' : 'outline'} size="sm">
                    <Tag className="h-4 w-4 mr-1" />
                    Categorizar
                    {pendingChanges.category && <Check className="h-3 w-3 ml-1 text-income" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {bulkCategoryOptions.length > 0 ? (
                    bulkCategoryOptions.map((cat) => (
                      <button
                        key={cat.id}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors",
                          pendingChanges.category === cat.name && "bg-primary/10 text-primary"
                        )}
                        onClick={() => queueCategoryChange(cat.name)}
                      >
                        {cat.name}
                        {pendingChanges.category === cat.name && <Check className="h-3 w-3 ml-2 inline" />}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Selecione itens do mesmo tipo
                    </p>
                  )}
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={pendingChanges.status ? 'secondary' : 'outline'} size="sm">
                    <Clock className="h-4 w-4 mr-1" />
                    Alterar Status
                    {pendingChanges.status && <Check className="h-3 w-3 ml-1 text-income" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="end">
                  <button
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2",
                      pendingChanges.status === 'completed' && "bg-primary/10 text-primary"
                    )}
                    onClick={() => queueStatusChange('completed')}
                  >
                    <CheckCircle2 className="h-4 w-4 text-income" />
                    Marcar como Realizado
                    {pendingChanges.status === 'completed' && <Check className="h-3 w-3 ml-auto" />}
                  </button>
                  <button
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2",
                      pendingChanges.status === 'pending' && "bg-primary/10 text-primary"
                    )}
                    onClick={() => queueStatusChange('pending')}
                  >
                    <Clock className="h-4 w-4 text-warning" />
                    Marcar como Pendente
                    {pendingChanges.status === 'pending' && <Check className="h-3 w-3 ml-auto" />}
                  </button>
                </PopoverContent>
              </Popover>

              <Popover open={editingDescription} onOpenChange={setEditingDescription}>
                <PopoverTrigger asChild>
                  <Button variant={pendingChanges.description ? 'secondary' : 'outline'} size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Editar Descrição
                    {pendingChanges.description && <Check className="h-3 w-3 ml-1 text-income" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Nova descrição para {selectedIds.size} item(ns)</p>
                    <Input
                      placeholder="Digite a nova descrição"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && queueDescriptionChange()}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={queueDescriptionChange} disabled={!newDescription.trim()}>
                        Adicionar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
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
              'flex items-start sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card shadow-card transition-all duration-200 hover:shadow-card-hover animate-slide-up',
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
                className="flex-shrink-0 mt-1 sm:mt-0"
              />
            )}

            <div
              className={cn(
                'flex-shrink-0 p-1.5 sm:p-2 rounded-lg',
                transaction.type === 'income'
                  ? 'bg-income/10 text-income'
                  : 'bg-expense/10 text-expense',
                isPending && 'opacity-60'
              )}
            >
              {transaction.type === 'income' ? (
                <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start sm:items-center gap-1 sm:gap-2 flex-wrap">
                <p className={cn('font-medium text-sm sm:text-base truncate max-w-[150px] sm:max-w-none', isPending && 'text-muted-foreground')}>
                  {transaction.description}
                </p>
                {isPending && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-[10px] sm:text-xs px-1 sm:px-2',
                      overdue 
                        ? 'border-expense text-expense' 
                        : 'border-warning text-warning'
                    )}
                  >
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">{transaction.type === 'income' ? 'A Receber' : 'A Pagar'}</span>
                    <span className="sm:hidden">Pend.</span>
                  </Badge>
                )}
                {transaction.isImported && (
                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2 hidden sm:flex">
                    <Upload className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    Importado
                  </Badge>
                )}
                {isUncategorized && !isPending && (
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs border-warning text-warning px-1 sm:px-2"
                  >
                    <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Categorizar</span>
                    <span className="sm:hidden">Cat.</span>
                  </Badge>
                )}
                {overdue && (
                  <Badge variant="destructive" className="text-[10px] sm:text-xs px-1 sm:px-2">
                    Vencido
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-muted-foreground">
                <span className="whitespace-nowrap">
                  {format(new Date(transaction.date), "dd/MM", {
                    locale: ptBR,
                  })}
                </span>
                {transaction.dueDate && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className={cn("hidden sm:inline", overdue && 'text-expense font-medium')}>
                      Venc: {format(new Date(transaction.dueDate), "dd/MM", { locale: ptBR })}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline">•</span>
                {isUncategorized ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-warning hover:underline font-medium text-xs sm:text-sm">
                        <span className="sm:hidden">+ Cat.</span>
                        <span className="hidden sm:inline">Selecionar categoria</span>
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
                  <span className="truncate max-w-[80px] sm:max-w-none">{transaction.category}</span>
                )}
                {transaction.paymentMethod && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{getPaymentMethodLabel(transaction.paymentMethod)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              <span
                className={cn(
                  'font-semibold text-sm sm:text-lg whitespace-nowrap',
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
