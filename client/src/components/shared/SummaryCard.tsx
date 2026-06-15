import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

interface Trend {
  value: number;
  label: string;
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  /** Tailwind gradient class e.g. "stat-card-income" or a full custom class */
  gradientClass?: string;
  /** Legacy: plain background color class. Takes precedence if gradientClass not set. */
  colorClass?: string;
  trend?: Trend;
}

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  gradientClass,
  colorClass,
  trend,
}: SummaryCardProps) {
  const trendPositive = trend && trend.value >= 0;
  const bg = gradientClass ?? (colorClass ? undefined : 'stat-card-income');

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card-md transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 group">
      {/* Gradient background */}
      <div className={['absolute inset-0', bg ?? colorClass].join(' ')} />

      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110" />
      <div className="absolute -bottom-8 -right-2 h-20 w-20 rounded-full bg-white/5" />

      {/* Content */}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {title}
            </p>
            <p className="mt-2 text-2xl font-bold text-white leading-none tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1.5 text-xs text-white/60 leading-snug">
                {subtitle}
              </p>
            )}
          </div>

          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm backdrop-blur-sm ring-1 ring-white/10"
            aria-hidden="true"
          >
            {icon}
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-1.5 text-xs border-t border-white/15 pt-3">
            {trendPositive ? (
              <TrendingUp size={13} className="shrink-0 text-white/80" />
            ) : (
              <TrendingDown size={13} className="shrink-0 text-white/80" />
            )}
            <span className="font-semibold text-white">
              {trendPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-white/60">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
