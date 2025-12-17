# Resumo Completo - Sistema de Fluxo de Caixa

Este documento contém todas as informações necessárias para integrar o módulo de Fluxo de Caixa ao projeto Checklist.

---

## 📋 VISÃO GERAL

**Objetivo:** Sistema de gestão de fluxo de caixa para pequenas empresas, com foco em:
- Automação de controle financeiro
- Importação de extratos bancários (CSV e PDF)
- Categorização de transações
- Múltiplas contas/empresas isoladas
- Dashboard com métricas e gráficos
- Ferramenta de reconciliação bancária

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS (SUPABASE)

### Tabela: `accounts`
```sql
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);
```

### Tabela: `categories`
```sql
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' ou 'expense'
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories of own accounts" ON public.categories FOR SELECT 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can create categories in own accounts" ON public.categories FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can update categories in own accounts" ON public.categories FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can delete categories in own accounts" ON public.categories FOR DELETE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = categories.account_id AND accounts.user_id = auth.uid()));
```

### Tabela: `transactions`
```sql
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  category_id UUID,
  date DATE NOT NULL,
  due_date DATE,
  description TEXT NOT NULL,
  value NUMERIC NOT NULL,
  type TEXT NOT NULL, -- 'income' ou 'expense'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed' ou 'pending'
  payment_method TEXT, -- 'pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'boleto'
  is_imported BOOLEAN DEFAULT false,
  is_reconciled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions of own accounts" ON public.transactions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can create transactions in own accounts" ON public.transactions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can update transactions in own accounts" ON public.transactions FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can delete transactions in own accounts" ON public.transactions FOR DELETE 
  USING (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));
```

### Tabela: `profiles` (já existente no Checklist provavelmente)
```sql
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

---

## 📁 ESTRUTURA DE ARQUIVOS

### Arquivos Principais a Copiar:

```
src/
├── types/
│   └── finance.ts                 # Tipos TypeScript (Transaction, Category, etc.)
│
├── contexts/
│   └── AccountContext.tsx         # Contexto para gerenciar múltiplas contas
│
├── hooks/
│   ├── useAuth.ts                 # Hook de autenticação
│   └── useTransactions.ts         # Hook principal de transações e categorias
│
├── lib/
│   ├── csvParser.ts               # Parser de arquivos CSV
│   └── pdfParser.ts               # Parser de extratos PDF (Sicoob)
│
├── pages/
│   ├── Login.tsx                  # Página de login (somente login, sem signup)
│   └── Index.tsx                  # Página principal do dashboard
│
├── components/
│   ├── ProtectedRoute.tsx         # Componente de rota protegida
│   ├── Header.tsx                 # Cabeçalho com navegação
│   ├── AccountSelector.tsx        # Seletor/gerenciador de contas
│   ├── StatCard.tsx               # Card de estatísticas
│   ├── TransactionForm.tsx        # Formulário de novo lançamento
│   ├── EditTransactionForm.tsx    # Formulário de edição
│   ├── TransactionList.tsx        # Lista de transações com bulk actions
│   ├── ImportDialog.tsx           # Dialog de importação CSV/PDF
│   ├── Filters.tsx                # Filtros de transações
│   ├── CategoryManager.tsx        # Gerenciador de categorias
│   ├── Charts.tsx                 # Gráficos básicos
│   ├── AdvancedCharts.tsx         # Gráficos avançados
│   └── ReconciliationTool.tsx     # Ferramenta de reconciliação
```

---

## 🔧 DEPENDÊNCIAS NECESSÁRIAS

```json
{
  "pdfjs-dist": "^4.0.379",
  "recharts": "^2.15.4",
  "date-fns": "^3.6.0"
}
```

**Nota:** As outras dependências (shadcn/ui, supabase, react-router-dom, etc.) provavelmente já existem no projeto Checklist.

---

## 🎨 DESIGN SYSTEM (index.css)

Adicionar estas variáveis CSS ao seu `index.css`:

```css
/* Cores específicas do Fluxo de Caixa */
--income: 160 60% 45%;
--income-foreground: 0 0% 100%;
--income-muted: 160 50% 94%;

--expense: 10 78% 54%;
--expense-foreground: 0 0% 100%;
--expense-muted: 10 70% 95%;

--warning: 38 92% 50%;
--warning-foreground: 0 0% 100%;
--warning-muted: 38 90% 94%;

