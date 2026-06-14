import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface Trend {
  /** Numeric change value; positive = up, negative = down */
  value: number;
  /** Human-readable label, e.g. "vs last month" */
  label: string;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Icon element, e.g. <DollarSign size={20} /> */
  icon: React.ReactNode;
  /**
   * A Tailwind background colour class applied to the icon wrapper,
   * e.g. "bg-indigo-500", "bg-emerald-500".
   */
  colorClass: string;
  trend?: Trend;
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  colorClass,
  trend,
}: SummaryCardProps) {
  const trendPositive = trend && trend.value >= 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Top row: text + icon */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 leading-tight">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>

        <div
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white',
            colorClass,
          ].join(' ')}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      {/* Trend row */}
      {trend && (
        <div className="flex items-center gap-1.5 text-xs">
          {trendPositive ? (
            <TrendingUp
              size={14}
              className="shrink-0 text-emerald-500"
              aria-hidden="true"
            />
          ) : (
            <TrendingDown
              size={14}
              className="shrink-0 text-red-500"
              aria-hidden="true"
            />
          )}
          <span
            className={[
              'font-semibold',
              trendPositive ? 'text-emerald-600' : 'text-red-600',
            ].join(' ')}
          >
            {trendPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-slate-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
