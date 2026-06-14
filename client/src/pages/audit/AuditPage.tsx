import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { auditApi } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'
import type { AuditLog } from '../../types'
import {
  PageHeader,
  DataTable,
  Pagination,
} from '../../components/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  'FeeReceipt',
  'Expense',
  'Loan',
  'LoanPayment',
  'User',
  'Currency',
] as const

const ACTIONS = [
  'CREATE',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
  'UPDATE',
  'DEACTIVATE',
  'ACTIVATE',
] as const

const PAGE_SIZE = 50

// ─── Action chip colours ──────────────────────────────────────────────────────

function getActionChipClass(action: string): string {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
    case 'APPROVE':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
    case 'REJECT':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
    case 'LOGIN':
      return 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
    case 'LOGOUT':
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
    case 'UPDATE':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
    case 'DEACTIVATE':
      return 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200'
    case 'ACTIVATE':
      return 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
  }
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

function ExpandedRow({ log }: { log: AuditLog }) {
  const hasOld = log.oldValue !== undefined && log.oldValue !== null
  const hasNew = log.newValue !== undefined && log.newValue !== null

  if (!hasOld && !hasNew) {
    return (
      <p className="text-sm text-slate-400 italic">No value snapshot recorded.</p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {hasOld && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Old Value
          </p>
          <pre className="overflow-x-auto rounded-md bg-red-50 p-3 text-xs text-red-800 ring-1 ring-inset ring-red-100">
            {JSON.stringify(log.oldValue, null, 2)}
          </pre>
        </div>
      )}
      {hasNew && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            New Value
          </p>
          <pre className="overflow-x-auto rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-100">
            {JSON.stringify(log.newValue, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  // ── Filter state ──
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  // ── Expanded row ──
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Query ──
  const { data, isLoading } = useQuery({
    queryKey: ['audit', { entityType, action, userFilter, dateFrom, dateTo, page }],
    queryFn: () =>
      auditApi.list({
        entityType: entityType || undefined,
        action: action || undefined,
        user: userFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  })

  const logs: AuditLog[] = data?.success ? (data.data as AuditLog[]) : []
  const meta = data?.success ? data.meta : undefined
  const totalPages = meta?.totalPages ?? 1

  // ── Reset page when filters change ──
  function applyFilter(setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      setPage(1)
      setExpandedId(null)
    }
  }

  // ── Columns ──
  const columns = [
    {
      header: '',
      accessor: 'id' as const,
      className: 'w-8',
      render: (_: unknown, row: AuditLog) => (
        <button
          type="button"
          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={expandedId === row.id ? 'Collapse row' : 'Expand row'}
        >
          {expandedId === row.id ? (
            <ChevronDown size={15} />
          ) : (
            <ChevronRight size={15} />
          )}
        </button>
      ),
    },
    {
      header: 'Timestamp',
      accessor: 'createdAt' as const,
      render: (v: unknown) => (
        <span className="whitespace-nowrap font-mono text-xs text-slate-600">
          {formatDateTime(v as string)}
        </span>
      ),
    },
    {
      header: 'User',
      accessor: 'user.name' as const,
      render: (_: unknown, row: AuditLog) => (
        <div>
          <p className="font-medium text-slate-800">
            {row.user?.name ?? '—'}
          </p>
          {row.user?.email && (
            <p className="text-xs text-slate-400">{row.user.email}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: 'action' as const,
      render: (v: unknown) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionChipClass(v as string)}`}
        >
          {v as string}
        </span>
      ),
    },
    {
      header: 'Entity Type',
      accessor: 'entityType' as const,
      render: (v: unknown) => (
        <span className="text-sm text-slate-700">{v as string}</span>
      ),
    },
    {
      header: 'Entity ID',
      accessor: 'entityId' as const,
      render: (v: unknown) => {
        if (!v) return <span className="text-slate-400">—</span>
        const id = v as string
        const truncated = id.length > 12 ? `${id.slice(0, 8)}…` : id
        return (
          <span
            className="font-mono text-xs text-slate-500"
            title={id}
          >
            {truncated}
          </span>
        )
      },
    },
    {
      header: 'IP Address',
      accessor: 'ipAddress' as const,
      render: (v: unknown) => (
        <span className="font-mono text-xs text-slate-500">
          {(v as string) ?? '—'}
        </span>
      ),
    },
  ]

  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'
  const inputClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        subtitle="Complete record of all user actions in the system."
      />

      {/* Immutability notice */}
      <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
        <ShieldCheck size={16} className="shrink-0 text-indigo-500" />
        Audit logs are immutable and cannot be modified.
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap gap-3">
        {/* Entity Type */}
        <select
          value={entityType}
          onChange={(e) => applyFilter(setEntityType)(e.target.value)}
          className={selectClass}
          aria-label="Filter by entity type"
        >
          <option value="">All Entity Types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Action */}
        <select
          value={action}
          onChange={(e) => applyFilter(setAction)(e.target.value)}
          className={selectClass}
          aria-label="Filter by action"
        >
          <option value="">All Actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {/* User */}
        <input
          type="text"
          value={userFilter}
          onChange={(e) => applyFilter(setUserFilter)(e.target.value)}
          placeholder="Filter by user…"
          className={inputClass}
          aria-label="Filter by user"
        />

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => applyFilter(setDateFrom)(e.target.value)}
          className={inputClass}
          aria-label="Date from"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => applyFilter(setDateTo)(e.target.value)}
          className={inputClass}
          aria-label="Date to"
        />
      </div>

      {/* Table — custom render to support expandable rows */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-3">
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                    <span className="text-sm">No audit logs found.</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  {/* Main row */}
                  <tr
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                  >
                    {columns.map((col, ci) => {
                      const rawValue = col.accessor
                        .toString()
                        .split('.')
                        .reduce<unknown>(
                          (acc, key) =>
                            acc != null && typeof acc === 'object'
                              ? (acc as Record<string, unknown>)[key]
                              : undefined,
                          log as unknown,
                        )
                      const cell = col.render
                        ? col.render(rawValue, log)
                        : rawValue != null
                        ? String(rawValue)
                        : '—'
                      return (
                        <td
                          key={ci}
                          className={[
                            'whitespace-nowrap px-4 py-3 text-slate-700',
                            col.className ?? '',
                          ].join(' ')}
                        >
                          {cell}
                        </td>
                      )
                    })}
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === log.id && (
                    <tr className="bg-slate-50">
                      <td
                        colSpan={columns.length}
                        className="px-6 py-4"
                      >
                        <ExpandedRow log={log} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => {
          setPage(p)
          setExpandedId(null)
        }}
      />
    </div>
  )
}
