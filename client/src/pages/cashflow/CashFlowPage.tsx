import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { cashflowApi } from '../../lib/api'
import { PageHeader } from '../../components/shared'
import type { CashFlowSimpleRow, CashFlowExpenseRow } from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_YEARS = ['2025-2026', '2024-2025']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  if (!y || !mo) return m
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-GB', {
    month: 'short',
    year: '2-digit',
  })
}

function fmt(n: number, opts?: { showZero?: boolean; sign?: boolean }): string {
  if (n === 0 && !opts?.showZero) return '—'
  const abs = `₵${Math.abs(n).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (opts?.sign) return n < 0 ? `(${abs})` : abs
  return abs
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  icon,
  months,
  colSpan,
}: {
  label: string
  icon: React.ReactNode
  months: string[]
  colSpan: number
}) {
  return (
    <tr className="bg-slate-700">
      <td
        colSpan={colSpan}
        className="sticky left-0 z-10 bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300"
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </td>
      {months.map((m) => (
        <td key={m} className="w-24" />
      ))}
      <td />
    </tr>
  )
}

function SimpleRow({
  row,
  months,
  indent = false,
}: {
  row: CashFlowSimpleRow
  months: string[]
  indent?: boolean
}) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td
        className={[
          'sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-white py-2.5 text-sm text-slate-700',
          indent ? 'pl-8 pr-4' : 'px-4 font-medium',
        ].join(' ')}
      >
        {row.name}
      </td>
      {months.map((m) => {
        const v = row.totals[m] ?? 0
        return (
          <td key={m} className={['px-3 py-2.5 text-right text-sm tabular-nums', v > 0 ? 'text-slate-800' : 'text-slate-300'].join(' ')}>
            {fmt(v)}
          </td>
        )
      })}
      <td className="border-l border-slate-100 px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-800">
        {fmt(row.rowTotal)}
      </td>
    </tr>
  )
}

function ExpenseRow({ row, months }: { row: CashFlowExpenseRow; months: string[] }) {
  const isParent = row.level === 0
  return (
    <tr className={isParent ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'}>
      <td
        className={[
          'sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 py-2.5 text-sm',
          isParent
            ? 'bg-slate-50 px-4 font-semibold text-slate-800'
            : 'bg-white pl-8 pr-4 text-slate-600',
        ].join(' ')}
      >
        {row.name}
      </td>
      {months.map((m) => {
        const v = row.totals[m] ?? 0
        return (
          <td key={m} className={['px-3 py-2.5 text-right text-sm tabular-nums', v > 0 ? (isParent ? 'font-semibold text-slate-800' : 'text-slate-700') : 'text-slate-300'].join(' ')}>
            {fmt(v)}
          </td>
        )
      })}
      <td className={['border-l border-slate-100 px-3 py-2.5 text-right text-sm tabular-nums', isParent ? 'font-bold text-slate-900' : 'font-medium text-slate-700'].join(' ')}>
        {fmt(row.rowTotal)}
      </td>
    </tr>
  )
}

function TotalRow({
  label,
  byMonth,
  months,
  total,
  variant,
}: {
  label: string
  byMonth: Record<string, number>
  months: string[]
  total: number
  variant: 'in' | 'out' | 'net' | 'balance'
}) {
  const styles = {
    in:      'bg-emerald-700 text-white',
    out:     'bg-red-800 text-white',
    net:     total >= 0 ? 'bg-emerald-900 text-white' : 'bg-red-900 text-white',
    balance: total >= 0 ? 'bg-brand-900 text-white' : 'bg-slate-900 text-white',
  }
  const cellStyle = styles[variant]

  return (
    <tr className={cellStyle}>
      <td className={`sticky left-0 z-10 ${cellStyle} border-r border-white/10 px-4 py-3 text-sm font-bold uppercase tracking-wide whitespace-nowrap`}>
        {label}
      </td>
      {months.map((m) => {
        const v = byMonth[m] ?? 0
        return (
          <td key={m} className={['px-3 py-3 text-right text-sm font-bold tabular-nums', v === 0 ? 'opacity-40' : ''].join(' ')}>
            {variant === 'net' || variant === 'balance' ? fmt(v, { showZero: true, sign: true }) : fmt(v, { showZero: true })}
          </td>
        )
      })}
      <td className="border-l border-white/10 px-3 py-3 text-right text-sm font-bold tabular-nums">
        {variant === 'net' || variant === 'balance' ? fmt(total, { showZero: true, sign: true }) : fmt(total, { showZero: true })}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const [year, setYear] = useState(SCHOOL_YEARS[0] ?? '2025-2026')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cashflow-summary', year],
    queryFn: () => cashflowApi.summary({ year }),
  })

  const cf = data?.success ? data.data : null
  const totalCols = cf ? cf.months.length + 2 : 2 // label + months + total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Flow Statement"
        subtitle="Monthly income and expenditure — all sources"
        action={
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="input py-2 text-sm"
          >
            {SCHOOL_YEARS.map((y) => (
              <option key={y} value={y}>{y.replace('-', '/')}</option>
            ))}
          </select>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading…
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Failed to load cash flow data.
        </div>
      )}

      {cf && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={15} className="text-emerald-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Cash In</p>
              </div>
              <p className="text-2xl font-bold text-emerald-900">
                ₵{cf.cashIn.total.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">fees + director contributions</p>
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={15} className="text-red-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Total Cash Out</p>
              </div>
              <p className="text-2xl font-bold text-red-900">
                ₵{cf.cashOut.total.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mt-0.5 text-xs text-red-600">all approved expenses</p>
            </div>

            <div className={[
              'rounded-xl border px-5 py-4 shadow-sm',
              cf.net.total >= 0
                ? 'border-brand-100 bg-brand-50'
                : 'border-amber-100 bg-amber-50',
            ].join(' ')}>
              <div className="flex items-center gap-2 mb-1">
                <ArrowRight size={15} className={cf.net.total >= 0 ? 'text-brand-600' : 'text-amber-600'} />
                <p className={['text-xs font-semibold uppercase tracking-wide', cf.net.total >= 0 ? 'text-brand-700' : 'text-amber-700'].join(' ')}>
                  Net {cf.net.total >= 0 ? 'Surplus' : 'Deficit'}
                </p>
              </div>
              <p className={['text-2xl font-bold', cf.net.total >= 0 ? 'text-brand-900' : 'text-amber-900'].join(' ')}>
                {cf.net.total < 0 ? '(' : ''}₵{Math.abs(cf.net.total).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{cf.net.total < 0 ? ')' : ''}
              </p>
              <p className={['mt-0.5 text-xs', cf.net.total >= 0 ? 'text-brand-600' : 'text-amber-600'].join(' ')}>
                year to date
              </p>
            </div>
          </div>

          {/* Cash Flow Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                {/* Column headers */}
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="sticky left-0 z-20 bg-slate-900 border-r border-slate-700 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                      Description
                    </th>
                    {cf.months.map((m) => (
                      <th key={m} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap w-24">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="border-l border-slate-700 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* ── CASH IN ── */}
                  <SectionHeader
                    label="Cash In"
                    icon={<TrendingUp size={12} />}
                    months={cf.months}
                    colSpan={1}
                  />

                  {/* Fee rows */}
                  {cf.cashIn.feeRows.length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          School Fees
                        </td>
                        {cf.months.map((m) => <td key={m} />)}
                        <td />
                      </tr>
                      {cf.cashIn.feeRows.map((row) => (
                        <SimpleRow key={row.name} row={row} months={cf.months} indent />
                      ))}
                    </>
                  )}

                  {/* Director contribution rows */}
                  {cf.cashIn.directorRows.length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Director Contributions
                        </td>
                        {cf.months.map((m) => <td key={m} />)}
                        <td />
                      </tr>
                      {cf.cashIn.directorRows.map((row) => (
                        <SimpleRow key={row.name} row={row} months={cf.months} indent />
                      ))}
                    </>
                  )}

                  {/* Total Cash In */}
                  <TotalRow
                    label="Total Cash In"
                    byMonth={cf.cashIn.byMonth}
                    months={cf.months}
                    total={cf.cashIn.total}
                    variant="in"
                  />

                  {/* ── CASH OUT ── */}
                  <SectionHeader
                    label="Cash Out"
                    icon={<TrendingDown size={12} />}
                    months={cf.months}
                    colSpan={1}
                  />

                  {cf.cashOut.rows.map((row) => (
                    <ExpenseRow key={row.id} row={row} months={cf.months} />
                  ))}

                  {/* Director loan repayments */}
                  {cf.cashOut.repaymentRows.length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Director Loan Repayments
                        </td>
                        {cf.months.map((m) => <td key={m} />)}
                        <td />
                      </tr>
                      {cf.cashOut.repaymentRows.map((row) => (
                        <SimpleRow key={row.name} row={row} months={cf.months} indent />
                      ))}
                    </>
                  )}

                  {/* Total Cash Out */}
                  <TotalRow
                    label="Total Cash Out"
                    byMonth={cf.cashOut.byMonth}
                    months={cf.months}
                    total={cf.cashOut.total}
                    variant="out"
                  />
                </tbody>

                {/* Net & Running Balance */}
                <tfoot>
                  <TotalRow
                    label="Net (Surplus / Deficit)"
                    byMonth={cf.net.byMonth}
                    months={cf.months}
                    total={cf.net.total}
                    variant="net"
                  />
                  <TotalRow
                    label="Running Balance"
                    byMonth={cf.runningBalance}
                    months={cf.months}
                    total={cf.runningBalance[cf.months[cf.months.length - 1]!] ?? 0}
                    variant="balance"
                  />
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Running balance starts from ₵0 at the beginning of the {year.replace('-', '/')} academic year. Only approved transactions are included.
          </p>
        </>
      )}
    </div>
  )
}
