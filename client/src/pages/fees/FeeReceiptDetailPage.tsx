import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, User, Calendar, CreditCard, FileText, Hash } from 'lucide-react'
import { feesApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { StatusBadge, ConfirmModal } from '../../components/shared'
import { formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel } from '../../lib/utils'

// ─── Reject Modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  isOpen: boolean
  receiptNumber: string
  onConfirm: (reason: string) => void
  onClose: () => void
}

function RejectModal({ isOpen, receiptNumber, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('')

  React.useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="reject-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="p-6">
          <h2
            id="reject-modal-title"
            className="text-base font-semibold text-slate-900"
          >
            Reject Receipt
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Provide a reason for rejecting{' '}
            <span className="font-medium">{receiptNumber}</span>.
          </p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Enter rejection reason..."
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            autoFocus
          />

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => {
                if (reason.trim()) {
                  onConfirm(reason.trim())
                  onClose()
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4">
      <dt className="flex min-w-[160px] items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon && <span className="shrink-0">{icon}</span>}
        {label}
      </dt>
      <dd className="text-sm text-slate-800">{value ?? '—'}</dd>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeeReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const { data: response, isLoading } = useQuery({
    queryKey: ['fees', id],
    queryFn: () => feesApi.get(id!),
    enabled: !!id,
  })

  const receipt = response?.success ? response.data : null

  const invalidateFee = () => {
    queryClient.invalidateQueries({ queryKey: ['fees', id] })
    queryClient.invalidateQueries({ queryKey: ['fees'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => feesApi.approve(id!),
    onSuccess: (res) => {
      if (res.success) {
        invalidateFee()
        setActionMessage({ text: 'Receipt approved successfully.', type: 'success' })
      } else {
        setActionMessage({ text: res.error ?? 'Approval failed.', type: 'error' })
      }
    },
    onError: () =>
      setActionMessage({ text: 'Approval failed. Please try again.', type: 'error' }),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => feesApi.reject(id!, reason),
    onSuccess: (res) => {
      if (res.success) {
        invalidateFee()
        setActionMessage({ text: 'Receipt rejected.', type: 'success' })
      } else {
        setActionMessage({ text: res.error ?? 'Rejection failed.', type: 'error' })
      }
    },
    onError: () =>
      setActionMessage({ text: 'Rejection failed. Please try again.', type: 'error' }),
  })

  // ── Role checks ───────────────────────────────────────────────────────────
  const canAct =
    receipt?.status === 'PENDING_APPROVAL' &&
    receipt.createdById !== user?.id &&
    (user?.role === 'FINANCE_MANAGER' || user?.role === 'PRINCIPAL')

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>
        <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-5 w-3/4 rounded bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Receipt not found.
        </div>
      </div>
    )
  }

  const originalAmount = receipt.currency
    ? formatCurrency(receipt.amount, receipt.currency.symbol, receipt.currency.code)
    : `${receipt.amount}`

  const baseCurrencyCode = receipt.currency?.isBaseCurrency
    ? receipt.currency.code
    : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back + heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            Receipt{' '}
            <span className="font-mono text-slate-600">{receipt.receiptNumber}</span>
          </h1>
        </div>

        {/* Action bar */}
        {canAct && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle size={15} />
              Approve
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={rejectMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <XCircle size={15} />
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Action feedback message */}
      {actionMessage && (
        <div
          className={[
            'rounded-lg px-4 py-3 text-sm font-medium',
            actionMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-800',
          ].join(' ')}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Status section */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Status</span>
          <StatusBadge status={receipt.status} />
        </div>
        {receipt.createdBy && (
          <span className="text-xs text-slate-400">
            Created by{' '}
            <span className="font-medium text-slate-600">{receipt.createdBy.name}</span>
            {receipt.createdAt ? ` on ${formatDate(receipt.createdAt)}` : ''}
          </span>
        )}
      </div>

      {/* Main detail card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Student info */}
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Student Information
          </h2>
          <dl className="space-y-3">
            <DetailRow
              label="Student Name"
              value={receipt.studentName}
              icon={<User size={12} />}
            />
            {receipt.studentId && (
              <DetailRow
                label="Student ID"
                value={receipt.studentId}
                icon={<Hash size={12} />}
              />
            )}
            {receipt.grade && (
              <DetailRow
                label="Grade / Class"
                value={receipt.grade}
              />
            )}
          </dl>
        </div>

        {/* Payment info */}
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Payment Details
          </h2>
          <dl className="space-y-3">
            <DetailRow
              label="Fee Category"
              value={receipt.category?.name}
              icon={<FileText size={12} />}
            />
            <DetailRow
              label="Amount"
              value={
                <span className="font-semibold">{originalAmount}</span>
              }
              icon={<CreditCard size={12} />}
            />
            {!receipt.currency?.isBaseCurrency && (
              <>
                <DetailRow
                  label="Exchange Rate"
                  value={receipt.exchangeRate}
                />
                <DetailRow
                  label="Amount (Base)"
                  value={
                    <span className="font-semibold">
                      {receipt.currency
                        ? formatCurrency(
                            receipt.amountBase,
                            receipt.currency.symbol,
                            baseCurrencyCode ?? receipt.currency.code
                          )
                        : receipt.amountBase}
                    </span>
                  }
                />
              </>
            )}
            <DetailRow
              label="Payment Date"
              value={formatDate(receipt.paymentDate)}
              icon={<Calendar size={12} />}
            />
            <DetailRow
              label="Payment Method"
              value={getPaymentMethodLabel(receipt.paymentMethod)}
            />
            {receipt.reference && (
              <DetailRow
                label="Reference"
                value={receipt.reference}
              />
            )}
            {receipt.notes && (
              <DetailRow
                label="Notes"
                value={<span className="whitespace-pre-wrap">{receipt.notes}</span>}
              />
            )}
          </dl>
        </div>

        {/* Approval / rejection history */}
        <div className="px-6 py-4">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Approval History
          </h2>
          <dl className="space-y-3">
            {receipt.status === 'APPROVED' && receipt.approvedBy && (
              <>
                <DetailRow
                  label="Approved By"
                  value={receipt.approvedBy.name}
                  icon={<CheckCircle size={12} className="text-emerald-500" />}
                />
                {receipt.approvedAt && (
                  <DetailRow
                    label="Approved At"
                    value={formatDateTime(receipt.approvedAt)}
                    icon={<Calendar size={12} />}
                  />
                )}
              </>
            )}

            {receipt.status === 'REJECTED' && (
              <>
                {receipt.approvedBy && (
                  <DetailRow
                    label="Rejected By"
                    value={receipt.approvedBy.name}
                    icon={<XCircle size={12} className="text-red-500" />}
                  />
                )}
                {receipt.approvedAt && (
                  <DetailRow
                    label="Rejected At"
                    value={formatDateTime(receipt.approvedAt)}
                    icon={<Calendar size={12} />}
                  />
                )}
                {receipt.rejectedReason && (
                  <DetailRow
                    label="Rejection Reason"
                    value={
                      <span className="whitespace-pre-wrap rounded-md border border-red-100 bg-red-50 px-3 py-2 text-red-800 block">
                        {receipt.rejectedReason}
                      </span>
                    }
                  />
                )}
              </>
            )}

            {receipt.status === 'PENDING_APPROVAL' && (
              <p className="text-sm text-slate-400">
                This receipt is awaiting approval from a Finance Manager or Principal.
              </p>
            )}
          </dl>
        </div>
      </div>

      {/* Approve confirm modal */}
      <ConfirmModal
        isOpen={showApproveModal}
        title="Approve Receipt"
        message={`Approve receipt ${receipt.receiptNumber} for ${receipt.studentName}? This action cannot be undone.`}
        confirmLabel="Approve"
        confirmVariant="primary"
        onConfirm={() => approveMutation.mutate()}
        onClose={() => setShowApproveModal(false)}
      />

      {/* Reject modal */}
      <RejectModal
        isOpen={showRejectModal}
        receiptNumber={receipt.receiptNumber}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        onClose={() => setShowRejectModal(false)}
      />
    </div>
  )
}
