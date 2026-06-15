import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, CheckCircle, XCircle, Info } from 'lucide-react'
import { feesApi, settingsApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import {
  PageHeader,
  DataTable,
  Pagination,
  StatusBadge,
  ConfirmModal,
} from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatCurrency, formatDate, getPaymentMethodLabel } from '../../lib/utils'
import type { FeeReceipt, TxStatus } from '../../types'

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
            t.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white',
          ].join(' ')}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => onRemove(t.id)}
            className="shrink-0 rounded p-0.5 hover:bg-white/20"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  isOpen: boolean
  receiptNumber: string
  onConfirm: (reason: string) => void
  onClose: () => void
}

function RejectModal({ isOpen, receiptNumber, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setReason('')
      const id = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  useEffect(() => {
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
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 animate-scale-in">
        <div className="p-6">
          <h2
            id="reject-modal-title"
            className="text-base font-bold text-slate-900"
          >
            Reject Receipt
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Provide a reason for rejecting <span className="font-semibold text-slate-700">{receiptNumber}</span>.
          </p>

          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Enter rejection reason..."
            className="input mt-4 resize-none"
          />

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
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
              className="btn-danger"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TxStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'MOBILE_MONEY',
  'CARD',
  'OTHER',
] as const

export default function FeesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // ── Filters ──────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TxStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchRaw)
      setPage(1)
    }, 400)
    return () => clearTimeout(id)
  }, [searchRaw])

  // Reset to page 1 when any filter changes
  const handleFilterChange = useCallback(() => setPage(1), [])

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ── Approval / Rejection modals ───────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<FeeReceipt | null>(null)
  const [rejectTarget, setRejectTarget] = useState<FeeReceipt | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────
  const queryParams = {
    page,
    limit: 20,
    ...(statusFilter && { status: statusFilter }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(categoryFilter && { categoryId: categoryFilter }),
    ...(search && { search }),
  }

  const { data: feesResponse, isLoading } = useQuery({
    queryKey: ['fees', queryParams],
    queryFn: () => feesApi.list(queryParams),
  })

  const { data: categoriesResponse } = useQuery({
    queryKey: ['feeCategories'],
    queryFn: () => settingsApi.feeCategories({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const receipts: FeeReceipt[] =
    feesResponse?.success ? feesResponse.data : []
  const meta = feesResponse?.success ? feesResponse.meta : undefined
  const categories = categoriesResponse?.success ? categoriesResponse.data : []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateFees = () => queryClient.invalidateQueries({ queryKey: ['fees'] })

  const approveMutation = useMutation({
    mutationFn: (id: string) => feesApi.approve(id),
    onSuccess: (res) => {
      if (res.success) {
        invalidateFees()
        addToast('Receipt approved successfully.')
      } else {
        addToast(res.error ?? 'Approval failed.', 'error')
      }
    },
    onError: () => addToast('Approval failed. Please try again.', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      feesApi.reject(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        invalidateFees()
        addToast('Receipt rejected.')
      } else {
        addToast(res.error ?? 'Rejection failed.', 'error')
      }
    },
    onError: () => addToast('Rejection failed. Please try again.', 'error'),
  })

  // ── Role checks ───────────────────────────────────────────────────────────
  const canCreate =
    user?.role === 'CASHIER' || user?.role === 'FINANCE_MANAGER'

  const canApprove = (receipt: FeeReceipt) =>
    receipt.status === 'PENDING_APPROVAL' &&
    receipt.createdById !== user?.id &&
    (user?.role === 'FINANCE_MANAGER' || user?.role === 'PRINCIPAL')

  const isSelfCreated = (receipt: FeeReceipt) =>
    receipt.createdById === user?.id

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<FeeReceipt>[] = [
    {
      header: 'Receipt #',
      accessor: 'receiptNumber',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">{String(v)}</span>
      ),
    },
    {
      header: 'Student Name',
      accessor: 'studentName',
    },
    {
      header: 'Grade',
      accessor: 'grade',
      render: (v) => (v ? String(v) : '—'),
    },
    {
      header: 'Category',
      accessor: 'category.name',
      render: (v) => (v ? String(v) : '—'),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (v, row) =>
        row.currency
          ? formatCurrency(Number(v), row.currency.symbol, row.currency.code)
          : String(v),
      className: 'text-right',
    },
    {
      header: 'Payment Date',
      accessor: 'paymentDate',
      render: (v) => (v ? formatDate(String(v)) : '—'),
    },
    {
      header: 'Method',
      accessor: 'paymentMethod',
      render: (v) => getPaymentMethodLabel(v as (typeof PAYMENT_METHODS)[number]),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => <StatusBadge status={v as TxStatus} />,
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_, row) => {
        const approvalBlocked = isSelfCreated(row) &&
          row.status === 'PENDING_APPROVAL' &&
          (user?.role === 'FINANCE_MANAGER' || user?.role === 'PRINCIPAL')

        return (
          <div className="flex items-center gap-2">
            {/* View */}
            <button
              type="button"
              title="View receipt"
              onClick={() => navigate(`/fees/${row.id}`)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <Eye size={13} />
              View
            </button>

            {canApprove(row) && (
              <button
                type="button"
                title="Approve receipt"
                onClick={() => setApproveTarget(row)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <CheckCircle size={13} />
                Approve
              </button>
            )}

            {approvalBlocked && (
              <span
                title="Separation of duties: you cannot approve a receipt you created."
                className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300"
              >
                <CheckCircle size={13} />
                Approve
                <Info size={11} />
              </span>
            )}

            {canApprove(row) && (
              <button
                type="button"
                title="Reject receipt"
                onClick={() => setRejectTarget(row)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle size={13} />
                Reject
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Receipts"
        action={
          canCreate ? (
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TxStatus | ''); handleFilterChange() }}
            className="input py-2"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); handleFilterChange() }}
            className="input py-2"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); handleFilterChange() }}
            className="input py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); handleFilterChange() }}
            className="input py-2"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Search</label>
          <input
            type="search"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Student name, receipt #..."
            className="input min-w-[180px] py-2"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={receipts}
          isLoading={isLoading}
          emptyMessage="No fee receipts found."
          rowKey={(row) => row.id}
        />
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Approve confirm modal */}
      <ConfirmModal
        isOpen={!!approveTarget}
        title="Approve Receipt"
        message={`Approve receipt ${approveTarget?.receiptNumber ?? ''} for ${approveTarget?.studentName ?? ''}?`}
        confirmLabel="Approve"
        confirmVariant="primary"
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget.id)
        }}
        onClose={() => setApproveTarget(null)}
      />

      {/* Reject modal */}
      <RejectModal
        isOpen={!!rejectTarget}
        receiptNumber={rejectTarget?.receiptNumber ?? ''}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason })
        }}
        onClose={() => setRejectTarget(null)}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
