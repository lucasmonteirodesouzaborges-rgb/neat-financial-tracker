-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de contas bancárias (cada conta = uma empresa isolada)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Nome da conta (ex: "Conta Principal Sicoob")
  bank_name TEXT NOT NULL, -- Nome do banco (ex: "Sicoob", "Inter")
  company_name TEXT NOT NULL, -- Nome da empresa (ex: "Empresa ABC Ltda")
  initial_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de categorias por conta
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações vinculadas a contas
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
  date DATE NOT NULL,
  due_date DATE,
  payment_method TEXT,
  is_reconciled BOOLEAN DEFAULT false,
  is_imported BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas RLS para accounts
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para categories (baseado na conta)
CREATE POLICY "Users can view categories of own accounts" ON public.categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can create categories in own accounts" ON public.categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can update categories in own accounts" ON public.categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete categories in own accounts" ON public.categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid())
  );

-- Políticas RLS para transactions (baseado na conta)
CREATE POLICY "Users can view transactions of own accounts" ON public.transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can create transactions in own accounts" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can update transactions in own accounts" ON public.transactions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete transactions in own accounts" ON public.transactions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid())
  );

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();