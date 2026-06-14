import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Calendar,
  CreditCard,
  Tag,
  User,
  FileText,
  Hash,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { expensesApi } from '../../lib/api'
import { PageHeader, StatusBadge, ConfirmModal } from '../../components/shared'
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getPaymentMethodLabel,
} from '../../lib/utils'
import type { TxStatus } from '../../types'

// ─── Sub-components ────────────────────────────────────────────────────────────

interface DetailRowProps {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      {icon && (
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-slate-800">{value}</div>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-slate-100 px-6">{children}</div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="h-40 rounded-xl bg-slate-100" />
      <div className="h-40 rounded-xl bg-slate-100" />
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const canApprove =
    user?.role === 'FINANCE_MANAGER' || user?.role === 'PRINCIPAL'

  // ── Modals ────────────────────────────────────────────────────────────────────
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // ── Query ─────────────────────────────────────────────────────────────────────
  const {
    data: expenseData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.get(id!),
    enabled: !!id,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: () => expensesApi.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setShowApproveModal(false)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => expensesApi.reject(id!, rejectReason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  // ── Derived state ─────────────────────────────────────────────────────────────
  const expense = expenseData?.success ? expenseData.data : null

  const isPending = expense?.status === 'PENDING_APPROVAL'
  const isCreator = expense?.createdById === user?.id
  const canActOnThis = canApprove && isPending && !isCreator

  // Category path
  const categoryPath = expense?.category
    ? expense.category.parent
      ? `${expense.category.parent.name} › ${expense.category.name}`
      : expense.category.name
    : '—'

  const isNonBase =
    expense?.currency && !expense.currency.isBaseCurrency

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense Detail" />
        <DetailSkeleton />
      </div>
    )
  }

  if (isError || !expense) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense Detail" />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm font-medium text-red-700">
            Could not load this expense.
          </p>
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="mt-2 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            Back to Expenses
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Expense ${expense.expenseNumber}`}
        subtitle={categoryPath}
        action={
          <div className="flex items-center gap-2">
            {canActOnThis && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <XCircle size={15} />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle size={15} />
                  Approve
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          </div>
        }
      />

      {/* Separation of duties notice — shown when creator is viewing a pending expense */}
      {isCreator && isPending && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            You submitted this expense. A different staff member with Finance
            Manager or Principal role must approve or reject it.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ─────────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Expense details */}
          <Section title="Expense Details">
            <DetailRow
              icon={<Hash size={14} />}
              label="Expense Number"
              value={
                <span className="font-mono text-sm">{expense.expenseNumber}</span>
              }
            />
            <DetailRow
              icon={<Tag size={14} />}
              label="Category"
              value={
                <span className="font-medium text-slate-900">{categoryPath}</span>
              }
            />
            <DetailRow
              icon={<FileText size={14} />}
              label="Description"
              value={expense.description}
            />
            {expense.vendor && (
              <DetailRow
                icon={<User size={14} />}
                label="Vendor"
                value={expense.vendor}
              />
            )}
            <DetailRow
              icon={<Calendar size={14} />}
              label="Expense Date"
              value={formatDate(expense.expenseDate)}
            />
            <DetailRow
              icon={<CreditCard size={14} />}
              label="Payment Method"
              value={getPaymentMethodLabel(expense.paymentMethod)}
            />
            {expense.reference && (
              <DetailRow
                icon={<Hash size={14} />}
                label="Reference"
                value={expense.reference}
              />
            )}
            {expense.notes && (
              <DetailRow
                icon={<FileText size={14} />}
                label="Notes"
                value={
                  <span className="whitespace-pre-line">{expense.notes}</span>
                }
              />
            )}
          </Section>

          {/* Financials */}
          <Section title="Financial Summary">
            <DetailRow
              label="Amount"
              value={
                expense.currency
                  ? formatCurrency(
                      expense.amount,
                      expense.currency.symbol,
                      expense.currency.code,
                    )
                  : expense.amount.toFixed(2)
              }
            />
            {isNonBase && (
              <>
                <DetailRow
                  label="Exchange Rate"
                  value={`1 ${expense.currency?.code} = ${expense.exchangeRate} base`}
                />
                <DetailRow
                  label="Amount (Base Currency)"
                  value={
                    <span className="font-semibold text-slate-900">
                      {expense.amountBase.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  }
                />
              </>
            )}
          </Section>

          {/* Rejection reason */}
          {expense.status === 'REJECTED' && expense.rejectedReason && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
              <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Rejection Reason
                </p>
                <p className="mt-1 text-sm text-red-700">
                  {expense.rejectedReason}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Status card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </p>
            <div className="mt-2">
              <StatusBadge status={expense.status as TxStatus} />
            </div>

            {expense.status === 'APPROVED' && expense.approvedBy && (
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                <p>
                  <span className="font-medium">Approved by:</span>{' '}
                  {expense.approvedBy.name}
                </p>
                {expense.approvedAt && (
                  <p>
                    <span className="font-medium">Approved at:</span>{' '}
                    {formatDateTime(expense.approvedAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Audit card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Record Info
            </p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Submitted by</p>
                <p className="mt-0.5 font-medium text-slate-800">
                  {expense.createdBy?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Submitted at</p>
                <p className="mt-0.5 text-slate-700">
                  {formatDateTime(expense.createdAt)}
                </p>
              </div>
              {expense.approvedBy && (
                <div>
                  <p className="text-xs text-slate-400">
                    {expense.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}
                  </p>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {expense.approvedBy.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Approve confirm modal ──────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showApproveModal}
        title="Approve Expense"
        message={`Approve ${expense.expenseNumber} for ${expense.currency ? formatCurrency(expense.amount, expense.currency.symbol, expense.currency.code) : expense.amount}? This action cannot be undone.`}
        confirmLabel={approveMutation.isPending ? 'Approving…' : 'Approve'}
        confirmVariant="primary"
        onConfirm={() => approveMutation.mutate()}
        onClose={() => setShowApproveModal(false)}
      />

      {/* ── Reject modal ──────────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="reject-detail-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowRejectModal(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h2
                  id="reject-detail-modal-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Reject Expense
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Please provide a reason for rejecting{' '}
                  <span className="font-medium">{expense.expenseNumber}</span>.
                </p>
              </div>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection…"
              className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300"
            />

            {rejectMutation.isError && (
              <p className="mt-2 text-xs text-red-600">
                Failed to reject expense. Please try again.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
