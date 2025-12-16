import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  isWithinInterval,
  subQuarters,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  PieChartIcon,
  BarChart3,
  Activity,
} from 'lucide-react';
import { Transaction, Category } from '@/types/finance';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AdvancedChartsProps {
  transactions: Transaction[];
  categories: Category[];
}

type PeriodType = 'month' | 'quarter' | 'semester' | 'year';

const COLORS = [
  'hsl(192, 70%, 35%)',
  'hsl(160, 60%, 45%)',
  'hsl(10, 78%, 54%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 70%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(100, 60%, 45%)',
];

const periodLabels: Record<PeriodType, string> = {
  month: 'Mês',
  quarter: 'Trimestre',
  semester: 'Semestre',
  year: 'Ano',
};

export function AdvancedCharts({ transactions, categories }: AdvancedChartsProps) {
  const [period, setPeriod] = useState<PeriodType>('month');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'semester':
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
    }
  }, [period]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) =>
      isWithinInterval(new Date(t.date), dateRange)
    );
  }, [transactions, dateRange]);

  // Summary metrics
  const metrics = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);

    const expense = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    const balance = income - expense;
    const profitMargin = income > 0 ? ((income - expense) / income) * 100 : 0;

    // Compare with previous period
    const previousRange = {
      start: subMonths(dateRange.start, period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'semester' ? 6 : 12),
      end: subMonths(dateRange.end, period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'semester' ? 6 : 12),
    };

    const previousTransactions = transactions.filter((t) =>
      isWithinInterval(new Date(t.date), previousRange)
    );

    const prevIncome = previousTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);

    const prevExpense = previousTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;
    const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

    const avgTransaction = filteredTransactions.length > 0
      ? filteredTransactions.reduce((sum, t) => sum + t.value, 0) / filteredTransactions.length
      : 0;

    return {
      income,
      expense,
      balance,
      profitMargin,
      incomeChange,
      expenseChange,
      transactionCount: filteredTransactions.length,
      avgTransaction,
    };
  }, [filteredTransactions, transactions, dateRange, period]);

  // Balance evolution data
  const balanceEvolution = useMemo(() => {
    let intervals: Date[];
    let formatStr: string;

    if (period === 'month') {
      intervals = eachDayOfInterval(dateRange);
      formatStr = 'dd';
    } else if (period === 'quarter') {
      intervals = eachWeekOfInterval(dateRange);
      formatStr = "dd 'de' MMM";
    } else {
      intervals = eachMonthOfInterval(dateRange);
      formatStr = 'MMM';
    }

    let runningBalance = 0;

    // Get initial balance from transactions before period
    transactions
      .filter((t) => new Date(t.date) < dateRange.start)
      .forEach((t) => {
        runningBalance += t.type === 'income' ? t.value : -t.value;
      });

    return intervals.map((date, index) => {
      const nextDate = intervals[index + 1] || dateRange.end;
      const periodTx = filteredTransactions.filter((t) => {
        const txDate = new Date(t.date);
        return txDate >= date && txDate < nextDate;
      });

      const income = periodTx
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

      const expense = periodTx
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

      runningBalance += income - expense;

      return {
        label: format(date, formatStr, { locale: ptBR }),
        saldo: runningBalance,
        entradas: income,
        saídas: expense,
      };
    });
  }, [filteredTransactions, transactions, dateRange, period]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const expensesByCategory = filteredTransactions
      .filter((t) => t.type === 'expense' && t.category)
      .reduce((acc, t) => {
        const cat = t.category || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + t.value;
        return acc;
      }, {} as Record<string, number>);

    const total = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

    return Object.entries(expensesByCategory)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredTransactions]);

  // Income by category
  const incomeByCategory = useMemo(() => {
    const incomeByCategory = filteredTransactions
      .filter((t) => t.type === 'income' && t.category)
      .reduce((acc, t) => {
        const cat = t.category || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + t.value;
        return acc;
      }, {} as Record<string, number>);

    const total = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);

    return Object.entries(incomeByCategory)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Monthly comparison for longer periods
  const monthlyComparison = useMemo(() => {
    if (period === 'month') return [];

    const months = eachMonthOfInterval(dateRange);
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthTx = filteredTransactions.filter((t) =>
        isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
      );

      const income = monthTx
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

      const expense = monthTx
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

      return {
        month: format(month, 'MMM', { locale: ptBR }),
        entradas: income,
        saídas: expense,
        resultado: income - expense,
      };
    });
  }, [filteredTransactions, dateRange, period]);

  // Top expenses
  const topExpenses = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredTransactions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 rounded-lg shadow-elevated border border-border">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-income" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-expense" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {format(dateRange.start, "dd 'de' MMMM", { locale: ptBR })} -{' '}
            {format(dateRange.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
          <TabsList>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="quarter">Trimestre</TabsTrigger>
            <TabsTrigger value="semester">Semestre</TabsTrigger>
            <TabsTrigger value="year">Ano</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-income-muted border-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Entradas</span>
            <TrendIcon value={metrics.incomeChange} />
          </div>
          <p className="text-2xl font-bold text-income">{formatCurrency(metrics.income)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.incomeChange >= 0 ? '+' : ''}
            {metrics.incomeChange.toFixed(1)}% vs período anterior
          </p>
        </Card>

        <Card className="p-4 bg-expense-muted border-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Saídas</span>
            <TrendIcon value={-metrics.expenseChange} />
          </div>
          <p className="text-2xl font-bold text-expense">{formatCurrency(metrics.expense)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.expenseChange >= 0 ? '+' : ''}
            {metrics.expenseChange.toFixed(1)}% vs período anterior
          </p>
        </Card>

        <Card className={cn('p-4 border-none', metrics.balance >= 0 ? 'bg-income-muted' : 'bg-expense-muted')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Resultado</span>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn('text-2xl font-bold', metrics.balance >= 0 ? 'text-income' : 'text-expense')}>
            {formatCurrency(metrics.balance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Margem: {metrics.profitMargin.toFixed(1)}%
          </p>
        </Card>

        <Card className="p-4 border-none bg-accent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Transações</span>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{metrics.transactionCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Média: {formatCurrency(metrics.avgTransaction)}
          </p>
        </Card>
      </div>

      {/* Balance Evolution */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Evolução do Saldo - {periodLabels[period]}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={balanceEvolution}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(192, 70%, 35%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(192, 70%, 35%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatCompact}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatCompact}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="right" dataKey="entradas" fill="hsl(160, 60%, 45%)" name="Entradas" radius={[2, 2, 0, 0]} opacity={0.8} />
              <Bar yAxisId="right" dataKey="saídas" fill="hsl(10, 78%, 54%)" name="Saídas" radius={[2, 2, 0, 0]} opacity={0.8} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="saldo"
                stroke="hsl(192, 70%, 35%)"
                strokeWidth={2}
                fill="url(#colorBalance)"
                name="Saldo"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Monthly Comparison (for quarter, semester, year) */}
      {period !== 'month' && monthlyComparison.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Comparativo Mensal
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="entradas" fill="hsl(160, 60%, 45%)" name="Entradas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saídas" fill="hsl(10, 78%, 54%)" name="Saídas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resultado" fill="hsl(192, 70%, 35%)" name="Resultado" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Category Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense Distribution */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-expense" />
            Saídas por Categoria
          </h3>
          {categoryBreakdown.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {categoryBreakdown.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Nenhuma despesa categorizada
            </div>
          )}
        </Card>

        {/* Income Distribution */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-income" />
            Entradas por Categoria
          </h3>
          {incomeByCategory.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {incomeByCategory.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {incomeByCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              Nenhuma entrada categorizada
            </div>
          )}
        </Card>
      </div>

      {/* Top Expenses */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Maiores Despesas do Período</h3>
        {topExpenses.length > 0 ? (
          <div className="space-y-3">
            {topExpenses.map((expense, index) => (
              <div
                key={expense.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-expense/10 text-expense font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.category || 'Sem categoria'} • {format(new Date(expense.date), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
                <span className="font-semibold text-expense">
                  {formatCurrency(expense.value)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Nenhuma despesa no período
          </div>
        )}
      </Card>
    </div>
  );
}
