import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional right-side slot — e.g. a "New" button. */
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
      </div>

      {action && (
        <div className="shrink-0">{action}</div>
      )}
    </div>
  );
}
