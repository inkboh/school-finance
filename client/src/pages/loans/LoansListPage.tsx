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
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { loansApi, settingsApi } from '../../lib/api'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthStr(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  if (!y || !mo) return m
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

function fmtGHS(n: number): string {
  if (n === 0) return '—'
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtUSD(ghsAmount: number, usdRate: number): string {
  if (ghsAmount === 0 || usdRate <= 0) return ''
  const usd = ghsAmount / usdRate
  return `≈$${usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function DualAmount({ ghs, usdRate, bold }: { ghs: number; usdRate: number; bold?: boolean }) {
  if (ghs === 0) return <span className="text-slate-300">—</span>
  return (
    <span className="flex flex-col items-end">
      <span className={bold ? 'font-bold' : 'font-medium'}>{fmtGHS(ghs)}</span>
      {usdRate > 0 && (
        <span className="text-[10px] text-slate-400 leading-none">{fmtUSD(ghs, usdRate)}</span>
      )}
    </span>
  )
}

// ─── Director contribution matrix (BORROWED tab) ──────────────────────────────

function DirectorMatrix({
  loans,
  onView,
  usdRate,
}: {
  loans: Loan[]
  onView: (id: string) => void
  usdRate: number
}) {
  const [showRecords, setShowRecords] = useState(false)

  // All months with any contribution, sorted
  const allMonths = [...new Set(loans.map((l) => toMonthStr(l.loanDate as unknown as string)))].sort()

  // All directors, sorted
  const directors = [...new Set(loans.map((l) => l.partyName))].sort()

  // Build matrix + per-director aggregates
  const matrix: Record<string, Record<string, number>> = {}
  const totalByParty: Record<string, number> = {}
  const repaidByParty: Record<string, number> = {}
  const outstandingByParty: Record<string, number> = {}

  for (const loan of loans) {
    const p   = loan.partyName
    const m   = toMonthStr(loan.loanDate as unknown as string)
    if (!matrix[p]) matrix[p] = {}
    matrix[p][m]            = (matrix[p][m]            ?? 0) + Number(loan.principal)
    totalByParty[p]         = (totalByParty[p]         ?? 0) + Number(loan.principal)
    repaidByParty[p]        = (repaidByParty[p]        ?? 0) + Number(loan.totalPaid  ?? 0)
    outstandingByParty[p]   = (outstandingByParty[p]   ?? 0) + Number(loan.outstanding ?? 0)
  }

  const monthTotals: Record<string, number> = {}
  for (const m of allMonths) {
    monthTotals[m] = directors.reduce((s, p) => s + (matrix[p]?.[m] ?? 0), 0)
  }
  const grandTotal       = Object.values(totalByParty).reduce((a, b) => a + b, 0)
  const grandRepaid      = Object.values(repaidByParty).reduce((a, b) => a + b, 0)
  const grandOutstanding = Object.values(outstandingByParty).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4 p-4">
      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="sticky left-0 z-20 bg-slate-900 border-r border-slate-700 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                Director
              </th>
              {allMonths.map((m) => (
                <th key={m} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap w-24">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="border-l border-slate-700 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                Contributed
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-emerald-400">
                Repaid
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-amber-400">
                Outstanding
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {directors.map((director) => (
              <tr key={director} className="hover:bg-slate-50">
                <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">
                  {director}
                </td>
                {allMonths.map((m) => {
                  const v = matrix[director]?.[m] ?? 0
                  return (
                    <td key={m} className={['px-3 py-3 text-right text-sm tabular-nums', v > 0 ? 'text-slate-800' : 'text-slate-300'].join(' ')}>
                      {fmtGHS(v)}
                    </td>
                  )
                })}
                <td className="border-l border-slate-100 px-3 py-3 text-right tabular-nums text-slate-900">
                  <DualAmount ghs={totalByParty[director] ?? 0} usdRate={usdRate} bold />
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                  <DualAmount ghs={repaidByParty[director] ?? 0} usdRate={usdRate} />
                </td>
                <td className={['px-3 py-3 text-right tabular-nums', (outstandingByParty[director] ?? 0) > 0 ? 'text-amber-700' : 'text-slate-400'].join(' ')}>
                  <DualAmount ghs={outstandingByParty[director] ?? 0} usdRate={usdRate} bold />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white">
              <td className="sticky left-0 z-10 bg-slate-800 border-r border-slate-700 px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                Total
              </td>
              {allMonths.map((m) => (
                <td key={m} className={['px-3 py-3 text-right text-sm font-bold tabular-nums', (monthTotals[m] ?? 0) === 0 ? 'opacity-40' : ''].join(' ')}>
                  {fmtGHS(monthTotals[m] ?? 0)}
                </td>
              ))}
              <td className="border-l border-slate-700 px-3 py-3 text-right tabular-nums">
                <DualAmount ghs={grandTotal} usdRate={usdRate} bold />
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-emerald-400">
                <DualAmount ghs={grandRepaid} usdRate={usdRate} bold />
              </td>
              <td className={['px-3 py-3 text-right tabular-nums', grandOutstanding > 0 ? 'text-amber-400' : 'opacity-40'].join(' ')}>
                <DualAmount ghs={grandOutstanding} usdRate={usdRate} bold />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expandable individual records */}
      <div>
        <button
          type="button"
          onClick={() => setShowRecords((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
        >
          {showRecords ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {showRecords ? 'Hide' : 'Show'} individual loan records ({loans.length})
        </button>
        {showRecords && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {['Loan #', 'Director', 'Date', 'Principal', 'Repaid', 'Outstanding', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{loan.loanNumber}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{loan.partyName}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(loan.loanDate as unknown as string)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtGHS(Number(loan.principal))}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-700">{fmtGHS(Number(loan.totalPaid ?? 0))}</td>
                    <td className={['px-3 py-2 tabular-nums font-semibold', Number(loan.outstanding ?? 0) > 0 ? 'text-amber-700' : 'text-slate-400'].join(' ')}>
                      {fmtGHS(Number(loan.outstanding ?? 0))}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={loan.status as LoanStatus} /></td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onView(loan.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700"
                      >
                        <Eye size={11} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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

  const { data: ratesRes } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => settingsApi.exchangeRates(),
    staleTime: 5 * 60 * 1000,
  })

  // Find the most recent USD rate (rate = GHS per 1 USD)
  const usdRate: number = (() => {
    const rates = ratesRes?.success ? (ratesRes.data as Array<{ rate: number; currency: { code: string }; effectiveDate: string }>) : []
    const usdRates = rates.filter((r) => r.currency.code === 'USD').sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
    return usdRates[0] ? Number(usdRates[0].rate) : 0
  })()

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
      {usdRate > 0 && (
        <p className="text-xs text-slate-400">
          USD rate: 1 USD = ₵{usdRate.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GHS
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniCard
          label="Total Borrowed"
          value={`${fmt(totalBorrowed)}${usdRate > 0 ? `  /  ${fmtUSD(totalBorrowed, usdRate)}` : ''}`}
          accent="bg-red-500"
          icon={<TrendingDown size={18} />}
        />
        <MiniCard
          label="Outstanding Borrowed"
          value={`${fmt(outstandingBorrowed)}${usdRate > 0 ? `  /  ${fmtUSD(outstandingBorrowed, usdRate)}` : ''}`}
          accent="bg-orange-500"
          icon={<ArrowDownCircle size={18} />}
        />
        <MiniCard
          label="Total Lent"
          value={`${fmt(totalLent)}${usdRate > 0 ? `  /  ${fmtUSD(totalLent, usdRate)}` : ''}`}
          accent="bg-emerald-500"
          icon={<TrendingUp size={18} />}
        />
        <MiniCard
          label="Outstanding Lent"
          value={`${fmt(outstandingLent)}${usdRate > 0 ? `  /  ${fmtUSD(outstandingLent, usdRate)}` : ''}`}
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

        {/* Table / Matrix */}
        {activeTab === 'BORROWED' ? (
          isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
          ) : borrowed.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No borrowed loans found.</div>
          ) : (
            <DirectorMatrix loans={borrowed} onView={(id) => navigate(`/loans/${id}`)} usdRate={usdRate} />
          )
        ) : (
          <div className="p-4">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              rowKey={(row) => row.id}
              emptyMessage="No lent loans found."
            />
          </div>
        )}
      </div>
    </div>
  )
}
