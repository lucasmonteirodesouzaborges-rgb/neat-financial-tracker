import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  CalendarIcon,
  Settings,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { TransactionList } from '@/components/TransactionList';
import { TransactionForm } from '@/components/TransactionForm';
import { EditTransactionForm } from '@/components/EditTransactionForm';
import { ImportDialog } from '@/components/ImportDialog';
import { Charts } from '@/components/Charts';
import { AdvancedCharts } from '@/components/AdvancedCharts';
import { Filters, FilterState } from '@/components/Filters';
import { ReconciliationTool } from '@/components/ReconciliationTool';
import { CategoryManager } from '@/components/CategoryManager';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type DashboardPeriod = 'month' | 'quarter' | 'semester' | 'year' | 'all' | 'custom';

const Index = () => {
  const {
    transactions,
    categories,
    initialBalance,
    addCategory,
    updateCategory,
    deleteCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    updateInitialBalance,
    stats,
    uncategorizedCount,
    isLoaded,
  } = useTransactions();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    type: 'all',
    status: 'all',
    category: 'all',
    onlyUncategorized: false,
  });

  // Dashboard period state
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [tempInitialBalance, setTempInitialBalance] = useState('');
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate dashboard date range based on selected period
  const dashboardDateRange = useMemo(() => {
    const now = new Date();
    switch (dashboardPeriod) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'semester':
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      case 'all':
      default:
        return { start: undefined, end: undefined };
    }
  }, [dashboardPeriod, customStartDate, customEndDate]);

  // Dashboard stats based on selected period
  const dashboardStats = useMemo(() => {
    const { start, end } = dashboardDateRange;
    
    const filteredTx = transactions.filter((t) => {
      if (start && new Date(t.date) < start) return false;
      if (end && new Date(t.date) > end) return false;
      return true;
    });

    const completed = filteredTx.filter((t) => t.status === 'completed');

    const totalIncome = completed
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);

    const totalExpense = completed
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    // For "all time" balance, use all completed transactions
    const allCompleted = transactions.filter((t) => t.status === 'completed');
    const allTimeIncome = allCompleted
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);
    const allTimeExpense = allCompleted
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    // Pending amounts (A Receber / A Pagar)
    const toReceive = transactions
      .filter((t) => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + t.value, 0);
    const toPay = transactions
      .filter((t) => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + t.value, 0);

    return {
      periodIncome: totalIncome,
      periodExpense: totalExpense,
      periodBalance: totalIncome - totalExpense,
      currentBalance: initialBalance + allTimeIncome - allTimeExpense,
      toReceive,
      allTimeIncome,
      allTimeExpense,
      toPay,
      projectedBalance: initialBalance + allTimeIncome - allTimeExpense + toReceive - toPay,
    };
  }, [transactions, dashboardDateRange, initialBalance]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.startDate && new Date(t.date) < filters.startDate) return false;
      if (filters.endDate && new Date(t.date) > filters.endDate) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.category !== 'all' && t.category !== filters.category) return false;
      if (filters.onlyUncategorized && t.category) return false;
      return true;
    });
  }, [transactions, filters]);

  // Filter transactions for dashboard charts based on period
  const dashboardTransactions = useMemo(() => {
    const { start, end } = dashboardDateRange;
    return transactions.filter((t) => {
      if (start && new Date(t.date) < start) return false;
      if (end && new Date(t.date) > end) return false;
      return true;
    });
  }, [transactions, dashboardDateRange]);

  const handleImport = async (imported: Parameters<typeof importTransactions>[0]) => {
    const count = await importTransactions(imported);
    toast({
      title: 'Importação concluída!',
      description: `${count} lançamentos foram importados. Categorize os itens pendentes.`,
    });
    return count;
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    toast({
      title: 'Lançamento excluído',
      description: 'O lançamento foi removido com sucesso.',
    });
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Transaction>) => {
    await Promise.all(ids.map((id) => updateTransaction(id, updates)));
    toast({
      title: 'Lançamentos atualizados!',
      description: `${ids.length} lançamento(s) foram atualizados.`,
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    await Promise.all(ids.map((id) => deleteTransaction(id)));
    toast({
      title: 'Lançamentos excluídos',
      description: `${ids.length} lançamento(s) foram removidos.`,
    });
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleEditSubmit = async (id: string, updates: Partial<Transaction>) => {
    await updateTransaction(id, updates);
    toast({
      title: 'Lançamento atualizado!',
      description: 'As alterações foram salvas com sucesso.',
    });
  };

  const getPeriodLabel = () => {
    const { start, end } = dashboardDateRange;
    if (!start || !end) return 'Todo o período';
    return `${format(start, "dd/MM/yyyy", { locale: ptBR })} - ${format(end, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const handleSaveInitialBalance = async () => {
    const value = parseFloat(tempInitialBalance.replace(',', '.')) || 0;
    await updateInitialBalance(value);
    setShowBalanceDialog(false);
    toast({
      title: 'Saldo inicial atualizado!',
      description: `Novo saldo inicial: ${formatCurrency(value)}`,
    });
  };

  const openBalanceDialog = () => {
    setTempInitialBalance(initialBalance.toString().replace('.', ','));
    setShowBalanceDialog(true);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onNewTransaction={() => setShowTransactionForm(true)}
        onImport={() => setShowImportDialog(true)}
        uncategorizedCount={uncategorizedCount}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl shadow-card">
              <span className="text-sm font-medium text-muted-foreground">Período:</span>
              <Select value={dashboardPeriod} onValueChange={(v) => setDashboardPeriod(v as DashboardPeriod)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="semester">Semestre</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {dashboardPeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!customStartDate && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {customStartDate ? format(customStartDate, 'dd/MM/yyyy') : 'Início'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!customEndDate && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {customEndDate ? format(customEndDate, 'dd/MM/yyyy') : 'Fim'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <span className="text-sm text-muted-foreground ml-auto">
                {getPeriodLabel()}
              </span>
            </div>

            {/* Alert for uncategorized */}
            {uncategorizedCount > 0 && (
              <div className="flex items-center gap-3 p-4 bg-warning-muted rounded-xl border border-warning/30 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {uncategorizedCount} lançamento{uncategorizedCount > 1 ? 's' : ''} pendente{uncategorizedCount > 1 ? 's' : ''} de categorização
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Categorize para uma análise financeira mais precisa
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('transactions');
                    setFilters((f) => ({ ...f, onlyUncategorized: true }));
                  }}
                  className="text-sm font-medium text-warning hover:underline"
                >
                  Categorizar agora
                </button>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="relative">
                <StatCard
                  title="Saldo Atual"
                  value={formatCurrency(dashboardStats.currentBalance)}
                  icon={Wallet}
                  variant={dashboardStats.currentBalance >= 0 ? 'income' : 'expense'}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={openBalanceDialog}
                  title="Ajustar saldo inicial"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
              <StatCard
                title="Entradas"
                value={formatCurrency(dashboardStats.periodIncome)}
                icon={TrendingUp}
                variant="income"
              />
              <StatCard
                title="Saídas"
                value={formatCurrency(dashboardStats.periodExpense)}
                icon={TrendingDown}
                variant="expense"
              />
              <StatCard
                title="A Receber"
                value={formatCurrency(dashboardStats.toReceive)}
                icon={Clock}
                variant="income"
              />
              <StatCard
                title="A Pagar"
                value={formatCurrency(dashboardStats.toPay)}
                icon={Clock}
                variant="expense"
              />
              <StatCard
                title="Projeção"
                value={formatCurrency(dashboardStats.projectedBalance)}
                icon={Wallet}
                variant={dashboardStats.projectedBalance >= 0 ? 'default' : 'expense'}
              />
            </div>

            {/* Diagnostic & Reconciliation Tools */}
            <div className="flex flex-wrap gap-2">
              <Collapsible open={showDiagnostic} onOpenChange={setShowDiagnostic}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="h-4 w-4 mr-2" />
                    {showDiagnostic ? 'Ocultar' : 'Mostrar'} Diagnóstico
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
              <Button variant="outline" size="sm" onClick={() => setShowReconciliation(true)}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Reconciliar com Banco
              </Button>
            </div>
            
            <Collapsible open={showDiagnostic} onOpenChange={setShowDiagnostic}>
              <CollapsibleContent>
                <div className="p-4 bg-muted rounded-xl space-y-3 mb-4">
                  <h4 className="font-semibold text-sm">Auditoria de Transações</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-muted-foreground">Saldo Inicial</p>
                      <p className="font-semibold text-lg">{formatCurrency(initialBalance)}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-muted-foreground">Total Entradas</p>
                      <p className="font-semibold text-lg text-income">{formatCurrency(dashboardStats.allTimeIncome)}</p>
                      <p className="text-xs text-muted-foreground">
                        {transactions.filter(t => t.type === 'income' && t.status === 'completed').length} lançamentos
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-muted-foreground">Total Saídas</p>
                      <p className="font-semibold text-lg text-expense">{formatCurrency(dashboardStats.allTimeExpense)}</p>
                      <p className="text-xs text-muted-foreground">
                        {transactions.filter(t => t.type === 'expense' && t.status === 'completed').length} lançamentos
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-muted-foreground">Cálculo</p>
                      <p className="font-semibold text-sm">
                        {formatCurrency(initialBalance)} + {formatCurrency(dashboardStats.allTimeIncome)} - {formatCurrency(dashboardStats.allTimeExpense)}
                      </p>
                      <p className="font-bold text-lg">= {formatCurrency(dashboardStats.currentBalance)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se o saldo não corresponde ao extrato bancário, ajuste o "Saldo Inicial" clicando no ícone ⚙️ no card "Saldo Atual".
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Quick Charts */}
            <Charts transactions={dashboardTransactions} categories={categories} />

            {/* Recent Transactions */}
            <div className="bg-card rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Últimos Lançamentos</h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-sm text-primary hover:underline"
                >
                  Ver todos
                </button>
              </div>
              <TransactionList
                transactions={transactions.slice(0, 5)}
                categories={categories}
                onUpdate={updateTransaction}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onBulkUpdate={handleBulkUpdate}
                onBulkDelete={handleBulkDelete}
              />
            </div>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Lançamentos</h2>
            </div>
            
            <Filters
              filters={filters}
              onFiltersChange={setFilters}
              categories={categories}
              onManageCategories={() => setShowCategoryManager(true)}
            />

            <div className="bg-card rounded-xl p-5 shadow-card">
              <TransactionList
                transactions={filteredTransactions}
                categories={categories}
                onUpdate={updateTransaction}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onBulkUpdate={handleBulkUpdate}
                onBulkDelete={handleBulkDelete}
              />
            </div>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            <h2 className="text-xl font-bold">Análise Financeira</h2>
            <AdvancedCharts transactions={transactions} categories={categories} />
          </>
        )}
      </main>

      {/* Modals */}
      <TransactionForm
        open={showTransactionForm}
        onOpenChange={setShowTransactionForm}
        onSubmit={async (transaction) => {
          await addTransaction(transaction);
          toast({
            title: 'Lançamento adicionado!',
            description: 'O lançamento foi registrado com sucesso.',
          });
        }}
        categories={categories}
        onAddCategory={addCategory}
      />

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />

      <EditTransactionForm
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
        onSubmit={handleEditSubmit}
        categories={categories}
        onAddCategory={addCategory}
      />

      {/* Balance Adjustment Dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Saldo Inicial</DialogTitle>
            <DialogDescription>
              O saldo inicial é usado para ajustar o cálculo do saldo atual. 
              Se o saldo mostrado não corresponde ao extrato do banco, defina o valor inicial aqui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="initialBalance">Saldo Inicial (R$)</Label>
              <Input
                id="initialBalance"
                placeholder="0,00"
                value={tempInitialBalance}
                onChange={(e) => setTempInitialBalance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveInitialBalance()}
              />
              <p className="text-xs text-muted-foreground">
                Exemplo: Se o banco mostra R$ 9.214,87 e o app calcula R$ 9.052,79, 
                defina o saldo inicial como 162,08 (a diferença).
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">Prévia do cálculo:</p>
              <p>
                {formatCurrency(parseFloat(tempInitialBalance.replace(',', '.')) || 0)} + {formatCurrency(dashboardStats.allTimeIncome)} - {formatCurrency(dashboardStats.allTimeExpense)} = {' '}
                <span className="font-bold">
                  {formatCurrency((parseFloat(tempInitialBalance.replace(',', '.')) || 0) + dashboardStats.allTimeIncome - dashboardStats.allTimeExpense)}
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBalanceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveInitialBalance}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconciliation Tool */}
      <ReconciliationTool
        open={showReconciliation}
        onOpenChange={setShowReconciliation}
        transactions={transactions}
        categories={categories}
        initialBalance={initialBalance}
        onUpdateTransaction={updateTransaction}
      />

      {/* Category Manager */}
      <CategoryManager
        open={showCategoryManager}
        onOpenChange={setShowCategoryManager}
        categories={categories}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />
    </div>
  );
};

export default Index;
