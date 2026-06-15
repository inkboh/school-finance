import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronLeft,
  CheckCircle,
  X,
  CreditCard,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { loansApi, settingsApi } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'
import {
  PageHeader,
  StatusBadge,
  DataTable,
  FormField,
  ConfirmModal,
} from '../../components/shared'
import type { Column } from '../../components/shared'
import type { Loan, LoanPayment, LoanStatus, PaymentMethod, Currency } from '../../types'
import { useAuthStore } from '../../store/auth.store'

// ─── Payment form schema ──────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required.')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: 'Must be a positive number.',
    }),
  currencyId: z.string().min(1, 'Currency is required.'),
  exchangeRate: z.string().optional(),
  paymentDate: z.string().min(1, 'Payment date is required.'),
  paymentMethod: z.enum([
    'CASH',
    'BANK_TRANSFER',
    'CHEQUE',
    'MOBILE_MONEY',
    'CARD',
    'OTHER',
  ]),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
})

type PaymentFormValues = z.infer<typeof paymentSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOAN_STATUSES: { value: LoanStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DEFAULTED', label: 'Defaulted' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 disabled:bg-slate-50'

const errorInputClass =
  'w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300'

function inputCls(hasError: boolean) {
  return hasError ? errorInputClass : inputClass
}

// ─── Info grid row ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value ?? '—'}</dd>
    </div>
  )
}

// ─── Slide-in payment panel ────────────────────────────────────────────────

interface PaymentPanelProps {
  isOpen: boolean
  onClose: () => void
  loanId: string
  loanCurrencyId: string
  currencies: Currency[]
  onSuccess: () => void
}

