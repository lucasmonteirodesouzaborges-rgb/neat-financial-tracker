import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowUpDown,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import { Transaction, Category } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ReconciliationToolProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  categories: Category[];
  initialBalance: number;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
}

export function ReconciliationTool({
  open,
  onOpenChange,
  transactions,
  initialBalance,
  onUpdateTransaction,
}: ReconciliationToolProps) {
  const [bankBalance, setBankBalance] = useState('');
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const completedTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const totals = useMemo(() => {
    const income = completedTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);
    const expense = completedTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);
    return {
      income,
      expense,
      incomeCount: completedTransactions.filter((t) => t.type === 'income').length,
      expenseCount: completedTransactions.filter((t) => t.type === 'expense').length,
      calculatedBalance: initialBalance + income - expense,
    };
  }, [completedTransactions, initialBalance]);

  const bankBalanceValue = parseFloat(bankBalance.replace(',', '.')) || 0;
  const difference = bankBalanceValue - totals.calculatedBalance;
  const halfDifference = Math.abs(difference / 2);

  // Find suspicious transactions
  const suspiciousTransactions = useMemo(() => {
    if (Math.abs(difference) < 0.01) return [];

    const tolerance = 0.05;
    const suspects: { transaction: Transaction; reason: string }[] = [];

    completedTransactions.forEach((t) => {
      // Check if value matches the full difference
      if (Math.abs(t.value - Math.abs(difference)) < tolerance) {
        suspects.push({
          transaction: t,
          reason: `Valor igual à discrepância (${formatCurrency(Math.abs(difference))})`,
        });
      }
      // Check if value matches half the difference (type inversion)
      if (Math.abs(t.value - halfDifference) < tolerance) {
        suspects.push({
          transaction: t,
          reason: `Valor = metade da discrepância (possível inversão de tipo)`,
        });
      }
    });

    // Check for duplicates
    const valueMap = new Map<string, Transaction[]>();
    completedTransactions.forEach((t) => {
      const key = `${t.value.toFixed(2)}-${t.date}`;
      if (!valueMap.has(key)) {
        valueMap.set(key, []);
      }
      valueMap.get(key)!.push(t);
    });

    valueMap.forEach((txs) => {
      if (txs.length > 1) {
        txs.forEach((t) => {
          if (!suspects.find((s) => s.transaction.id === t.id)) {
            suspects.push({
              transaction: t,
              reason: 'Possível duplicata (mesmo valor e data)',
            });
          }
        });
      }
    });

    return suspects;
  }, [completedTransactions, difference, halfDifference]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return completedTransactions;
    const query = searchQuery.toLowerCase();
    return completedTransactions.filter(
      (t) =>
        t.description.toLowerCase().includes(query) ||
        t.value.toString().includes(query)
    );
  }, [completedTransactions, searchQuery]);

  const toggleVerified = (id: string) => {
    const newSet = new Set(verifiedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setVerifiedIds(newSet);
  };

  const invertType = (transaction: Transaction) => {
    onUpdateTransaction(transaction.id, {
      type: transaction.type === 'income' ? 'expense' : 'income',
    });
  };

  const exportCSV = () => {
    const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Verificado'];
    const rows = completedTransactions.map((t) => [
      format(new Date(t.date), 'dd/MM/yyyy'),
      `"${t.description.replace(/"/g, '""')}"`,
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.value.toFixed(2).replace('.', ','),
      verifiedIds.has(t.id) ? 'Sim' : 'Não',
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliacao_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Ferramenta de Reconciliação
          </DialogTitle>
          <DialogDescription>
            Compare o saldo do app com o extrato bancário e encontre discrepâncias
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Bank Balance Input & Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-xl">
            <div className="space-y-2">
              <Label htmlFor="bankBalance">Saldo do Banco (R$)</Label>
              <Input
                id="bankBalance"
                placeholder="0,00"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Calculado</p>
              <p className="text-xl font-bold">{formatCurrency(totals.calculatedBalance)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(initialBalance)} + {formatCurrency(totals.income)} - {formatCurrency(totals.expense)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Diferença</p>
              <p
                className={`text-xl font-bold ${
                  Math.abs(difference) < 0.01
                    ? 'text-income'
                    : 'text-expense'
                }`}
              >
                {bankBalanceValue > 0 ? formatCurrency(difference) : '—'}
              </p>
              {bankBalanceValue > 0 && Math.abs(difference) >= 0.01 && (
                <p className="text-xs text-muted-foreground">
                  Metade: {formatCurrency(halfDifference)}
                </p>
              )}
            </div>
          </div>

          {/* Suspicious Transactions */}
          {bankBalanceValue > 0 && suspiciousTransactions.length > 0 && (
            <div className="p-4 bg-warning-muted rounded-xl border border-warning/30">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h4 className="font-semibold text-sm">
                  {suspiciousTransactions.length} transação(ões) suspeita(s) encontrada(s)
                </h4>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {suspiciousTransactions.map(({ transaction, reason }) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-2 bg-background rounded-lg text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), 'dd/MM/yyyy')} •{' '}
                        <span className={transaction.type === 'income' ? 'text-income' : 'text-expense'}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.value)}
                        </span>
                      </p>
                      <p className="text-xs text-warning">{reason}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => invertType(transaction)}
                      title="Inverter tipo"
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-1" />
                      Inverter
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bankBalanceValue > 0 && Math.abs(difference) < 0.01 && (
            <div className="p-4 bg-income/10 rounded-xl border border-income/30 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-income" />
              <p className="font-medium text-income">Saldos conferem! Nenhuma discrepância encontrada.</p>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 bg-income/10 rounded-lg">
              <p className="text-muted-foreground">Entradas</p>
              <p className="font-semibold text-income">{formatCurrency(totals.income)}</p>
              <p className="text-xs text-muted-foreground">{totals.incomeCount} lançamentos</p>
            </div>
            <div className="p-3 bg-expense/10 rounded-lg">
              <p className="text-muted-foreground">Saídas</p>
              <p className="font-semibold text-expense">{formatCurrency(totals.expense)}</p>
              <p className="text-xs text-muted-foreground">{totals.expenseCount} lançamentos</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Total</p>
              <p className="font-semibold">{completedTransactions.length} lançamentos</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Verificados</p>
              <p className="font-semibold">{verifiedIds.size} de {completedTransactions.length}</p>
            </div>
          </div>

          {/* Search & Export */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou valor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>

          {/* Transaction List */}
          <ScrollArea className="flex-1 min-h-0 border rounded-lg">
            <div className="divide-y">
              {filteredTransactions.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
                    verifiedIds.has(t.id) ? 'bg-income/5' : ''
                  }`}
                >
                  <Checkbox
                    checked={verifiedIds.has(t.id)}
                    onCheckedChange={() => toggleVerified(t.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.date), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <Badge
                    variant={t.type === 'income' ? 'default' : 'destructive'}
                    className="shrink-0"
                  >
                    {t.type === 'income' ? 'Entrada' : 'Saída'}
                  </Badge>
                  <p
                    className={`font-semibold text-sm min-w-[100px] text-right ${
                      t.type === 'income' ? 'text-income' : 'text-expense'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.value)}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => invertType(t)}
                    title="Inverter tipo"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma transação encontrada
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
