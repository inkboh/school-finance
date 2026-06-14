import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Eye, CheckCircle, XCircle, Search, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { expensesApi, settingsApi } from '../../lib/api'
import {
  PageHeader,
  DataTable,
  Pagination,
  StatusBadge,
  ConfirmModal,
  type Column,
} from '../../components/shared'
import { formatDate, formatCurrency, getPaymentMethodLabel } from '../../lib/utils'
import type { Expense, TxStatus } from '../../types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Filters {
  status: string
  dateFrom: string
  dateTo: string
  search: string
  categoryId: string
}

interface RejectState {
  expenseId: string
  reason: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

function buildCategoryLabel(expense: Expense): string {
  if (!expense.category) return '—'
  const { category } = expense
  return category.parent
    ? `${category.parent.name} › ${category.name}`
    : category.name
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ExpensesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const canApprove =
    user?.role === 'FINANCE_MANAGER' || user?.role === 'PRINCIPAL'

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const LIMIT = 20

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>({
    status: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    categoryId: '',
  })

  const setFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
      setPage(1)
    },
    [],
  )

  const clearFilters = () => {
    setFilters({ status: '', dateFrom: '', dateTo: '', search: '', categoryId: '' })
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  // ── Approve / Reject state ───────────────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<string | null>(null)
  const [rejectState, setRejectState] = useState<RejectState | null>(null)

  // ── Data queries ─────────────────────────────────────────────────────────────
  const queryParams = {
    page,
    limit: LIMIT,
    ...(filters.status && { status: filters.status }),
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
    ...(filters.search && { search: filters.search }),
    ...(filters.categoryId && { categoryId: filters.categoryId }),
  }

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => expensesApi.list(queryParams),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => settingsApi.expenseCategories({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const expenses =
    expensesData?.success ? (expensesData.data as Expense[]) : []
  const meta = expensesData?.success ? expensesData.meta : undefined
  const totalPages = meta?.totalPages ?? 1

  const categories = categoriesData?.success ? categoriesData.data : []

  // ── Mutations ────────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setApproveTarget(null)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expensesApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setRejectState(null)
    },
  })

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: Column<Expense>[] = [
    {
      header: 'Expense #',
      accessor: 'expenseNumber',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">{String(v ?? '—')}</span>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (_v, row) => (
        <span className="text-slate-700">{buildCategoryLabel(row)}</span>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (v) => (
        <span
          className="block max-w-[180px] truncate text-slate-700"
          title={String(v ?? '')}
        >
          {String(v ?? '—')}
        </span>
      ),
    },
    {
      header: 'Vendor',
      accessor: 'vendor',
      render: (v) => <span className="text-slate-600">{String(v ?? '—')}</span>,
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (v, row) =>
        row.currency
          ? formatCurrency(Number(v), row.currency.symbol, row.currency.code)
          : `${Number(v).toFixed(2)}`,
    },
    {
      header: 'Currency',
      accessor: 'currency.code',
      render: (_v, row) => (
        <span className="font-mono text-xs">{row.currency?.code ?? '—'}</span>
      ),
    },
    {
      header: 'Date',
      accessor: 'expenseDate',
      render: (v) => formatDate(String(v ?? '')),
    },
    {
      header: 'Method',
      accessor: 'paymentMethod',
      render: (v) => getPaymentMethodLabel(v as Expense['paymentMethod']),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => <StatusBadge status={v as TxStatus} />,
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_v, row) => {
        const isPending = row.status === 'PENDING_APPROVAL'
        const isCreator = row.createdById === user?.id
        const canActOnThis = canApprove && isPending && !isCreator

        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(`/expenses/${row.id}`)}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
              title="View detail"
            >
              <Eye size={15} />
            </button>

            {canActOnThis && (
              <>
                <button
                  type="button"
                  onClick={() => setApproveTarget(row.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                  title="Approve"
                >
                  <CheckCircle size={15} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRejectState({ expenseId: row.id, reason: '' })
                  }
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Reject"
                >
                  <XCircle size={15} />
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track and manage school expenditure"
        action={
          <button
            type="button"
            onClick={() => navigate('/expenses/new')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <PlusCircle size={16} />
            New Expense
          </button>
        }
      />

      {/* ── Filter bar ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Category */}
          <select
            value={filters.categoryId}
            onChange={(e) => setFilter('categoryId', e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.parent ? `${cat.parent.name} › ${cat.name}` : cat.name}
              </option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter('dateFrom', e.target.value)}
            placeholder="From date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          {/* Date To */}
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter('dateTo', e.target.value)}
            placeholder="To date"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          {/* Search */}
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="Description, vendor, #..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={13} />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={expenses}
        isLoading={isLoading}
        emptyMessage="No expenses found. Adjust the filters or record a new expense."
        rowKey={(row) => row.id}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* ── Approve confirm modal ──────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={approveTarget !== null}
        title="Approve Expense"
        message="Are you sure you want to approve this expense? This action cannot be undone."
        confirmLabel={approveMutation.isPending ? 'Approving…' : 'Approve'}
        confirmVariant="primary"
        onConfirm={() => {
          if (approveTarget) approveMutation.mutate(approveTarget)
        }}
        onClose={() => setApproveTarget(null)}
      />

      {/* ── Reject modal ──────────────────────────────────────────────────────── */}
      {rejectState !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="reject-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRejectState(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setRejectState(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <h2
              id="reject-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Reject Expense
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Provide a reason for rejecting this expense.
            </p>

            <textarea
              value={rejectState.reason}
              onChange={(e) =>
                setRejectState((prev) =>
                  prev ? { ...prev, reason: e.target.value } : prev,
                )
              }
              rows={3}
              placeholder="Reason for rejection…"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectState(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !rejectState.reason.trim() || rejectMutation.isPending
                }
                onClick={() => {
                  rejectMutation.mutate({
                    id: rejectState.expenseId,
                    reason: rejectState.reason.trim(),
                  })
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
