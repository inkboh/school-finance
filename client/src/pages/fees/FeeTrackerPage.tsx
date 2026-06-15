import React, { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Receipt,
  X,
} from 'lucide-react'
import { feesApi, settingsApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { PageHeader } from '../../components/shared'
import type { FeeTrackerRow, MonthPayment, FeeCategory, Currency } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCHOOL_YEARS = ['2025-2026', '2024-2025']

function monthLabel(monthStr: string): string {
  const [yearStr, monthNum] = monthStr.split('-')
  if (!yearStr || !monthNum) return monthStr
  const date = new Date(Number(yearStr), Number(monthNum) - 1, 1)
  return date.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
}

function fullMonthLabel(monthStr: string): string {
  const [yearStr, monthNum] = monthStr.split('-')
  if (!yearStr || !monthNum) return monthStr
  const date = new Date(Number(yearStr), Number(monthNum) - 1, 1)
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function schoolYearTerm(year: string): string {
  return year.replace('-', '/')
}

// ─── Payment Cell ─────────────────────────────────────────────────────────────

function PaymentCell({
  payment,
  canRecord,
  onRecord,
}: {
  payment: MonthPayment | undefined
  canRecord: boolean
  onRecord: () => void
}) {
  if (!payment || payment.status === 'NOT_ENROLLED') {
    return <td className="px-2 py-3 text-center"><span className="text-slate-200 text-sm select-none">—</span></td>
  }

  if (payment.status === 'UPCOMING') {
    return (
      <td className="px-2 py-3 text-center">
        <span className="text-[10px] text-slate-300 italic">Soon</span>
      </td>
    )
  }

  if (payment.status === 'PAID') {
    return (
      <td className="px-2 py-3 text-center">
        <div className="inline-flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={10} />
            ₵{payment.amount?.toLocaleString()}
          </span>
        </div>
      </td>
    )
  }

  if (payment.status === 'PENDING') {
    return (
      <td className="px-2 py-3 text-center">
        <div className="inline-flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
            <Clock size={10} />
            ₵{payment.amount?.toLocaleString()}
          </span>
          <span className="text-[9px] text-amber-500">Pending</span>
        </div>
      </td>
    )
  }

  // UNPAID
  return (
    <td className="px-2 py-3 text-center">
      <div className="inline-flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-200">
          <AlertCircle size={10} />
          Unpaid
        </span>
        {canRecord && (
          <button
            type="button"
            onClick={onRecord}
            className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 hover:underline"
          >
            + Record
          </button>
        )}
      </div>
    </td>
  )
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

interface RecordTarget {
  studentDbId: string
  studentName: string
  studentId: string
  month: string      // "YYYY-MM"
  year: string       // "YYYY-YYYY"
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

function RecordPaymentModal({
  target,
  categories,
  currencies,
  onClose,
  onSuccess,
}: {
  target: RecordTarget
  categories: FeeCategory[]
  currencies: Currency[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.name.toLowerCase().includes('tuition'))?.id ?? categories[0]?.id ?? ''
  )
  const [currencyId, setCurrencyId] = useState(
    currencies.find((c) => c.code === 'GHS')?.id ?? currencies[0]?.id ?? ''
  )
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: feesApi.create,
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['feeTracker'] })
        queryClient.invalidateQueries({ queryKey: ['fees'] })
        onSuccess()
        onClose()
      } else {
        setError(res.error ?? 'Failed to create receipt')
      }
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to create receipt')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    if (!categoryId) { setError('Select a category'); return }
    if (!currencyId) { setError('Select a currency'); return }

    // Payment date: 15th of the selected month at noon UTC
    const [yearStr, monthStr] = target.month.split('-')
    const paymentDate = `${yearStr ?? ''}-${monthStr ?? ''}-15T12:00:00.000Z`

    createMutation.mutate({
      studentName: target.studentName,
      studentRef: target.studentDbId,
      categoryId,
      amount: amt,
      currencyId,
      exchangeRate: 1,
      paymentDate,
      paymentMethod,
      termId: schoolYearTerm(target.year),
      notes: notes.trim() || undefined,
    } as Parameters<typeof feesApi.create>[0])
  }

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const ghsCurrency = currencies.find((c) => c.code === 'GHS')
  const selectedCurrency = currencies.find((c) => c.id === currencyId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 animate-scale-in">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {target.studentName} · {fullMonthLabel(target.month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div>
            <label className="label">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount ({selectedCurrency?.symbol ?? '₵'})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select
                value={currencyId}
                onChange={(e) => setCurrencyId(e.target.value)}
                className="input"
                required
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {ghsCurrency && currencyId !== ghsCurrency.id && (
            <p className="text-xs text-amber-600">
              Non-GHS payment: exchange rate will default to 1. Edit the receipt to adjust.
            </p>
          )}

          <div>
            <label className="label">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
              required
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. partial payment, late fee..."
              className="input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                <><Receipt size={14} /> Record Payment</>
              )}
            </button>
          </div>
        </form>

        <div className="border-t border-slate-100 bg-amber-50 rounded-b-2xl px-6 py-3">
          <p className="text-[11px] text-amber-700">
            Receipt will require approval from a Finance Manager or Principal before it counts as confirmed.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeeTrackerPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [selectedYear, setSelectedYear] = useState(SCHOOL_YEARS[0] ?? '2025-2026')
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canRecord = user?.role === 'CASHIER' || user?.role === 'FINANCE_MANAGER'

  const { data: trackerRes, isLoading, error } = useQuery({
    queryKey: ['feeTracker', selectedYear],
    queryFn: () => feesApi.tracker({ year: selectedYear }),
  })

  const { data: categoriesRes } = useQuery({
    queryKey: ['feeCategories'],
    queryFn: () => settingsApi.feeCategories({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const tracker = trackerRes?.success ? trackerRes.data : null
  const categories = categoriesRes?.success ? categoriesRes.data : []
  const currencies = currenciesRes?.success ? currenciesRes.data : []

  const handleRecord = useCallback(
    (row: FeeTrackerRow, month: string) => {
      setRecordTarget({
        studentDbId: row.studentDbId,
        studentName: `${row.firstName} ${row.lastName}`,
        studentId: row.studentId,
        month,
        year: selectedYear,
      })
    },
    [selectedYear]
  )

  const handleRecordSuccess = useCallback(() => {
    if (successTimeout.current) clearTimeout(successTimeout.current)
    setSuccessMsg('Receipt created — awaiting approval.')
    successTimeout.current = setTimeout(() => setSuccessMsg(null), 4000)
  }, [])

  const months = tracker?.months ?? []

  // Totals across all active students for this year
  const totalUnpaid = tracker
    ? months.reduce((sum, m) => sum + (tracker.summary[m]?.unpaid ?? 0), 0)
    : 0
  const totalCollected = tracker
    ? months.reduce((sum, m) => sum + (tracker.summary[m]?.totalCollected ?? 0), 0)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Payment Tracker"
        subtitle="Monthly breakdown of student fee payments"
        action={
          canRecord ? (
            <button
              type="button"
              onClick={() => navigate('/fees/new')}
              className="btn-primary"
            >
              <Plus size={16} />
              New Receipt
            </button>
          ) : undefined
        }
      />

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Year selector + summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">School Year</span>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {SCHOOL_YEARS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={[
                  'px-4 py-2 text-sm font-semibold transition-colors',
                  yr === selectedYear
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {tracker && (
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Collected</p>
              <p className="text-lg font-bold text-emerald-600">
                ₵{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Outstanding</p>
              <p className={['text-lg font-bold', totalUnpaid > 0 ? 'text-red-600' : 'text-slate-400'].join(' ')}>
                {totalUnpaid} {totalUnpaid === 1 ? 'student' : 'students'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={9} />Paid
          </span>
          Fee received & approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
            <Clock size={9} />₵—
          </span>
          Recorded, awaiting approval
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-200">
            <AlertCircle size={9} />Unpaid
          </span>
          No payment recorded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-300">—</span>
          Not enrolled / upcoming
        </span>
      </div>

      {/* Tracker table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Loading tracker…
          </div>
        ) : error || !tracker ? (
          <div className="flex items-center justify-center py-16 text-red-500 gap-2">
            <AlertCircle size={20} />
            Failed to load tracker data.
          </div>
        ) : tracker.rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            No students found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {/* Sticky student column */}
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 min-w-[200px] border-r border-slate-100">
                    Student
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 min-w-[80px]"
                    >
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {tracker.rows.map((row, rowIdx) => {
                  const isWithdrawn = row.studentStatus === 'WITHDRAWN'
                  return (
                    <tr
                      key={row.studentDbId}
                      className={[
                        'border-b border-slate-50 transition-colors hover:bg-slate-50/60',
                        rowIdx % 2 === 0 ? '' : 'bg-slate-50/30',
                        isWithdrawn ? 'opacity-50' : '',
                      ].join(' ')}
                    >
                      {/* Student name cell — sticky */}
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {row.firstName} {row.lastName}
                            </p>
                            <p className="text-[10px] text-slate-400">{row.studentId}</p>
                          </div>
                          {isWithdrawn && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                              Left
                            </span>
                          )}
                        </div>
                      </td>

                      {months.map((month) => (
                        <PaymentCell
                          key={month}
                          payment={row.payments[month]}
                          canRecord={canRecord && !isWithdrawn}
                          onRecord={() => handleRecord(row, month)}
                        />
                      ))}
                    </tr>
                  )
                })}
              </tbody>

              {/* Summary footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-slate-50 px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Total</span>
                  </td>
                  {months.map((month) => {
                    const s = tracker.summary[month]
                    if (!s) return <td key={month} />
                    return (
                      <td key={month} className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-emerald-700">
                            ₵{s.totalCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {s.unpaid > 0 && (
                            <span className="text-[10px] font-semibold text-red-500">
                              {s.unpaid} unpaid
                            </span>
                          )}
                          {s.pending > 0 && (
                            <span className="text-[10px] font-semibold text-amber-500">
                              {s.pending} pending
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Next steps callout for outstanding fees */}
      {tracker && totalUnpaid > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-orange-500" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {totalUnpaid} outstanding payment{totalUnpaid !== 1 ? 's' : ''} this year
              </p>
              <p className="mt-0.5 text-sm text-orange-700">
                Contact the parent or guardian for each unpaid month. Use the{' '}
                <strong className="font-semibold">+ Record</strong> button on any red cell to log a payment
                once received — it will be queued for approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment modal */}
      {recordTarget && categories.length > 0 && currencies.length > 0 && (
        <RecordPaymentModal
          target={recordTarget}
          categories={categories}
          currencies={currencies}
          onClose={() => setRecordTarget(null)}
          onSuccess={handleRecordSuccess}
        />
      )}
    </div>
  )
}
