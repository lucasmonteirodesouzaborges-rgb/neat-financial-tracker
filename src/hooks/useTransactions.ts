import { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, DEFAULT_CATEGORIES, Category, TransactionType, TransactionStatus, PaymentMethod } from '@/types/finance';
import { useAccounts } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';

// Map database row to frontend Transaction type
function mapDbToTransaction(row: any): Transaction {
  return {
    id: row.id,
    date: row.date,
    dueDate: row.due_date || undefined,
    description: row.description,
    category: row.category_id,
    value: Number(row.value),
    type: row.type as TransactionType,
    status: row.status as TransactionStatus,
    paymentMethod: row.payment_method as PaymentMethod | null,
    isImported: row.is_imported || false,
    isReconciled: row.is_reconciled || false,
    createdAt: row.created_at,
  };
}

// Map database row to frontend Category type
function mapDbToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TransactionType,
    color: row.color || '#6366F1',
  };
}

export function useTransactions() {
  const { selectedAccount } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map()); // id -> Category
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch transactions for selected account
  const fetchTransactions = useCallback(async () => {
    if (!selectedAccount) {
      setTransactions([]);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', selectedAccount.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions((data || []).map(mapDbToTransaction));
  }, [selectedAccount?.id]);

  // Fetch categories for selected account
  const fetchCategories = useCallback(async () => {
    if (!selectedAccount) {
      setCategories(DEFAULT_CATEGORIES);
      const defaultMap = new Map<string, Category>();
      DEFAULT_CATEGORIES.forEach(c => defaultMap.set(c.id, c));
      setCategoryMap(defaultMap);
      return;
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('account_id', selectedAccount.id)
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    if (data && data.length > 0) {
      const cats = data.map(mapDbToCategory);
      setCategories(cats);
      const map = new Map<string, Category>();
      cats.forEach(c => map.set(c.id, c));
      setCategoryMap(map);
    } else {
      // If no categories exist for this account, create default ones
      await createDefaultCategories();
    }
  }, [selectedAccount?.id]);

  // Create default categories for new account
  const createDefaultCategories = async () => {
    if (!selectedAccount) return;

    const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
      account_id: selectedAccount.id,
      name: cat.name,
      type: cat.type,
      color: cat.color,
    }));

    const { data, error } = await supabase
      .from('categories')
      .insert(defaultCats)
      .select();

    if (error) {
      console.error('Error creating default categories:', error);
      setCategories(DEFAULT_CATEGORIES);
      const defaultMap = new Map<string, Category>();
      DEFAULT_CATEGORIES.forEach(c => defaultMap.set(c.id, c));
      setCategoryMap(defaultMap);
      return;
    }

    const cats = (data || []).map(mapDbToCategory);
    setCategories(cats);
    const map = new Map<string, Category>();
    cats.forEach(c => map.set(c.id, c));
    setCategoryMap(map);
  };

  // Helper to get category name from id
  const getCategoryName = useCallback((categoryId: string | null): string | null => {
    if (!categoryId) return null;
    return categoryMap.get(categoryId)?.name || null;
  }, [categoryMap]);

  // Helper to get category id from name
  const getCategoryId = useCallback((categoryName: string | null): string | null => {
    if (!categoryName) return null;
    const cat = categories.find(c => c.name === categoryName);
    return cat?.id || null;
  }, [categories]);

  // Initial load - categories first, then transactions (need category map for mapping)
  useEffect(() => {
    const loadData = async () => {
      setIsLoaded(false);
      // Fetch categories first to build the map
      await fetchCategories();
    };

    if (selectedAccount) {
      loadData();
    } else {
      setTransactions([]);
      setCategories(DEFAULT_CATEGORIES);
      setIsLoaded(true);
    }
  }, [selectedAccount?.id, fetchCategories]);

  // Fetch transactions after categories are loaded
  useEffect(() => {
    const loadTransactions = async () => {
      if (selectedAccount && categoryMap.size > 0) {
        await fetchTransactionsWithCategories();
        setIsLoaded(true);
      }
    };
    loadTransactions();
  }, [categoryMap]);

  // Fetch transactions and map category_id to category name
  const fetchTransactionsWithCategories = async () => {
    if (!selectedAccount) {
      setTransactions([]);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', selectedAccount.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    // Map transactions and convert category_id to category name
    const mappedTransactions = (data || []).map(row => ({
      id: row.id,
      date: row.date,
      dueDate: row.due_date || undefined,
      description: row.description,
      category: getCategoryName(row.category_id),
      value: Number(row.value),
      type: row.type as TransactionType,
      status: row.status as TransactionStatus,
      paymentMethod: row.payment_method as PaymentMethod | null,
      isImported: row.is_imported || false,
      isReconciled: row.is_reconciled || false,
      createdAt: row.created_at,
    }));

    setTransactions(mappedTransactions);
  };

  // Get initial balance from account
  const initialBalance = selectedAccount?.initial_balance || 0;

  const updateInitialBalance = async (value: number) => {
    if (!selectedAccount) return;

    const { error } = await supabase
      .from('accounts')
      .update({ initial_balance: value })
      .eq('id', selectedAccount.id);

    if (error) {
      console.error('Error updating initial balance:', error);
    }
    // Note: The selectedAccount will be updated when AccountContext refreshes
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    if (!selectedAccount) return null;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        account_id: selectedAccount.id,
        name: category.name,
        type: category.type,
        color: category.color,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding category:', error);
      return null;
    }

    const newCategory = mapDbToCategory(data);
    setCategories(prev => [...prev, newCategory]);
    setCategoryMap(prev => new Map(prev).set(newCategory.id, newCategory));
    return newCategory;
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    const { error } = await supabase
      .from('categories')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating category:', error);
      return false;
    }

    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
    setCategoryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates });
      }
      return newMap;
    });
    return true;
  };

  const deleteCategory = async (id: string) => {
    // First, update all transactions using this category to have null category
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ category_id: null })
      .eq('category_id', id);

    if (updateError) {
      console.error('Error updating transactions:', updateError);
      return false;
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      return false;
    }

    setCategories(prev => prev.filter(c => c.id !== id));
    setCategoryMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });

    // Update transactions in state that used this category
    const categoryName = categories.find(c => c.id === id)?.name;
    if (categoryName) {
      setTransactions(prev =>
        prev.map(t => (t.category === categoryName ? { ...t, category: null } : t))
      );
    }

    return true;
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (!selectedAccount) return null;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        account_id: selectedAccount.id,
        date: transaction.date,
        due_date: transaction.dueDate || null,
        description: transaction.description,
        category_id: getCategoryId(transaction.category),
        value: transaction.value,
        type: transaction.type,
        status: transaction.status,
        payment_method: transaction.paymentMethod || null,
        is_imported: transaction.isImported,
        is_reconciled: transaction.isReconciled,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding transaction:', error);
      return null;
    }

    const newTransaction: Transaction = {
      ...transaction,
      id: data.id,
      createdAt: data.created_at,
    };
    setTransactions(prev => [newTransaction, ...prev]);
    return newTransaction;
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const dbUpdates: any = {};
    
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate || null;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category_id = getCategoryId(updates.category);
    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod || null;
    if (updates.isImported !== undefined) dbUpdates.is_imported = updates.isImported;
    if (updates.isReconciled !== undefined) dbUpdates.is_reconciled = updates.isReconciled;

    const { error } = await supabase
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Error updating transaction:', error);
      return;
    }

    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transaction:', error);
      return;
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const importTransactions = async (newTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    if (!selectedAccount) return 0;

    const toInsert = newTransactions.map(t => ({
      account_id: selectedAccount.id,
      date: t.date,
      due_date: t.dueDate || null,
      description: t.description,
      category_id: getCategoryId(t.category),
      value: t.value,
      type: t.type,
      status: t.status,
      payment_method: t.paymentMethod || null,
      is_imported: t.isImported,
      is_reconciled: t.isReconciled,
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(toInsert)
      .select();

    if (error) {
      console.error('Error importing transactions:', error);
      return 0;
    }

    const imported = (data || []).map((row, index) => ({
      ...newTransactions[index],
      id: row.id,
      createdAt: row.created_at,
    }));
    setTransactions(prev => [...imported, ...prev]);
    return imported.length;
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
      currentBalance: initialBalance + allTimeIncome - allTimeExpense,
      toReceive,
      toPay,
      projectedBalance: initialBalance + allTimeIncome - allTimeExpense + toReceive - toPay,
      uncategorizedCount,
    };
  }, [transactions, uncategorizedCount, initialBalance]);

  return {
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
    refreshTransactions: fetchTransactions,
  };
}
