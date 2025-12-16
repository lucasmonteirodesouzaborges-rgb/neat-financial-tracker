import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarIcon, Filter, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { TransactionType, TransactionStatus, Category } from '@/types/finance';
import { cn } from '@/lib/utils';

export interface FilterState {
  startDate: Date | null;
  endDate: Date | null;
  type: TransactionType | 'all';
  status: TransactionStatus | 'all';
  category: string | 'all';
  onlyUncategorized: boolean;
}

interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: Category[];
  onManageCategories?: () => void;
}

const quickFilters = [
  { label: 'Hoje', getValue: () => ({ start: new Date(), end: new Date() }) },
  {
    label: 'Últimos 7 dias',
    getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }),
  },
  {
    label: 'Este mês',
    getValue: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
];

export function Filters({ filters, onFiltersChange, categories, onManageCategories }: FiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = [
    filters.startDate || filters.endDate,
    filters.type !== 'all',
    filters.status !== 'all',
    filters.category !== 'all',
    filters.onlyUncategorized,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      startDate: null,
      endDate: null,
      type: 'all',
      status: 'all',
      category: 'all',
      onlyUncategorized: false,
    });
  };

  return (
    <div className="space-y-2">
      {/* Main filters row - scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
        {/* Quick date filters - hidden on mobile */}
        <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
          {quickFilters.map((qf) => (
            <Button
              key={qf.label}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const { start, end } = qf.getValue();
                onFiltersChange({
                  ...filters,
                  startDate: start,
                  endDate: end,
                });
              }}
            >
              {qf.label}
            </Button>
          ))}
        </div>

        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm flex-shrink-0">
              <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              {filters.startDate && filters.endDate ? (
                <span className="whitespace-nowrap">
                  {format(filters.startDate, 'dd/MM')} - {format(filters.endDate, 'dd/MM')}
                </span>
              ) : (
                <span>Período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: filters.startDate || undefined,
                to: filters.endDate || undefined,
              }}
              onSelect={(range) => {
                onFiltersChange({
                  ...filters,
                  startDate: range?.from || null,
                  endDate: range?.to || null,
                });
              }}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>

        {/* Type filter */}
        <Select
          value={filters.type}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, type: value as TransactionType | 'all' })
          }
        >
          <SelectTrigger className="w-[90px] sm:w-32 h-8 text-xs sm:text-sm flex-shrink-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Entradas</SelectItem>
            <SelectItem value="expense">Saídas</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, status: value as TransactionStatus | 'all' })
          }
        >
          <SelectTrigger className="w-[100px] sm:w-36 h-8 text-xs sm:text-sm flex-shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Realizados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select
          value={filters.category}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, category: value })
          }
        >
          <SelectTrigger className="w-[110px] sm:w-40 h-8 text-xs sm:text-sm flex-shrink-0">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Uncategorized filter */}
        <Button
          variant={filters.onlyUncategorized ? 'default' : 'outline'}
          size="sm"
          onClick={() =>
            onFiltersChange({
              ...filters,
              onlyUncategorized: !filters.onlyUncategorized,
            })
          }
          className={cn(
            "h-8 text-xs sm:text-sm flex-shrink-0 whitespace-nowrap",
            filters.onlyUncategorized && 'bg-warning hover:bg-warning/90'
          )}
        >
          <span className="sm:hidden">Sem cat.</span>
          <span className="hidden sm:inline">Pendentes Cat.</span>
        </Button>

        {/* Manage Categories */}
        {onManageCategories && (
          <Button variant="outline" size="sm" onClick={onManageCategories} className="h-8 text-xs sm:text-sm flex-shrink-0">
            <Tag className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Categorias</span>
          </Button>
        )}

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs sm:text-sm flex-shrink-0">
            <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Limpar</span> ({activeFiltersCount})
          </Button>
        )}
      </div>
    </div>
  );
}
