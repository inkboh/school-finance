import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingDown } from 'lucide-react'
import { expensesApi } from '../../lib/api'
import { PageHeader } from '../../components/shared'
import type { ExpenseSummaryRow } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCHOOL_YEARS = ['2025-2026', '2024-2025']

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  if (!y || !mo) return m
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

function fmt(n: number): string {
  if (n === 0) return '—'
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function SummaryRow({ row, months }: { row: ExpenseSummaryRow; months: string[] }) {
  const isParent = row.level === 0

  return (
    <tr className={isParent ? 'bg-slate-50 border-t border-slate-200' : 'hover:bg-slate-50/50'}>
      <td
        className={[
          'sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 px-4 py-2.5 text-sm',
          isParent
            ? 'bg-slate-50 font-semibold text-slate-800'
            : 'bg-white pl-8 font-normal text-slate-600',
        ].join(' ')}
      >
        {row.name}
      </td>

      {months.map((m) => {
        const val = row.totals[m] ?? 0
        return (
          <td
            key={m}
            className={[
              'px-3 py-2.5 text-right text-sm tabular-nums',
              val > 0
                ? isParent
                  ? 'font-semibold text-slate-800'
                  : 'text-slate-700'
                : 'text-slate-300',
            ].join(' ')}
          >
            {fmt(val)}
          </td>
        )
      })}

      <td
        className={[
          'border-l border-slate-200 px-3 py-2.5 text-right text-sm tabular-nums',
          row.rowTotal > 0
            ? isParent
              ? 'font-bold text-slate-900'
              : 'font-medium text-slate-700'
            : 'text-slate-300',
        ].join(' ')}
      >
        {fmt(row.rowTotal)}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpenseSummaryPage() {
  const [year, setYear] = useState(SCHOOL_YEARS[0] ?? '2025-2026')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['expenses-summary', year],
    queryFn: () => expensesApi.monthlySummary({ year }),
  })

  const summary = data?.success ? data.data : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Summary"
        subtitle="Monthly cash-out by category"
        action={
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input py-2 text-sm"
          >
            {SCHOOL_YEARS.map((y) => (
              <option key={y} value={y}>
                {y.replace('-', '/')}
              </option>
            ))}
          </select>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Failed to load expense summary.
        </div>
      )}

      {summary && (
        <>
          {/* Grand total card */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Expenses</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                ₵{summary.grandTotal.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{year.replace('-', '/')} academic year</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Months with Activity</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {Object.values(summary.monthTotals).filter((v) => v > 0).length}
                <span className="ml-1 text-base font-normal text-slate-400">/ {summary.months.length}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">months recorded</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Avg Monthly Spend</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {(() => {
                  const active = Object.values(summary.monthTotals).filter((v) => v > 0)
                  if (active.length === 0) return '—'
                  const avg = active.reduce((a, b) => a + b, 0) / active.length
                  return `₵${avg.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                })()}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">across active months</p>
            </div>
          </div>

          {/* Matrix table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="sticky left-0 z-20 bg-slate-800 border-r border-slate-700 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      Category
                    </th>
                    {summary.months.map((m) => (
                      <th
                        key={m}
                        className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      >
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="border-l border-slate-700 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      Total
                    </th>
                  </tr>

                  {/* Header icon row */}
                  <tr className="bg-slate-700/50">
                    <td className="sticky left-0 z-20 bg-slate-700/50 border-r border-slate-600 px-4 py-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                        <TrendingDown size={11} />
                        Cash Out Per Month
                      </span>
                    </td>
                    {summary.months.map((m) => (
                      <td key={m} className="px-3 py-1.5 text-right text-[11px] font-medium text-slate-400">
                        {fmt(summary.monthTotals[m] ?? 0)}
                      </td>
                    ))}
                    <td className="border-l border-slate-600 px-3 py-1.5 text-right text-[11px] font-bold text-slate-300">
                      {fmt(summary.grandTotal)}
                    </td>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {summary.rows.map((row) => (
                    <SummaryRow key={row.id} row={row} months={summary.months} />
                  ))}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="sticky left-0 z-20 bg-slate-900 border-r border-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-wide whitespace-nowrap">
                      Total Cash Out
                    </td>
                    {summary.months.map((m) => {
                      const val = summary.monthTotals[m] ?? 0
                      return (
                        <td key={m} className={['px-3 py-3 text-right text-sm font-bold tabular-nums', val > 0 ? 'text-white' : 'text-slate-500'].join(' ')}>
                          {fmt(val)}
                        </td>
                      )
                    })}
                    <td className="border-l border-slate-700 px-3 py-3 text-right text-sm font-bold text-white tabular-nums">
                      {fmt(summary.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
