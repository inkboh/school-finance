import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { format } from 'date-fns'

import { dashboardApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import SummaryCard from '../../components/shared/SummaryCard'
import DataTable, { type Column } from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import type { RecentActivity, TxStatus } from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL = '$'
const CURRENCY_CODE = 'USD'

function fmt(amount: number) {
  return formatCurrency(amount, CURRENCY_SYMBOL, CURRENCY_CODE)
}

function fmtShort(amount: number) {
  if (Math.abs(amount) >= 1_000_000)
    return `${CURRENCY_SYMBOL}${(amount / 1_000_000).toFixed(1)}M`
  if (Math.abs(amount) >= 1_000)
    return `${CURRENCY_SYMBOL}${(amount / 1_000).toFixed(1)}k`
  return `${CURRENCY_SYMBOL}${amount.toFixed(0)}`
}

// ─── Type chip ────────────────────────────────────────────────────────────────

const TYPE_CHIP: Record<
  RecentActivity['type'],
  { label: string; className: string }
> = {
  receipt: {
    label: 'Receipt',
    className:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  },
  expense: {
    label: 'Expense',
    className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  },
  loanPayment: {
    label: 'Loan Payment',
    className: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200',
  },
}

function TypeChip({ type }: { type: RecentActivity['type'] }) {
  const cfg = TYPE_CHIP[type]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Loading skeleton primitives ──────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-7 w-36 rounded bg-slate-200" />
          <div className="h-3 w-20 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 h-5 w-32 rounded bg-slate-200" />
      <div className="h-64 rounded bg-slate-100" />
    </div>
  )
}

function MiniStatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="h-6 w-32 rounded bg-slate-200" />
      </div>
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

// ─── Recent Activity columns ──────────────────────────────────────────────────

const ACTIVITY_COLUMNS: Column<RecentActivity>[] = [
  {
    header: 'Type',
    accessor: 'type',
    render: (_, row) => <TypeChip type={row.type} />,
  },
  {
    header: 'Reference',
    accessor: 'number',
    render: (val) => (
      <span className="font-mono text-xs text-slate-600">{String(val)}</span>
    ),
  },
  {
    header: 'Description',
    accessor: 'description',
    render: (val) => (
      <span className="max-w-xs truncate text-slate-700">{String(val)}</span>
    ),
  },
  {
    header: 'Amount',
    accessor: 'amountBase',
    className: 'text-right',
    render: (val, row) => (
      <span className="font-medium text-slate-900">
        {formatCurrency(
          Number(val),
          CURRENCY_SYMBOL,
          row.currencyCode || CURRENCY_CODE
        )}
      </span>
    ),
  },
  {
    header: 'Status',
    accessor: 'status',
    render: (val) => <StatusBadge status={val as TxStatus} />,
  },
  {
    header: 'Date',
    accessor: 'date',
    render: (val) => (
      <span className="text-slate-500">{formatDate(String(val))}</span>
    ),
  },
]

// ─── Custom tooltip for BarChart ──────────────────────────────────────────────

function CashFlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm">
      <p className="mb-2 font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="mb-0.5">
          {entry.name}:{' '}
          <span className="font-medium">{fmtShort(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await dashboardApi.summary()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const cashFlowQuery = useQuery({
    queryKey: ['dashboard', 'cashFlow'],
    queryFn: async () => {
      const res = await dashboardApi.cashFlow({ months: 12 })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const activityQuery = useQuery({
    queryKey: ['dashboard', 'recentActivity'],
    queryFn: async () => {
      const res = await dashboardApi.recentActivity({ limit: 10 })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const summary = summaryQuery.data
  const cashFlow = cashFlowQuery.data ?? []
  const activity = activityQuery.data ?? []

  const pendingTotal = summary
    ? summary.pendingApprovals.receipts +
      summary.pendingApprovals.expenses +
      summary.pendingApprovals.loanPayments
    : 0

  const netIsPositive = (summary?.netBalance ?? 0) >= 0

  // Format cash flow for recharts
  const chartData = cashFlow.map((point) => ({
    month: point.month, // e.g. "Jan", "Feb"
    Income: point.income,
    Expenses: point.expenses,
  }))

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">{today}</p>
        </div>
      </div>

      {/* ── Errors ── */}
      {summaryQuery.isError && (
        <ErrorBanner
          message={`Failed to load summary: ${(summaryQuery.error as Error).message}`}
        />
      )}
      {cashFlowQuery.isError && (
        <ErrorBanner
          message={`Failed to load cash flow: ${(cashFlowQuery.error as Error).message}`}
        />
      )}
      {activityQuery.isError && (
        <ErrorBanner
          message={`Failed to load recent activity: ${(activityQuery.error as Error).message}`}
        />
      )}

      {/* ── Row 1: Financial summary cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : summary ? (
          <>
            <SummaryCard
              title="Total Income"
              value={fmt(summary.totalIncome)}
              subtitle="All-time approved receipts"
              icon={<TrendingUp size={20} />}
              colorClass="bg-emerald-500"
            />
            <SummaryCard
              title="Total Expenses"
              value={fmt(summary.totalExpenses)}
              subtitle="All-time approved expenses"
              icon={<TrendingDown size={20} />}
              colorClass="bg-red-500"
            />
            <SummaryCard
              title="Net Balance"
              value={fmt(summary.netBalance)}
              subtitle="Income minus expenses"
              icon={<Wallet size={20} />}
              colorClass={netIsPositive ? 'bg-blue-500' : 'bg-red-500'}
            />
            <SummaryCard
              title="Pending Approvals"
              value={pendingTotal}
              subtitle={`${summary.pendingApprovals.receipts} receipts · ${summary.pendingApprovals.expenses} expenses · ${summary.pendingApprovals.loanPayments} loan payments`}
              icon={<Clock size={20} />}
              colorClass="bg-amber-500"
            />
          </>
        ) : null}
      </div>

      {/* ── Row 2: Loan cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : summary ? (
          <>
            <SummaryCard
              title="Total Borrowed"
              value={fmt(summary.loans.totalBorrowed)}
              subtitle="Principal of all borrowed loans"
              icon={<ArrowDownLeft size={20} />}
              colorClass="bg-violet-500"
            />
            <SummaryCard
              title="Outstanding Borrowed"
              value={fmt(summary.loans.outstandingBorrowed)}
              subtitle="Remaining amount owed"
              icon={<ArrowDownLeft size={20} />}
              colorClass="bg-violet-400"
            />
            <SummaryCard
              title="Total Lent"
              value={fmt(summary.loans.totalLent)}
              subtitle="Principal of all lent loans"
              icon={<ArrowUpRight size={20} />}
              colorClass="bg-sky-500"
            />
            <SummaryCard
              title="Outstanding Lent"
              value={fmt(summary.loans.outstandingLent)}
              subtitle="Remaining amount to collect"
              icon={<ArrowUpRight size={20} />}
              colorClass="bg-sky-400"
            />
          </>
        ) : null}
      </div>

      {/* ── Cash Flow Chart ── */}
      {cashFlowQuery.isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Cash Flow
            </h2>
            <span className="text-xs text-slate-400">Last 12 months</span>
          </div>
          <p className="mb-5 text-xs text-slate-500">
            Monthly income vs. expenses (base currency)
          </p>

          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              No cash flow data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                barCategoryGap="30%"
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip content={<CashFlowTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                />
                <Bar
                  dataKey="Income"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Income"
                />
                <Bar
                  dataKey="Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  name="Expenses"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Current Month Mini-Summary ── */}
      {summaryQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStatSkeleton />
          <MiniStatSkeleton />
          <MiniStatSkeleton />
        </div>
      ) : summary ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              This Month
            </h2>
            <p className="text-xs text-slate-500">
              {format(new Date(), 'MMMM yyyy')} at a glance
            </p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {/* Income */}
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Income
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-600">
                {fmt(summary.currentMonth.income)}
              </p>
            </div>
            {/* Expenses */}
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Expenses
              </p>
              <p className="mt-1 text-xl font-bold text-red-600">
                {fmt(summary.currentMonth.expenses)}
              </p>
            </div>
            {/* Net */}
            <div className="px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Net
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  summary.currentMonth.net >= 0
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              >
                {fmt(summary.currentMonth.net)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Recent Activity ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Activity
          </h2>
          <p className="text-xs text-slate-500">
            Latest transactions across all modules
          </p>
        </div>
        <div className="overflow-x-auto">
          <DataTable
            columns={ACTIVITY_COLUMNS}
            data={activity}
            isLoading={activityQuery.isLoading}
            skeletonRows={6}
            emptyMessage="No recent activity found."
            rowKey={(row, i) => `${row.type}-${row.number}-${i}`}
          />
        </div>
      </div>
    </div>
  )
}
