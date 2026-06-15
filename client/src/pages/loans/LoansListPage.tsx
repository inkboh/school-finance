import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingDown,
  TrendingUp,
  Eye,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react'
import { loansApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import {
  PageHeader,
  DataTable,
  StatusBadge,
} from '../../components/shared'
import type { Column } from '../../components/shared'
import type { Loan, LoanStatus, LoanType } from '../../types'
import { useAuthStore } from '../../store/auth.store'

// ─── Status filter options ────────────────────────────────────────────────────

const LOAN_STATUSES: { value: LoanStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DEFAULTED', label: 'Defaulted' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
]

// ─── Mini summary card (simpler than SummaryCard — no icon required) ─────────

interface MiniCardProps {
  label: string
  value: string
  accent: string
  icon: React.ReactNode
}

function MiniCard({ label, value, accent, icon }: MiniCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${accent}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

interface TabProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sublabel: string
}

function Tab({ active, onClick, icon, label, sublabel }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
        active
          ? 'border-brand-200 text-brand-600'
          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
      <span
        className={[
          'hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:inline',
          active
            ? 'bg-brand-100 text-brand-700'
            : 'bg-slate-100 text-slate-500',
        ].join(' ')}
      >
        {sublabel}
      </span>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LoansListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isManager = user?.role === 'FINANCE_MANAGER' || user?.role === 'SUPER_ADMIN'

  const [activeTab, setActiveTab] = useState<LoanType>('BORROWED')
  const [statusFilter, setStatusFilter] = useState<LoanStatus | ''>('')

  // Fetch all loans (we filter client-side by type for tab switching)
  const { data: allLoansRes, isLoading } = useQuery({
    queryKey: ['loans', statusFilter],
    queryFn: () =>
      loansApi.list(statusFilter ? { status: statusFilter } : {}),
  })

  const allLoans: Loan[] =
    allLoansRes?.success ? (allLoansRes.data as Loan[]) : []

  const borrowed = allLoans.filter((l) => l.loanType === 'BORROWED')
  const lent = allLoans.filter((l) => l.loanType === 'LENT')
  const tableData = activeTab === 'BORROWED' ? borrowed : lent

  // ─── Summary figures ──────────────────────────────────────────────────────

  function sumField(loans: Loan[], field: 'principal' | 'outstanding') {
    return loans.reduce((acc, l) => {
      const val = field === 'outstanding' ? (l.outstanding ?? 0) : l.principal
      return acc + val
    }, 0)
  }

  const totalBorrowed = sumField(borrowed, 'principal')
  const outstandingBorrowed = sumField(borrowed, 'outstanding')
  const totalLent = sumField(lent, 'principal')
  const outstandingLent = sumField(lent, 'outstanding')

  // Use first loan's currency symbol/code for the summary display
  // In a multi-currency setup each card ideally shows the base currency —
  // but we show raw numbers here since the API does not aggregate to base for us.
  const symbol = allLoans[0]?.currency?.symbol ?? '$'
  const code = allLoans[0]?.currency?.code ?? ''

  const fmt = (n: number) => (code ? formatCurrency(n, symbol, code) : n.toLocaleString())

  // ─── Table columns ────────────────────────────────────────────────────────

  const columns: Column<Loan>[] = [
    {
      header: 'Loan #',
      accessor: 'loanNumber',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">{String(v)}</span>
      ),
    },
    {
      header: 'Party Name',
      accessor: 'partyName',
      render: (v) => (
        <span className="font-medium text-slate-800">{String(v)}</span>
      ),
    },
    {
      header: 'Purpose',
      accessor: 'purpose',
      render: (v) => (
        <span className="max-w-[160px] truncate text-slate-600">
          {v ? String(v) : <span className="text-slate-300">—</span>}
        </span>
      ),
    },
    {
      header: 'Principal',
      accessor: 'principal',
      render: (v, row) =>
        row.currency
          ? formatCurrency(Number(v), row.currency.symbol, row.currency.code)
          : Number(v).toLocaleString(),
    },
    {
      header: 'Currency',
      accessor: 'currency.code',
      render: (v) => (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
          {v ? String(v) : '—'}
        </span>
      ),
    },
    {
      header: 'Interest Rate',
      accessor: 'interestRate',
      render: (v) =>
        v != null ? (
          <span>{Number(v).toFixed(2)}%</span>
        ) : (
          <span className="text-xs text-slate-400">Interest-free</span>
        ),
    },
    {
      header: 'Loan Date',
      accessor: 'loanDate',
      render: (v) => formatDate(String(v)),
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      render: (v) =>
        v ? formatDate(String(v)) : <span className="text-slate-300">—</span>,
    },
    {
      header: 'Paid',
      accessor: 'totalPaid',
      render: (v, row) =>
        row.currency
          ? formatCurrency(Number(v ?? 0), row.currency.symbol, row.currency.code)
          : Number(v ?? 0).toLocaleString(),
    },
    {
      header: 'Outstanding',
      accessor: 'outstanding',
      render: (v, row) => {
        const amount = Number(v ?? 0)
        return (
          <span className={amount > 0 ? 'font-semibold text-red-600' : 'text-slate-600'}>
            {row.currency
              ? formatCurrency(amount, row.currency.symbol, row.currency.code)
              : amount.toLocaleString()}
          </span>
        )
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => <StatusBadge status={v as LoanStatus} />,
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (v) => (
        <button
          type="button"
          onClick={() => navigate(`/loans/${v}`)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors"
          aria-label="View loan"
        >
          <Eye size={13} />
          View
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Loans"
        subtitle="Track money borrowed and lent by the school."
        action={
          isManager ? (
            <button
              type="button"
              onClick={() => navigate('/loans/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <Plus size={16} />
              New Loan
            </button>
          ) : undefined
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniCard
          label="Total Borrowed"
          value={fmt(totalBorrowed)}
          accent="bg-red-500"
          icon={<TrendingDown size={18} />}
        />
        <MiniCard
          label="Outstanding Borrowed"
          value={fmt(outstandingBorrowed)}
          accent="bg-orange-500"
          icon={<ArrowDownCircle size={18} />}
        />
        <MiniCard
          label="Total Lent"
          value={fmt(totalLent)}
          accent="bg-emerald-500"
          icon={<TrendingUp size={18} />}
        />
        <MiniCard
          label="Outstanding Lent"
          value={fmt(outstandingLent)}
          accent="bg-teal-500"
          icon={<ArrowUpCircle size={18} />}
        />
      </div>

      {/* Tabs + filter */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Tab row */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4">
          <div className="flex">
            <Tab
              active={activeTab === 'BORROWED'}
              onClick={() => setActiveTab('BORROWED')}
              icon={<TrendingDown size={15} />}
              label="Money We Owe"
              sublabel={`${borrowed.length}`}
            />
            <Tab
              active={activeTab === 'LENT'}
              onClick={() => setActiveTab('LENT')}
              icon={<TrendingUp size={15} />}
              label="Money Owed to Us"
              sublabel={`${lent.length}`}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 py-2">
            <label htmlFor="status-filter" className="text-xs text-slate-500">
              Filter:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LoanStatus | '')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
            >
              {LOAN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="p-4">
          <DataTable
            columns={columns}
            data={tableData}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            emptyMessage={
              activeTab === 'BORROWED'
                ? 'No borrowed loans found.'
                : 'No lent loans found.'
            }
          />
        </div>
      </div>
    </div>
  )
}
