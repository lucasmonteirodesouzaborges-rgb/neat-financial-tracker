import { useState } from 'react';
import { Plus, Upload, Menu, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onNewTransaction: () => void;
  onImport: () => void;
  uncategorizedCount: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Lançamentos' },
  { id: 'analytics', label: 'Análise' },
];

export function Header({
  onNewTransaction,
  onImport,
  uncategorizedCount,
  activeTab,
  onTabChange,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg">FluxoCaixa</h1>
              <p className="text-xs text-muted-foreground">Gestão Financeira</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {tab.label}
                {tab.id === 'transactions' && uncategorizedCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-warning text-warning-foreground text-xs px-1.5"
                  >
                    {uncategorizedCount}
                  </Badge>
                )}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onImport}
              className="hidden sm:flex"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button size="sm" onClick={onNewTransaction}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
            
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-slide-up">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {tab.label}
                  {tab.id === 'transactions' && uncategorizedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-warning text-warning-foreground text-xs"
                    >
                      {uncategorizedCount}
                    </Badge>
                  )}
                </button>
              ))}
              <Button
                variant="outline"
                className="mt-2 justify-start"
                onClick={() => {
                  onImport();
                  setMobileMenuOpen(false);
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar Extrato
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
