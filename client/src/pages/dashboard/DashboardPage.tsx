import React, { useMemo } from 'react'
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
  Activity,
} from 'lucide-react'
import { format } from 'date-fns'

import { dashboardApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import SummaryCard from '../../components/shared/SummaryCard'
import DataTable, { type Column } from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import type { RecentActivity, TxStatus } from '../../types'

const CURRENCY_SYMBOL = '₵'
const CURRENCY_CODE = 'GHS'

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

const TYPE_CHIP: Record<RecentActivity['type'], { label: string; className: string }> = {
  receipt:      { label: 'Receipt',      className: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80' },
  expense:      { label: 'Expense',      className: 'bg-brand-100 text-brand-700 ring-1 ring-brand-200/80' },
  loanPayment:  { label: 'Loan Payment', className: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200/80' },
}

function TypeChip({ type }: { type: RecentActivity['type'] }) {
  const cfg = TYPE_CHIP[type]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function CardSkeleton() {
  return (
    <div className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 shadow-card-md" />
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white shadow-card border border-slate-100 p-6">
      <div className="mb-6 flex gap-3">
        <div className="h-5 w-32 rounded-full bg-slate-200" />
        <div className="ml-auto h-5 w-24 rounded-full bg-slate-100" />
      </div>
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="mt-0.5 text-red-500">⚠</span>
      {message}
    </div>
  )
}

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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card-md text-sm min-w-[160px]">
      <p className="mb-2.5 font-bold text-slate-800 border-b border-slate-100 pb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-slate-500">{entry.name}</span>
          </div>
          <span className="font-semibold text-slate-800">{fmtShort(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

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
      <span className="font-mono text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
        {String(val)}
      </span>
    ),
  },
  {
    header: 'Description',
    accessor: 'description',
    render: (val) => (
      <span className="max-w-xs truncate text-slate-700 text-sm">{String(val)}</span>
    ),
  },
  {
    header: 'Amount',
    accessor: 'amountBase',
    className: 'text-right',
    render: (val, row) => (
      <span className="font-bold text-slate-900">
        {formatCurrency(Number(val), CURRENCY_SYMBOL, row.currencyCode || CURRENCY_CODE)}
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
      <span className="text-slate-400 text-xs">{formatDate(String(val))}</span>
    ),
  },
]

function useGreeting() {
  const { user } = useAuthStore()
  return useMemo(() => {
    const hour = new Date().getHours()
    const firstName = user?.name?.split(' ')[0] ?? ''
    let salutation: string
    let emoji: string
    if (hour < 12)       { salutation = 'Good morning';   emoji = '☀️' }
    else if (hour < 17)  { salutation = 'Good afternoon'; emoji = '🌤️' }
    else if (hour < 21)  { salutation = 'Good evening';   emoji = '🌆' }
    else                 { salutation = 'Good night';      emoji = '🌙' }
    return { salutation, firstName, emoji }
  }, [user?.name])
}

export default function DashboardPage() {
  const today = format(new Date(), 'EEEE, d MMMM yyyy')
  const { salutation, firstName, emoji } = useGreeting()

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
    ? summary.pendingApprovals.receipts + summary.pendingApprovals.expenses + summary.pendingApprovals.loanPayments
    : 0

  const netIsPositive = (summary?.netBalance ?? 0) >= 0

  const chartData = cashFlow.map((point) => ({
    month: point.month,
    Income: point.income,
    Expenses: point.expenses,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Welcome banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 via-brand-800 to-brand-950 p-6 md:p-8 shadow-card-md">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">
              Riverdale Academy Finance
            </p>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {salutation}{firstName ? `, ${firstName}` : ''} {emoji}
            </h1>
            <p className="text-sm text-white/60 mt-1">{today}</p>
          </div>
          {pendingTotal > 0 && (
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-amber-500/20 border border-amber-400/30 px-4 py-3">
              <Clock size={18} className="text-amber-300 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">{pendingTotal} awaiting approval</p>
                <p className="text-xs text-white/60">Needs your attention</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Errors ── */}
      {summaryQuery.isError && (
        <ErrorBanner message={`Failed to load summary: ${(summaryQuery.error as Error).message}`} />
      )}
      {cashFlowQuery.isError && (
        <ErrorBanner message={`Failed to load cash flow: ${(cashFlowQuery.error as Error).message}`} />
      )}

      {/* ── Row 1: Financial summary ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Financial Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryQuery.isLoading ? (
            <>{Array.from({length:4}).map((_,i)=><CardSkeleton key={i}/>)}</>
          ) : summary ? (
            <>
              <SummaryCard
                title="Total Income"
                value={fmt(summary.totalIncome)}
                subtitle="All-time approved receipts"
                icon={<TrendingUp size={20} />}
                gradientClass="stat-card-income"
              />
              <SummaryCard
                title="Total Expenses"
                value={fmt(summary.totalExpenses)}
                subtitle="All-time approved expenses"
                icon={<TrendingDown size={20} />}
                gradientClass="stat-card-expense"
              />
              <SummaryCard
                title="Net Balance"
                value={fmt(summary.netBalance)}
                subtitle="Income minus expenses"
                icon={<Wallet size={20} />}
                gradientClass={netIsPositive ? 'stat-card-balance' : 'stat-card-expense'}
              />
              <SummaryCard
                title="Pending Approvals"
                value={pendingTotal}
                subtitle={`${summary.pendingApprovals.receipts} receipts · ${summary.pendingApprovals.expenses} expenses`}
                icon={<Clock size={20} />}
                gradientClass="stat-card-pending"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* ── Row 2: Loan cards ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Loan Portfolio</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryQuery.isLoading ? (
            <>{Array.from({length:4}).map((_,i)=><CardSkeleton key={i}/>)}</>
          ) : summary ? (
            <>
              <SummaryCard
                title="Total Borrowed"
                value={fmt(summary.loans.totalBorrowed)}
                subtitle="Principal of all borrowed loans"
                icon={<ArrowDownLeft size={20} />}
                gradientClass="stat-card-borrowed"
              />
              <SummaryCard
                title="Outstanding Borrowed"
                value={fmt(summary.loans.outstandingBorrowed)}
                subtitle="Remaining amount owed"
                icon={<ArrowDownLeft size={20} />}
                gradientClass="bg-gradient-to-br from-violet-400 to-purple-600"
              />
              <SummaryCard
                title="Total Lent"
                value={fmt(summary.loans.totalLent)}
                subtitle="Principal of all lent loans"
                icon={<ArrowUpRight size={20} />}
                gradientClass="stat-card-lent"
              />
              <SummaryCard
                title="Outstanding Lent"
                value={fmt(summary.loans.outstandingLent)}
                subtitle="Remaining amount to collect"
                icon={<ArrowUpRight size={20} />}
                gradientClass="bg-gradient-to-br from-sky-400 to-blue-600"
              />
            </>
          ) : null}
        </div>
      </div>

      {/* ── Cash Flow Chart ── */}
      {cashFlowQuery.isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">
                <Activity size={16} className="text-brand-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Cash Flow</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              Last 12 months
            </span>
          </div>
          <p className="mb-6 ml-10 text-xs text-slate-400">Monthly income vs. expenses (base currency)</p>

          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              No cash flow data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                barCategoryGap="32%"
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Poppins' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: '#cbd5e1', fontFamily: 'Poppins' }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip content={<CashFlowTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)', radius: 8 }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 20, fontFamily: 'Poppins' }}
                />
                <Bar dataKey="Income"   fill="#10b981" radius={[6, 6, 0, 0]} name="Income" />
                <Bar dataKey="Expenses" fill="#e11d48" radius={[6, 6, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── This Month ── */}
      {summary && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">This Month</h2>
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'MMMM yyyy')} at a glance</p>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Income</p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-600">
                {fmt(summary.currentMonth.income)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Fee receipts collected</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Expenses</p>
              <p className="mt-2 text-2xl font-extrabold text-brand-600">
                {fmt(summary.currentMonth.expenses)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Approved expenditures</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Net Position</p>
              <p className={`mt-2 text-2xl font-extrabold ${summary.currentMonth.net >= 0 ? 'text-blue-600' : 'text-brand-600'}`}>
                {fmt(summary.currentMonth.net)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Income minus expenses</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <Activity size={15} className="text-slate-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
            <p className="text-xs text-slate-400">Latest transactions across all modules</p>
          </div>
        </div>
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
  )
}
