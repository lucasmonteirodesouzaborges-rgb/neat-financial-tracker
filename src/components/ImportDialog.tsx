import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { parseCSV, convertToTransactions } from '@/lib/csvParser';
import { parsePDF, convertPDFToTransactions } from '@/lib/pdfParser';
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
  const [isLoading, setIsLoading] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'pdf'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setIsLoading(true);

    try {
      if (file.name.endsWith('.csv')) {
        const content = await file.text();
        const parsed = parseCSV(content);
        if (parsed.length === 0) {
          setError('Não foi possível ler o arquivo. Verifique o formato.');
          return;
        }
        const transactions = convertToTransactions(parsed);
        setPreview(transactions);
      } else if (file.name.endsWith('.pdf')) {
        const parsed = await parsePDF(file);
        if (parsed.length === 0) {
          setError('Não foi possível extrair transações do PDF. Tente um formato CSV.');
          return;
        }
        const transactions = convertPDFToTransactions(parsed);
        setPreview(transactions);
      } else {
        setError('Formato não suportado. Use CSV ou PDF.');
      }
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Erro ao processar arquivo. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
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

  const acceptedFormats = importType === 'csv' ? '.csv' : '.pdf';

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
            Importe um arquivo CSV ou PDF com seus lançamentos. O sistema irá criar as transações automaticamente.
          </DialogDescription>
        </DialogHeader>

        {preview.length === 0 ? (
          <div className="space-y-4">
            <Tabs value={importType} onValueChange={(v) => setImportType(v as 'csv' | 'pdf')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </TabsTrigger>
                <TabsTrigger value="pdf" className="gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </TabsTrigger>
              </TabsList>
            </Tabs>

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
                accept={acceptedFormats}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              
              {isLoading ? (
                <div className="py-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arraste seu arquivo {importType.toUpperCase()} aqui ou
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Selecionar Arquivo
                  </Button>
                </>
              )}
              
              {error && (
                <div className="mt-4 flex items-center justify-center gap-2 text-expense text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <div className="mt-6 text-xs text-muted-foreground">
                {importType === 'csv' ? (
                  <>
                    <p className="font-medium mb-1">Formato CSV esperado:</p>
                    <code className="bg-muted px-2 py-1 rounded">
                      Data;Descrição;Valor
                    </code>
                  </>
                ) : (
                  <>
                    <p className="font-medium mb-1">PDFs suportados:</p>
                    <p>Extratos bancários em formato PDF (texto selecionável)</p>
                  </>
                )}
              </div>
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
            <div className="p-3 bg-warning-muted rounded-lg text-sm">
              <p className="font-medium text-warning">Atenção:</p>
              <p className="text-muted-foreground">
                Os lançamentos serão importados sem categoria. Você precisará categorizá-los manualmente.
              </p>
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
