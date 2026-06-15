import React from 'react';

export type TxStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID';

export type LoanStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'PAID'
  | 'REJECTED'
  | 'DEFAULTED'
  | 'WRITTEN_OFF';

export type AppStatus = TxStatus | LoanStatus;

interface StatusConfig {
  dot: string;
  badge: string;
  label: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<AppStatus, StatusConfig> = {
  PENDING_APPROVAL: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200/80',
    label: 'Pending',
    pulse: true,
  },
  APPROVED: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
    label: 'Approved',
  },
  PAID: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
    label: 'Paid',
  },
  ACTIVE: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200/80',
    label: 'Active',
    pulse: true,
  },
  REJECTED: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-200/80',
    label: 'Rejected',
  },
  DEFAULTED: {
    dot: 'bg-red-600',
    badge: 'bg-red-50 text-red-800 ring-red-300/80',
    label: 'Defaulted',
  },
  WRITTEN_OFF: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200/80',
    label: 'Written Off',
  },
};

export function getStatusColor(status: AppStatus): StatusConfig {
  return STATUS_MAP[status] ?? {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200/80',
    label: status,
  };
}

interface StatusBadgeProps {
  status: AppStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = getStatusColor(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${config.badge}`}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {config.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.dot}`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </span>
  );
}
