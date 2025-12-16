import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'income' | 'expense' | 'warning';
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    income: 'bg-income-muted',
    expense: 'bg-expense-muted',
    warning: 'bg-warning-muted',
  };

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    income: 'bg-income/20 text-income',
    expense: 'bg-expense/20 text-expense',
    warning: 'bg-warning/20 text-warning',
  };

  const valueStyles = {
    default: 'text-foreground',
    income: 'text-income',
    expense: 'text-expense',
    warning: 'text-warning',
  };

  return (
    <div
      className={cn(
        'rounded-xl p-5 shadow-card transition-all duration-200 hover:shadow-card-hover animate-fade-in',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-bold tracking-tight', valueStyles[variant])}>
            {value}
          </p>
          {trend && (
            <p className="text-xs text-muted-foreground">
              <span className={trend.value >= 0 ? 'text-income' : 'text-expense'}>
                {trend.value >= 0 ? '+' : ''}
                {trend.value.toFixed(1)}%
              </span>{' '}
              {trend.label}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5', iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
