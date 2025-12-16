import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
  Category,
  PAYMENT_METHODS,
} from '@/types/finance';

interface EditTransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSubmit: (id: string, updates: Partial<Transaction>) => void;
  categories: Category[];
  onAddCategory?: (category: Omit<Category, 'id'>) => void;
}

export function EditTransactionForm({
  open,
  onOpenChange,
  transaction,
  onSubmit,
  categories,
  onAddCategory,
}: EditTransactionFormProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [category, setCategory] = useState('');
  const [value, setValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Load transaction data when opened
  useEffect(() => {
    if (transaction && open) {
      setDate(new Date(transaction.date));
      setDueDate(transaction.dueDate ? new Date(transaction.dueDate) : undefined);
      setDescription(transaction.description);
      setType(transaction.type);
      setStatus(transaction.status);
      setCategory(transaction.category || '');
      setValue(transaction.value.toString().replace('.', ','));
      setPaymentMethod(transaction.paymentMethod || 'pix');
    }
  }, [transaction, open]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const isPending = status === 'pending';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    
    const numericValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numericValue) || numericValue <= 0) return;

    onSubmit(transaction.id, {
      date: format(date, 'yyyy-MM-dd'),
      dueDate: isPending && dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      description,
      category: category || null,
      value: numericValue,
      type,
      status,
      paymentMethod: isPending ? null : paymentMethod,
      isReconciled: !isPending,
    });

    onOpenChange(false);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    
    const colors = ['#10B981', '#06B6D4', '#8B5CF6', '#F97316', '#EC4899', '#EF4444'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    onAddCategory({
      name: newCategoryName.trim(),
      type,
      color: randomColor,
    });
    
    setCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={type === 'income' ? 'default' : 'outline'}
              className={cn(
                'w-full',
                type === 'income' && 'bg-income hover:bg-income/90'
              )}
              onClick={() => {
                setType('income');
                setCategory('');
              }}
            >
              Entrada
            </Button>
            <Button
              type="button"
              variant={type === 'expense' ? 'default' : 'outline'}
              className={cn(
                'w-full',
                type === 'expense' && 'bg-expense hover:bg-expense/90'
              )}
              onClick={() => {
                setType('expense');
                setCategory('');
              }}
            >
              Saída
            </Button>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={status === 'completed' ? 'default' : 'outline'}
                className={cn(
                  'w-full',
                  status === 'completed' && 'bg-primary hover:bg-primary/90'
                )}
                onClick={() => setStatus('completed')}
              >
                {type === 'income' ? 'Recebido' : 'Pago'}
              </Button>
              <Button
                type="button"
                variant={status === 'pending' ? 'default' : 'outline'}
                className={cn(
                  'w-full',
                  status === 'pending' && 'bg-warning hover:bg-warning/90 text-warning-foreground'
                )}
                onClick={() => setStatus('pending')}
              >
                {type === 'income' ? 'A Receber' : 'A Pagar'}
              </Button>
            </div>
          </div>

          {/* Dates */}
          <div className={cn('grid gap-3', isPending ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-2">
              <Label>{isPending ? 'Data de Emissão' : 'Data'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isPending && (
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pagamento de fornecedor"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria</Label>
              {onAddCategory && (
                <button
                  type="button"
                  onClick={() => setShowNewCategory(!showNewCategory)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Nova categoria
                </button>
              )}
            </div>
            
            {showNewCategory ? (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!isPending && (
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full">
            Salvar Alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
