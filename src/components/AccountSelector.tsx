import { useState } from 'react';
import { useAccounts, Account } from '@/contexts/AccountContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function AccountSelector() {
  const { accounts, selectedAccount, setSelectedAccount, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    company_name: '',
    initial_balance: 0,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      bank_name: '',
      company_name: '',
      initial_balance: 0,
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.bank_name.trim() || !formData.company_name.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    const account = await createAccount(formData);
    if (account) {
      toast({
        title: 'Conta criada',
        description: `A conta "${account.name}" foi criada com sucesso.`,
      });
      setSelectedAccount(account);
      setIsCreateOpen(false);
      resetForm();
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a conta.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async () => {
    if (!editingAccount) return;

    const success = await updateAccount(editingAccount.id, formData);
    if (success) {
      toast({
        title: 'Conta atualizada',
        description: 'As alterações foram salvas.',
      });
      setIsEditOpen(false);
      setEditingAccount(null);
      resetForm();
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a conta.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Tem certeza que deseja excluir a conta "${account.name}"? Todos os dados dessa conta serão perdidos.`)) {
      return;
    }

    const success = await deleteAccount(account.id);
    if (success) {
      toast({
        title: 'Conta excluída',
        description: `A conta "${account.name}" foi excluída.`,
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a conta.',
        variant: 'destructive',
      });
    }
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank_name: account.bank_name,
      company_name: account.company_name,
      initial_balance: account.initial_balance,
    });
    setIsEditOpen(true);
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Select
        value={selectedAccount?.id || ''}
        onValueChange={(value) => {
          const account = accounts.find(a => a.id === value);
          if (account) setSelectedAccount(account);
        }}
      >
        <SelectTrigger className="w-full sm:w-[280px] min-w-0">
          <SelectValue placeholder="Selecione uma conta">
            {selectedAccount && (
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">
                  {selectedAccount.company_name} - {selectedAccount.bank_name}
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between pr-2">
              <SelectItem value={account.id} className="flex-1">
                <div className="flex flex-col">
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {account.company_name} • {account.bank_name}
                  </span>
                </div>
              </SelectItem>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(account);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(account);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" onClick={() => resetForm()}>
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta</DialogTitle>
            <DialogDescription>
              Crie uma nova conta para gerenciar o fluxo de caixa de uma empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Conta</Label>
              <Input
                id="name"
                placeholder="Ex: Conta Principal"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Nome da Empresa</Label>
              <Input
                id="company_name"
                placeholder="Ex: Empresa ABC Ltda"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_name">Banco</Label>
              <Input
                id="bank_name"
                placeholder="Ex: Sicoob, Inter, Bradesco"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initial_balance">Saldo Inicial (R$)</Label>
              <Input
                id="initial_balance"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar Conta</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
            <DialogDescription>
              Altere os dados da conta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome da Conta</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company_name">Nome da Empresa</Label>
              <Input
                id="edit-company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank_name">Banco</Label>
              <Input
                id="edit-bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-initial_balance">Saldo Inicial (R$)</Label>
              <Input
                id="edit-initial_balance"
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
