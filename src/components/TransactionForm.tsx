import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
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

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  categories: Category[];
}

export function TransactionForm({
  open,
  onOpenChange,
  onSubmit,
  categories,
}: TransactionFormProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [category, setCategory] = useState('');
  const [value, setValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  const filteredCategories = categories.filter((c) => c.type === type);
  const isPending = status === 'pending';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const numericValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numericValue) || numericValue <= 0) return;

    onSubmit({
      date: format(date, 'yyyy-MM-dd'),
      dueDate: isPending && dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      description,
      category: category || null,
      value: numericValue,
      type,
      status,
      paymentMethod: isPending ? null : paymentMethod,
      isImported: false,
      isReconciled: !isPending,
    });

    // Reset form
    setDate(new Date());
    setDueDate(undefined);
    setDescription('');
    setType('expense');
    setStatus('completed');
    setCategory('');
    setValue('');
    setPaymentMethod('pix');
    onOpenChange(false);
  };

  const getStatusLabel = () => {
    if (type === 'income') {
      return isPending ? 'A Receber' : 'Recebido';
    }
    return isPending ? 'A Pagar' : 'Pago';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <p className="text-xs text-muted-foreground">
                {type === 'income' 
                  ? (isPending ? 'Valor ainda não recebido' : 'Valor já recebido')
                  : (isPending ? 'Valor ainda não pago' : 'Valor já pago')
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-sm', !isPending && 'font-medium')}>
                {type === 'income' ? 'Recebido' : 'Pago'}
              </span>
              <Switch
                checked={isPending}
                onCheckedChange={(checked) => setStatus(checked ? 'pending' : 'completed')}
              />
              <span className={cn('text-sm', isPending && 'font-medium text-warning')}>
                {type === 'income' ? 'A Receber' : 'A Pagar'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
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
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
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

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <SelectContent>
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
            {isPending 
              ? `Adicionar ${type === 'income' ? 'A Receber' : 'A Pagar'}`
              : 'Adicionar Lançamento'
            }
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
