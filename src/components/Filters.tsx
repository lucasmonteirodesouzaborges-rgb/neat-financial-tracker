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
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick date filters */}
      <div className="hidden sm:flex items-center gap-1">
        {quickFilters.map((qf) => (
          <Button
            key={qf.label}
            variant="outline"
            size="sm"
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
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {filters.startDate && filters.endDate ? (
              <span>
                {format(filters.startDate, 'dd/MM')} -{' '}
                {format(filters.endDate, 'dd/MM')}
              </span>
            ) : (
              <span className="hidden sm:inline">Período</span>
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
        <SelectTrigger className="w-32 h-9">
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
        <SelectTrigger className="w-36 h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
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
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas categorias</SelectItem>
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
        className={filters.onlyUncategorized ? 'bg-warning hover:bg-warning/90' : ''}
      >
        Pendentes Cat.
      </Button>

      {/* Manage Categories */}
      {onManageCategories && (
        <Button variant="outline" size="sm" onClick={onManageCategories}>
          <Tag className="h-4 w-4 mr-1" />
          Categorias
        </Button>
      )}

      {/* Clear filters */}
      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpar ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
}