function PaymentPanel({
  isOpen,
  onClose,
  loanId,
  loanCurrencyId,
  currencies,
  onSuccess,
}: PaymentPanelProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      currencyId: loanCurrencyId,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
    },
  })

  const selectedCurrencyId = watch('currencyId')
  const isNonBase = selectedCurrencyId && selectedCurrencyId !== loanCurrencyId

  const mutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      loansApi.createPayment(loanId, {
        amount: Number(values.amount),
        currencyId: values.currencyId,
        exchangeRate: values.exchangeRate ? Number(values.exchangeRate) : undefined,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod as PaymentMethod,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        reset()
        onSuccess()
        onClose()
      }
    },
  })

  const onSubmit = (values: PaymentFormValues) => mutation.mutate(values)

  const serverError =
    mutation.isError
      ? 'An unexpected error occurred.'
      : !mutation.data?.success && mutation.data?.error
        ? mutation.data.error
        : null

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <aside
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-label="Record payment panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-brand-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Record Payment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Amount */}
          <FormField
            label="Amount"
            required
            htmlFor="pay-amount"
            error={errors.amount?.message}
          >
            <input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              {...register('amount')}
              className={inputCls(!!errors.amount)}
            />
          </FormField>

          {/* Currency */}
          <FormField
            label="Currency"
            required
            htmlFor="pay-currency"
            error={errors.currencyId?.message}
          >
            <select
              id="pay-currency"
              {...register('currencyId')}
              className={inputCls(!!errors.currencyId)}
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </FormField>

          {/* Exchange Rate — only shown for non-base currencies */}
          {isNonBase && (
            <FormField
              label="Exchange Rate"
              htmlFor="pay-exchange-rate"
              error={errors.exchangeRate?.message}
              hint="Rate to convert this payment into the loan's currency."
            >
              <input
                id="pay-exchange-rate"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 1.2500"
                {...register('exchangeRate')}
                className={inputCls(!!errors.exchangeRate)}
              />
            </FormField>
          )}

          {/* Payment Date */}
          <FormField
            label="Payment Date"
            required
            htmlFor="pay-date"
            error={errors.paymentDate?.message}
          >
            <input
              id="pay-date"
              type="date"
              {...register('paymentDate')}
              className={inputCls(!!errors.paymentDate)}
            />
          </FormField>

          {/* Payment Method */}
          <FormField
            label="Payment Method"
            required
            htmlFor="pay-method"
            error={errors.paymentMethod?.message}
          >
            <select
              id="pay-method"
              {...register('paymentMethod')}
              className={inputCls(!!errors.paymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Reference */}
          <FormField
            label="Reference"
            htmlFor="pay-reference"
            error={errors.reference?.message}
            hint="Cheque number, transfer ID, receipt number, etc."
          >
            <input
              id="pay-reference"
              type="text"
              placeholder="Optional reference"
              {...register('reference')}
              className={inputCls(!!errors.reference)}
            />
          </FormField>

          {/* Notes */}
          <FormField
            label="Notes"
            htmlFor="pay-notes"
            error={errors.notes?.message}
          >
            <textarea
              id="pay-notes"
              rows={3}
              placeholder="Additional notes…"
              {...register('notes')}
              className={inputCls(!!errors.notes)}
            />
          </FormField>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Submit */}
          <div className="sticky bottom-0 border-t border-slate-100 bg-white pt-4">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {mutation.isPending ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const isManager =
    user?.role === 'FINANCE_MANAGER' || user?.role === 'SUPER_ADMIN'
  const canChangeStatus = isManager || user?.role === 'PRINCIPAL'

  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<LoanStatus | ''>('')
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null)

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: loanRes, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: () => loansApi.get(id!),
    enabled: !!id,
  })

  const { data: currenciesRes } = useQuery({
    queryKey: ['settings', 'currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
  })

  const loan: Loan | null =
    loanRes?.success ? (loanRes.data as Loan) : null

  const currencies: Currency[] =
    currenciesRes?.success ? (currenciesRes.data as Currency[]) : []

  // ─── Mutations ────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: (status: LoanStatus) => loansApi.updateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
      setNewStatus('')
    },
  })

  const approvePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => loansApi.approvePayment(id!, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] })
      setApprovingPaymentId(null)
    },
  })

  // ─── Derived values ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-32 rounded-xl bg-slate-200" />
        <div className="h-48 rounded-xl bg-slate-200" />
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
        <AlertTriangle size={40} strokeWidth={1.5} />
        <p>Loan not found.</p>
        <button
          type="button"
          onClick={() => navigate('/loans')}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Back to Loans
        </button>
      </div>
    )
  }

  const symbol = loan.currency?.symbol ?? '$'
  const code = loan.currency?.code ?? ''
  const fmt = (n: number) => formatCurrency(n, symbol, code)

  const totalPaid = loan.totalPaid ?? 0
  const outstanding = loan.outstanding ?? loan.principal - totalPaid
  const pctRepaid =
    loan.principal > 0
      ? Math.min(100, (totalPaid / loan.principal) * 100)
      : 0

  const payments: LoanPayment[] = loan.payments ?? []
  const approvedPayments = payments.filter((p) => p.status === 'APPROVED')

  // ─── Payment table columns ────────────────────────────────────────────────

  const paymentColumns: Column<LoanPayment>[] = [
    {
      header: 'Payment #',
      accessor: 'paymentNumber',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">{String(v)}</span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
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
      header: 'Date',
      accessor: 'paymentDate',
      render: (v) => formatDate(String(v)),
    },
    {
      header: 'Method',
      accessor: 'paymentMethod',
      render: (v) => {
        const labels: Record<string, string> = {
          CASH: 'Cash',
          BANK_TRANSFER: 'Bank Transfer',
          CHEQUE: 'Cheque',
          MOBILE_MONEY: 'Mobile Money',
          CARD: 'Card',
          OTHER: 'Other',
        }
        return labels[String(v)] ?? String(v)
      },
    },
    {
      header: 'Reference',
      accessor: 'reference',
      render: (v) =>
        v ? (
          <span className="font-mono text-xs">{String(v)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => <StatusBadge status={v as LoanPayment['status']} />,
    },
    {
      header: 'Action',
      accessor: 'id',
      render: (v, row) => {
        const isPending = row.status === 'PENDING_APPROVAL'
        const isCreator = row.createdById === user?.id
        const canApprove = canChangeStatus && !isCreator && isPending

        if (!canApprove) return <span className="text-xs text-slate-300">—</span>

        return (
          <button
            type="button"
            onClick={() => setApprovingPaymentId(String(v))}
            disabled={approvePaymentMutation.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={12} />
            Approve
          </button>
        )
      },
    },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <PageHeader
          title={`Loan ${loan.loanNumber}`}
          action={
            <button
              type="button"
              onClick={() => navigate('/loans')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
              Back to Loans
            </button>
          }
        />

        {/* Loan header card */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <span className="font-mono text-lg font-bold text-slate-900">
            {loan.loanNumber}
          </span>

          {/* Type badge */}
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
              loan.loanType === 'BORROWED'
                ? 'bg-red-50 text-red-700 ring-red-200'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            ].join(' ')}
          >
            {loan.loanType === 'BORROWED' ? (
              <TrendingDown size={12} />
            ) : (
              <TrendingUp size={12} />
            )}
            {loan.loanType === 'BORROWED' ? 'Borrowed' : 'Lent'}
          </span>

          <span className="text-sm font-semibold text-slate-700">
            {loan.partyName}
          </span>

          <div className="ml-auto">
            <StatusBadge status={loan.status} />
          </div>
        </div>

        {/* Two-column layout: info grid + summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Info grid — 2/3 width */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Loan Details
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-3">
              <InfoRow label="Principal" value={fmt(loan.principal)} />
              <InfoRow
                label="Currency"
                value={
                  loan.currency ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                      {loan.currency.code}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <InfoRow
                label="Interest Rate"
                value={
                  loan.interestRate != null
                    ? `${Number(loan.interestRate).toFixed(2)}%`
                    : 'Interest-free'
                }
              />
              <InfoRow
                label="Loan Date"
                value={formatDate(loan.loanDate)}
              />
              <InfoRow
                label="Due Date"
                value={loan.dueDate ? formatDate(loan.dueDate) : 'Open-ended'}
              />
              <InfoRow
                label="Party Contact"
                value={loan.partyContact || '—'}
              />
              <InfoRow
                label="Purpose"
                value={loan.purpose || '—'}
              />
              <InfoRow
                label="Created By"
                value={loan.createdBy?.name ?? '—'}
              />
              <InfoRow
                label="Created At"
                value={formatDate(loan.createdAt)}
              />
              {loan.notes && (
                <div className="col-span-full flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-slate-500">Notes</dt>
                  <dd className="whitespace-pre-wrap text-sm text-slate-700">
                    {loan.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Summary card — 1/3 width */}
          <div className="space-y-4">
            {/* Repayment summary */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-700">
                  Repayment Summary
                </h2>
              </div>
              <div className="space-y-3 px-6 py-5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Principal</span>
                  <span className="font-medium text-slate-800">
                    {fmt(loan.principal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Paid</span>
                  <span className="font-medium text-emerald-600">
                    {fmt(totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Outstanding</span>
                  <span
                    className={
                      outstanding > 0
                        ? 'font-semibold text-red-600'
                        : 'font-semibold text-emerald-600'
                    }
                  >
                    {fmt(outstanding)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="pt-2">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>% Repaid</span>
                    <span>{pctRepaid.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pctRepaid}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Status management */}
            {canChangeStatus && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-sm font-semibold text-slate-700">
                    Update Status
                  </h2>
                </div>
                <div className="flex flex-col gap-3 px-6 py-5">
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as LoanStatus | '')
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                  >
                    <option value="">Select new status…</option>
                    {LOAN_STATUSES.filter((s) => s.value !== loan.status).map(
                      (s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    disabled={!newStatus || statusMutation.isPending}
                    onClick={() => setStatusConfirmOpen(true)}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {statusMutation.isPending ? 'Updating…' : 'Update Status'}
                  </button>

                  {statusMutation.isError && (
                    <p className="text-xs text-red-600">
                      Failed to update status. Please try again.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">
                Payment History
              </h2>
              <p className="text-xs text-slate-400">
                {approvedPayments.length} approved of {payments.length} recorded
              </p>
            </div>
            {isManager && (
              <button
                type="button"
                onClick={() => setPaymentPanelOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              >
                <CreditCard size={14} />
                Record Payment
              </button>
            )}
          </div>

          <div className="p-4">
            <DataTable
              columns={paymentColumns}
              data={payments}
              rowKey={(row) => row.id}
              emptyMessage="No payments recorded yet."
            />
          </div>
        </div>
      </div>

      {/* Payment slide-in panel */}
      <PaymentPanel
        isOpen={paymentPanelOpen}
        onClose={() => setPaymentPanelOpen(false)}
        loanId={id!}
        loanCurrencyId={loan.currencyId}
        currencies={currencies}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['loan', id] })
          queryClient.invalidateQueries({ queryKey: ['loans'] })
        }}
      />

      {/* Status change confirmation */}
      <ConfirmModal
        isOpen={statusConfirmOpen}
        title="Update Loan Status"
        message={`Change loan ${loan.loanNumber} status to "${
          LOAN_STATUSES.find((s) => s.value === newStatus)?.label ?? newStatus
        }"? This action will be logged.`}
        confirmLabel="Update Status"
        onConfirm={() => {
          if (newStatus) statusMutation.mutate(newStatus as LoanStatus)
        }}
        onClose={() => setStatusConfirmOpen(false)}
      />

      {/* Approve payment confirmation */}
      <ConfirmModal
        isOpen={!!approvingPaymentId}
        title="Approve Payment"
        message="Approve this loan payment? Once approved it will count towards the outstanding balance."
        confirmLabel="Approve Payment"
        onConfirm={() => {
          if (approvingPaymentId)
            approvePaymentMutation.mutate(approvingPaymentId)
        }}
        onClose={() => setApprovingPaymentId(null)}
      />
    </>
  )
}
