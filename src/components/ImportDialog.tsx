import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { parseCSV, convertToTransactions } from '@/lib/csvParser';
import { Transaction } from '@/types/finance';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => number;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<Omit<Transaction, 'id' | 'createdAt'>[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    if (!file.name.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseCSV(content);
      if (parsed.length === 0) {
        setError('Não foi possível ler o arquivo. Verifique o formato.');
        return;
      }
      const transactions = convertToTransactions(parsed);
      setPreview(transactions);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = () => {
    const count = onImport(preview);
    setPreview([]);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        setPreview([]);
        setError('');
      }
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
          <DialogDescription>
            Importe um arquivo CSV com seus lançamentos. O sistema irá criar as transações automaticamente.
          </DialogDescription>
        </DialogHeader>

        {preview.length === 0 ? (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste seu arquivo CSV aqui ou
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar Arquivo
            </Button>
            {error && (
              <div className="mt-4 flex items-center justify-center gap-2 text-expense text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="mt-6 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Formato esperado:</p>
              <code className="bg-muted px-2 py-1 rounded">
                Data;Descrição;Valor
              </code>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {preview.length} lançamentos encontrados
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {preview.slice(0, 10).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span
                    className={`font-semibold ${
                      t.type === 'income' ? 'text-income' : 'text-expense'
                    }`}
                  >
                    {t.type === 'expense' ? '-' : '+'}
                    {formatCurrency(t.value)}
                  </span>
                </div>
              ))}
              {preview.length > 10 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  +{preview.length - 10} lançamentos...
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPreview([])}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleConfirmImport}>
                Importar {preview.length} Lançamentos
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
