import React from 'react';

// Status types used across the app
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
}

const STATUS_MAP: Record<AppStatus, StatusConfig> = {
  PENDING_APPROVAL: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    label: 'Pending Approval',
  },
  APPROVED: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Approved',
  },
  PAID: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    label: 'Paid',
  },
  ACTIVE: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    label: 'Active',
  },
  REJECTED: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    label: 'Rejected',
  },
  DEFAULTED: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    label: 'Defaulted',
  },
  WRITTEN_OFF: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    label: 'Written Off',
  },
};

/** Returns Tailwind colour classes for a given status. Exported for reuse. */
export function getStatusColor(status: AppStatus): StatusConfig {
  return STATUS_MAP[status] ?? {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
