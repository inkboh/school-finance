import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, FolderKanban } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { projectsApi, settingsApi } from '../../lib/api'
import { DataTable } from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { Project, ProjectFunding, ProjectStatus, FundingStatus } from '../../types'

const STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING:  'bg-blue-100 text-blue-700 border border-blue-200',
  ACTIVE:    'bg-emerald-100 text-emerald-800 border border-emerald-200',
  ON_HOLD:   'bg-amber-100 text-amber-700 border border-amber-200',
  COMPLETED: 'bg-brand-100 text-brand-700 border border-brand-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border border-slate-200',
}

const FUNDING_STATUS_COLORS: Record<FundingStatus, string> = {
  PLEDGED:   'bg-amber-100 text-amber-700',
  RECEIVED:  'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

const TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Internal', PTA: 'PTA / Parents', GRANT: 'Grant',
  DONATION: 'Donation', LOAN: 'Loan', OTHER: 'Other',
}

// ─── Funding Bar ──────────────────────────────────────────────────────────────
function FundingTracker({ project }: { project: Project }) {
  const funding = project.funding ?? []
  const budget   = Number(project.budget)
  const received = funding.filter((f) => f.status === 'RECEIVED').reduce((s, f) => s + Number(f.amount), 0)
  const pledged  = funding.filter((f) => f.status === 'PLEDGED').reduce((s, f) => s + Number(f.amount), 0)
  const gap      = Math.max(0, budget - received - pledged)
  const sym      = project.currency?.symbol ?? '₵'
  const fmt      = (n: number) => `${sym}${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

  const receivedPct = budget > 0 ? Math.min(100, (received / budget) * 100) : 0
  const pledgedPct  = budget > 0 ? Math.min(100 - receivedPct, (pledged / budget) * 100) : 0
  const gapPct      = 100 - receivedPct - pledgedPct

  return (
    <div className="card-md space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Funding Overview</h2>
      <div className="h-5 w-full rounded-full overflow-hidden flex bg-slate-100">
        {receivedPct > 0 && (
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${receivedPct}%` }}
            title={`Received: ${fmt(received)}`} />
        )}
        {pledgedPct > 0 && (
          <div className="h-full bg-emerald-200 transition-all" style={{ width: `${pledgedPct}%` }}
            title={`Pledged: ${fmt(pledged)}`} />
        )}
        {gapPct > 0 && (
          <div className="h-full bg-red-100 transition-all" style={{ width: `${gapPct}%` }}
            title={`Gap: ${fmt(gap)}`} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Budget', value: fmt(budget), color: 'text-slate-800' },
          { label: 'Received', value: fmt(received), color: 'text-emerald-700' },
          { label: 'Pledged', value: fmt(pledged), color: 'text-amber-600' },
          { label: 'Gap', value: fmt(gap), color: gap > 0 ? 'text-red-600' : 'text-emerald-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />Received ({receivedPct.toFixed(0)}%)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-200 inline-block" />Pledged ({pledgedPct.toFixed(0)}%)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-200 inline-block" />Gap ({gapPct.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

// ─── Add Funding Modal ────────────────────────────────────────────────────────
interface AddFundingValues {
  source: string; type: string; amount: string; currencyId: string
  date: string; status: string; notes: string
}

function AddFundingModal({ projectId, currencies, onClose, onSuccess }: {
  projectId: string
  currencies: { id: string; code: string; name: string; isBaseCurrency: boolean }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const baseCurrency = currencies.find((c) => c.isBaseCurrency)
  const { register, handleSubmit } = useForm<AddFundingValues>({
    defaultValues: {
      type: 'INTERNAL',
      status: 'PLEDGED',
      date: new Date().toISOString().slice(0, 10),
      currencyId: baseCurrency?.id ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (v: AddFundingValues) => projectsApi.addFunding(projectId, {
      source: v.source,
      type: v.type,
      amount: Number(v.amount),
      currencyId: v.currencyId,
      date: v.date,
      status: v.status,
      notes: v.notes || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 animate-scale-in">
        <h2 className="text-base font-semibold text-slate-800">Add Funding Source</h2>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
          <div>
            <label className="label">Source / Donor</label>
            <input className="input" {...register('source')} placeholder="e.g. PTA, District Education Office, Rotary Club" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="select" {...register('type')}>
                <option value="INTERNAL">Internal</option>
                <option value="PTA">PTA / Parents</option>
                <option value="GRANT">Grant</option>
                <option value="DONATION">Donation</option>
                <option value="LOAN">Loan</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" {...register('status')}>
                <option value="PLEDGED">Pledged</option>
                <option value="RECEIVED">Received</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input type="number" step="0.01" min="0" className="input" {...register('amount')} required />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="select" {...register('currencyId')}>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" {...register('date')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[60px]" {...register('notes')} />
          </div>
          {mutation.error && <p className="text-sm text-red-600">Something went wrong.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add Funding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showAddFunding, setShowAddFunding] = useState(false)
  const [editStatus, setEditStatus] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60_000,
  })

  const deleteFundingMutation = useMutation({
    mutationFn: (fundingId: string) => projectsApi.deleteFunding(id!, fundingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => projectsApi.update(id!, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setEditStatus(false) },
  })

  const project = data?.success ? (data.data as Project) : null
  const currencies = currenciesRes?.success ? currenciesRes.data : []

  const fundingColumns: Column<ProjectFunding>[] = [
    { accessor: 'source', header: 'Source / Donor', render: (_v, f) => <span className="font-medium text-slate-800">{f.source}</span> },
    { accessor: 'type', header: 'Type', render: (_v, f) => <span className="text-sm text-slate-600">{TYPE_LABELS[f.type] ?? f.type}</span> },
    { accessor: 'amount', header: 'Amount', render: (_v, f) => (
      <span className="font-semibold text-slate-800">
        {f.currency?.symbol}{Number(f.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })} {f.currency?.code}
      </span>
    )},
    { accessor: 'status', header: 'Status', render: (_v, f) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FUNDING_STATUS_COLORS[f.status]}`}>{f.status}</span>
    )},
    { accessor: 'date', header: 'Date', render: (_v, f) => <span className="text-sm text-slate-500">{formatDate(f.date)}</span> },
    { accessor: 'notes', header: 'Notes', render: (_v, f) => <span className="text-xs text-slate-400 truncate max-w-[120px]">{f.notes ?? '—'}</span> },
    { accessor: 'id', header: '', render: (_v, f) => (
      <button onClick={() => { if (confirm('Remove this funding entry?')) deleteFundingMutation.mutate(f.id) }}
        className="btn-icon text-red-500 hover:bg-red-50" title="Remove">
        <Trash2 size={14} />
      </button>
    )},
  ]

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
  if (!project) return <div className="text-center text-slate-500 py-16">Project not found.</div>

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/projects')} className="btn-icon"><ArrowLeft size={18} /></button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title">{project.name}</h1>
                {editStatus ? (
                  <select className="select text-xs h-7 py-0.5" defaultValue={project.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    onBlur={() => setEditStatus(false)}>
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                ) : (
                  <button onClick={() => setEditStatus(true)}
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full cursor-pointer ${STATUS_COLORS[project.status]}`}>
                    {project.status.replace('_', ' ')}
                  </button>
                )}
              </div>
              <p className="page-subtitle font-mono">{project.projectNumber} · By {project.createdBy?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="card-md grid gap-4 sm:grid-cols-2">
          {project.description && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Description</p>
              <p className="text-sm text-slate-700 mt-0.5">{project.description}</p>
            </div>
          )}
          {project.scope && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Scope / Deliverables</p>
              <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{project.scope}</p>
            </div>
          )}
          {([
            ['Start Date', project.startDate ? formatDate(project.startDate) : '—'],
            ['End Date', project.endDate ? formatDate(project.endDate) : '—'],
            ['Currency', `${project.currency?.code} — ${project.currency?.symbol}`],
            ['Created', formatDate(project.createdAt)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</p>
              <p className="text-sm text-slate-800 mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {/* Funding Tracker */}
        <FundingTracker project={project} />

        {/* Funding Sources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Funding Sources</h2>
            <button onClick={() => setShowAddFunding(true)} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Plus size={13} /> Add Funding
            </button>
          </div>
          <div className="card overflow-hidden">
            <DataTable
              columns={fundingColumns}
              data={project.funding ?? []}
              emptyMessage="No funding sources yet. Add funding sources to track budget progress."
              rowKey={(_r, i) => i}
            />
          </div>
        </div>
      </div>

      {showAddFunding && (
        <AddFundingModal
          projectId={id!}
          currencies={currencies}
          onClose={() => setShowAddFunding(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['project', id] })}
        />
      )}
    </>
  )
}