/* Chart colors */
--chart-1: 192 70% 35%;
--chart-2: 160 60% 45%;
--chart-3: 10 78% 54%;
--chart-4: 38 92% 50%;
--chart-5: 280 65% 60%;
```

Adicionar ao `tailwind.config.ts`:
```typescript
// Dentro de theme.extend.colors
income: {
  DEFAULT: 'hsl(var(--income))',
  foreground: 'hsl(var(--income-foreground))',
  muted: 'hsl(var(--income-muted))',
},
expense: {
  DEFAULT: 'hsl(var(--expense))',
  foreground: 'hsl(var(--expense-foreground))',
  muted: 'hsl(var(--expense-muted))',
},
warning: {
  DEFAULT: 'hsl(var(--warning))',
  foreground: 'hsl(var(--warning-foreground))',
  muted: 'hsl(var(--warning-muted))',
},
```

---

## 📝 TIPOS TYPESCRIPT (src/types/finance.ts)

```typescript
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'completed' | 'pending';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'boleto';

export interface Transaction {
  id: string;
  date: string;
  dueDate?: string;
  description: string;
  category: string | null;
  value: number;
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: PaymentMethod | null;
  isImported: boolean;
  isReconciled: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Vendas', type: 'income', color: '#10B981' },
  { id: '2', name: 'Serviços', type: 'income', color: '#06B6D4' },
  { id: '3', name: 'Investimentos', type: 'income', color: '#8B5CF6' },
  { id: '4', name: 'Outros (Entrada)', type: 'income', color: '#6366F1' },
  { id: '5', name: 'Fornecedores', type: 'expense', color: '#EF4444' },
  { id: '6', name: 'Salários', type: 'expense', color: '#F97316' },
  { id: '7', name: 'Aluguel', type: 'expense', color: '#EC4899' },
  { id: '8', name: 'Utilidades', type: 'expense', color: '#F59E0B' },
  { id: '9', name: 'Marketing', type: 'expense', color: '#84CC16' },
  { id: '10', name: 'Impostos', type: 'expense', color: '#14B8A6' },
  { id: '11', name: 'Outros (Saída)', type: 'expense', color: '#64748B' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];
```

---

## 🔐 AUTENTICAÇÃO

O sistema usa autenticação Supabase com **login apenas** (sem signup público). Usuários são criados manualmente pelo administrador.

### Hook useAuth (src/hooks/useAuth.ts)
- Gerencia estado de autenticação
- Funções: `signIn`, `signOut`
- Estados: `user`, `session`, `loading`, `isAuthenticated`

### ProtectedRoute (src/components/ProtectedRoute.tsx)
- Protege rotas que requerem autenticação
- Redireciona para `/login` se não autenticado

---

## 🏠 FUNCIONALIDADES PRINCIPAIS

### 1. Dashboard
- **Saldo Atual** (configurável com saldo inicial)
- **Entradas/Saídas** do período
- **A Receber/A Pagar** (pendentes)
- **Projeção** de saldo
- **Seletor de período**: Mês, Trimestre, Semestre, Ano, Personalizado, Todo período
- **Gráficos**: Saldo ao longo do tempo, Entradas x Saídas, Distribuição por categoria

### 2. Transações
- **CRUD completo** de transações
- **Filtros**: Período, Tipo, Status, Categoria, Sem categoria
- **Edição em massa**: Categorizar, Alterar status, Editar descrição, Excluir
- **Importação**: CSV e PDF (extratos Sicoob)
- **Status**: Recebido/Pago ou A Receber/A Pagar
- **Indicadores visuais**: Vencido, Importado, Sem categoria

### 3. Categorias
- Criar, editar, excluir categorias
- Categorias padrão criadas automaticamente
- Separadas por tipo (entrada/saída)
- Cores customizáveis

### 4. Contas (Multi-empresa)
- Múltiplas contas por usuário
- Cada conta tem: Nome, Banco, Empresa, Saldo inicial
- Dados completamente isolados entre contas

### 5. Reconciliação
- Comparar saldo do app com extrato bancário
- Detectar transações suspeitas (duplicatas, valores que correspondem à diferença)
- Inverter tipo de transação rapidamente
- Exportar para CSV

### 6. Importação de Extratos
- **CSV**: Formato Data;Descrição;Valor
- **PDF**: Extratos Sicoob com detecção automática de:
  - Tipo (C/D ou keywords)
  - Lançamentos futuros (seção "LANÇAMENTOS FUTUROS")
  - Formato de data DD/MM ou DD/MM/AA

---

## 🚀 PASSO A PASSO PARA INTEGRAÇÃO

### 1. Criar tabelas no Supabase
Execute as queries SQL das tabelas `accounts`, `categories` e `transactions` descritas acima.

### 2. Copiar arquivos
Copie os arquivos da estrutura listada, adaptando os imports se necessário.

### 3. Adicionar dependências
```bash
npm install pdfjs-dist recharts
```

### 4. Atualizar design system
Adicione as variáveis CSS e configurações do Tailwind.

### 5. Adicionar rotas no App.tsx
```tsx
import { AccountProvider } from '@/contexts/AccountContext';
import CashFlowIndex from './pages/cashflow/Index';
import CashFlowLogin from './pages/cashflow/Login';

// Dentro do Router, adicionar:
<AccountProvider>
  <Route path="/cashflow/login" element={<CashFlowLogin />} />
  <Route path="/cashflow" element={
    <ProtectedRoute>
      <CashFlowIndex />
    </ProtectedRoute>
  } />
</AccountProvider>
```

### 6. Adicionar navegação
Adicione um link no menu principal do Checklist para acessar `/cashflow`.

---

## 📊 CÁLCULOS FINANCEIROS

```
Saldo Atual = Saldo Inicial + Total Entradas (completed) - Total Saídas (completed)
A Receber = Soma de entradas com status 'pending'
A Pagar = Soma de saídas com status 'pending'
Projeção = Saldo Atual + A Receber - A Pagar
```

---

## 🎯 FUNCIONALIDADES-CHAVE IMPLEMENTADAS

1. ✅ Login sem signup (usuários criados manualmente)
2. ✅ Múltiplas contas/empresas isoladas
3. ✅ Saldo inicial configurável
4. ✅ Transações com status (Pago/A Pagar, Recebido/A Receber)
5. ✅ Datas de vencimento para pendentes
6. ✅ Indicador de vencido
7. ✅ Importação CSV e PDF
8. ✅ Detecção de lançamentos futuros em PDF
9. ✅ Edição em massa com confirmação
10. ✅ Inversão de tipo de transação
11. ✅ Filtros avançados
12. ✅ Dashboard com período selecionável
13. ✅ Gráficos (recharts)
14. ✅ Ferramenta de reconciliação
15. ✅ Exportar para CSV
16. ✅ Categorias personalizáveis
17. ✅ Responsivo mobile/desktop

---

## 💡 DICAS DE INTEGRAÇÃO

1. **Namespace**: Considere prefixar componentes/hooks com "CashFlow" para evitar conflitos (ex: `useCashFlowTransactions`)

2. **Contextos**: O `AccountProvider` deve envolver as rotas do cash flow, mas pode estar dentro de um provider mais externo se necessário

3. **Autenticação**: Se o Checklist já tem autenticação, você pode reutilizar o hook existente ao invés do `useAuth.ts`

4. **Tabelas**: Verifique se as tabelas `profiles` já existem e adapte conforme necessário

5. **Estilos**: As cores `income`, `expense`, `warning` são específicas do cash flow e devem ser adicionadas ao design system

---

## 📞 INSTRUÇÕES PARA O LOVABLE

Ao abrir o projeto Checklist no Lovable, você pode enviar esta mensagem:

```
Preciso adicionar um módulo de Fluxo de Caixa ao projeto. Aqui estão as especificações:

1. Criar 3 tabelas no Supabase: accounts, categories, transactions (com RLS)
2. Criar os seguintes arquivos:
   - src/types/finance.ts (tipos)
   - src/contexts/AccountContext.tsx (contexto de contas)
   - src/hooks/useTransactions.ts (hook de transações)
   - src/lib/csvParser.ts e pdfParser.ts (parsers)
   - Componentes: Header, TransactionList, TransactionForm, etc.
   - Página principal em /cashflow

Funcionalidades:
- Multi-conta por usuário
- Dashboard com métricas
- CRUD de transações com status (pendente/realizado)
- Importação de CSV/PDF
- Filtros e edição em massa
- Gráficos com recharts
- Ferramenta de reconciliação

Integrar com a autenticação existente.
```

---

*Documento gerado em: 17/12/2024*
