import { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Category, TransactionType } from '@/types/finance';
import { cn } from '@/lib/utils';

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onAddCategory: (category: Omit<Category, 'id'>) => Promise<Category | null>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
}

const COLORS = [
  '#10B981', '#06B6D4', '#8B5CF6', '#F97316', '#EC4899', 
  '#EF4444', '#F59E0B', '#84CC16', '#14B8A6', '#6366F1',
];

export function CategoryManager({
  open,
  onOpenChange,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newType, setNewType] = useState<TransactionType>('expense');
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
    setEditType(category.type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setIsLoading(true);
    await onUpdateCategory(editingId, {
      name: editName.trim(),
      color: editColor,
      type: editType,
    });
    setIsLoading(false);
    cancelEdit();
  };

  const handleAddNew = async () => {
    if (!newName.trim()) return;
    setIsLoading(true);
    await onAddCategory({
      name: newName.trim(),
      color: newColor,
      type: newType,
    });
    setIsLoading(false);
    setNewName('');
    setNewColor(COLORS[0]);
    setShowNewForm(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsLoading(true);
    await onDeleteCategory(deleteId);
    setIsLoading(false);
    setDeleteId(null);
  };

  const renderCategory = (category: Category) => {
    const isEditing = editingId === category.id;

    if (isEditing) {
      return (
        <div key={category.id} className="p-3 bg-muted rounded-lg space-y-3">
          <div className="flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome da categoria"
              className="flex-1"
              autoFocus
            />
            <Select value={editType} onValueChange={(v) => setEditType(v as TransactionType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Cor:</Label>
            <div className="flex gap-1 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    editColor === color && "ring-2 ring-offset-2 ring-primary"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditColor(color)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isLoading}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={isLoading || !editName.trim()}>
              <Check className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={category.id}
        className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => startEdit(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteId(category.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Categorias
            </DialogTitle>
            <DialogDescription>
              Crie, edite ou exclua categorias para organizar seus lançamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Add New Category */}
            {showNewForm ? (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <Label className="font-semibold">Nova Categoria</Label>
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome da categoria"
                    className="flex-1"
                    autoFocus
                  />
                  <Select value={newType} onValueChange={(v) => setNewType(v as TransactionType)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Cor:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "w-6 h-6 rounded-full transition-all",
                          newColor === color && "ring-2 ring-offset-2 ring-primary"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewColor(color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)} disabled={isLoading}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleAddNew} disabled={isLoading || !newName.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Criar Categoria
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            )}

            {/* Income Categories */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-income flex items-center gap-2">
                Entradas ({incomeCategories.length})
              </Label>
              <div className="space-y-2">
                {incomeCategories.length > 0 ? (
                  incomeCategories.map(renderCategory)
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma categoria de entrada
                  </p>
                )}
              </div>
            </div>

            {/* Expense Categories */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-expense flex items-center gap-2">
                Saídas ({expenseCategories.length})
              </Label>
              <div className="space-y-2">
                {expenseCategories.length > 0 ? (
                  expenseCategories.map(renderCategory)
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma categoria de saída
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os lançamentos que usam esta categoria ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
