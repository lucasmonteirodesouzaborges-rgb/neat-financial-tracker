import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  bank_name: string;
  company_name: string;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account | null) => void;
  loading: boolean;
  refreshAccounts: () => Promise<void>;
  createAccount: (data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Account | null>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const SELECTED_ACCOUNT_KEY = 'cashflow_selected_account_id';

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccountState] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    if (!user) {
      setAccounts([]);
      setSelectedAccountState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching accounts:', error);
      setLoading(false);
      return;
    }

    setAccounts(data || []);

    // Restore selected account from localStorage
    const savedAccountId = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (savedAccountId && data) {
      const savedAccount = data.find(a => a.id === savedAccountId);
      if (savedAccount) {
        setSelectedAccountState(savedAccount);
      } else if (data.length > 0) {
        setSelectedAccountState(data[0]);
      }
    } else if (data && data.length > 0) {
      setSelectedAccountState(data[0]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
    } else {
      setAccounts([]);
      setSelectedAccountState(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const setSelectedAccount = (account: Account | null) => {
    setSelectedAccountState(account);
    if (account) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, account.id);
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  };

  const createAccount = async (data: Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;

    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert({
        ...data,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return null;
    }

    await fetchAccounts();
    return newAccount;
  };

  const updateAccount = async (id: string, data: Partial<Account>) => {
    const { error } = await supabase
      .from('accounts')
      .update(data)
      .eq('id', id);

    if (error) {
      console.error('Error updating account:', error);
      return false;
    }

    await fetchAccounts();
    return true;
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      return false;
    }

    if (selectedAccount?.id === id) {
      setSelectedAccount(accounts.find(a => a.id !== id) || null);
    }

    await fetchAccounts();
    return true;
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccount,
        setSelectedAccount,
        loading,
        refreshAccounts: fetchAccounts,
        createAccount,
        updateAccount,
        deleteAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
}
