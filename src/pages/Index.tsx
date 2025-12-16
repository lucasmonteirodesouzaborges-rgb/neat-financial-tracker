import { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { TransactionList } from '@/components/TransactionList';
import { TransactionForm } from '@/components/TransactionForm';
import { ImportDialog } from '@/components/ImportDialog';
import { Charts } from '@/components/Charts';
import { AdvancedCharts } from '@/components/AdvancedCharts';
import { Filters, FilterState } from '@/components/Filters';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const {
    transactions,
    categories,
    addCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    stats,
    uncategorizedCount,
    isLoaded,
  } = useTransactions();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    type: 'all',
    status: 'all',
    category: 'all',
    onlyUncategorized: false,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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

  const handleImport = (imported: Parameters<typeof importTransactions>[0]) => {
    const count = importTransactions(imported);
    toast({
      title: 'Importação concluída!',
      description: `${count} lançamentos foram importados. Categorize os itens pendentes.`,
    });
    return count;
  };

  const handleDelete = (id: string) => {
    deleteTransaction(id);
    toast({
      title: 'Lançamento excluído',
      description: 'O lançamento foi removido com sucesso.',
    });
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
              <StatCard
                title="Saldo Atual"
                value={formatCurrency(stats.currentBalance)}
                icon={Wallet}
                variant={stats.currentBalance >= 0 ? 'income' : 'expense'}
              />
              <StatCard
                title="Entradas (Mês)"
                value={formatCurrency(stats.monthlyIncome)}
                icon={TrendingUp}
                variant="income"
              />
              <StatCard
                title="Saídas (Mês)"
                value={formatCurrency(stats.monthlyExpense)}
                icon={TrendingDown}
                variant="expense"
              />
              <StatCard
                title="A Receber"
                value={formatCurrency(stats.toReceive)}
                icon={Clock}
                variant="income"
              />
              <StatCard
                title="A Pagar"
                value={formatCurrency(stats.toPay)}
                icon={Clock}
                variant="expense"
              />
              <StatCard
                title="Projeção"
                value={formatCurrency(stats.projectedBalance)}
                icon={Wallet}
                variant={stats.projectedBalance >= 0 ? 'default' : 'expense'}
              />
            </div>

            {/* Quick Charts */}
            <Charts transactions={transactions} categories={categories} />

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
            />

            <div className="bg-card rounded-xl p-5 shadow-card">
              <TransactionList
                transactions={filteredTransactions}
                categories={categories}
                onUpdate={updateTransaction}
                onDelete={handleDelete}
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
        onSubmit={(transaction) => {
          addTransaction(transaction);
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
    </div>
  );
};

export default Index;
