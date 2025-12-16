import { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, DEFAULT_CATEGORIES, Category } from '@/types/finance';

const STORAGE_KEY = 'cashflow_transactions';
const CATEGORIES_KEY = 'cashflow_categories';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedCategories = localStorage.getItem(CATEGORIES_KEY);
    
    if (stored) {
      setTransactions(JSON.parse(stored));
    }
    if (storedCategories) {
      setCategories(JSON.parse(storedCategories));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }
  }, [transactions, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
  }, [categories, isLoaded]);

  const addTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setTransactions(prev => [newTransaction, ...prev]);
    return newTransaction;
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const importTransactions = (newTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    const transactionsToAdd = newTransactions.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    setTransactions(prev => [...transactionsToAdd, ...prev]);
    return transactionsToAdd.length;
  };

  const uncategorizedCount = useMemo(
    () => transactions.filter(t => !t.category).length,
    [transactions]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const completedMonthly = monthlyTransactions.filter(t => t.status === 'completed');

    const totalIncome = completedMonthly
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);

    const totalExpense = completedMonthly
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    const allCompleted = transactions.filter(t => t.status === 'completed');

    const allTimeIncome = allCompleted
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.value, 0);

    const allTimeExpense = allCompleted
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.value, 0);

    // A Receber (pending income)
    const toReceive = transactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + t.value, 0);

    // A Pagar (pending expense)
    const toPay = transactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + t.value, 0);

    return {
      monthlyIncome: totalIncome,
      monthlyExpense: totalExpense,
      monthlyBalance: totalIncome - totalExpense,
      currentBalance: allTimeIncome - allTimeExpense,
      toReceive,
      toPay,
      projectedBalance: allTimeIncome - allTimeExpense + toReceive - toPay,
      uncategorizedCount,
    };
  }, [transactions, uncategorizedCount]);

  return {
    transactions,
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    stats,
    uncategorizedCount,
    isLoaded,
  };
}
