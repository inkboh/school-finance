import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Eye, FolderKanban, Search } from 'lucide-react'
import { projectsApi } from '../../lib/api'
import { PageHeader, DataTable, Pagination } from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { Project, ProjectFunding, ProjectStatus } from '../../types'

const STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING:  'bg-blue-100 text-blue-700 border border-blue-200',
  ACTIVE:    'bg-emerald-100 text-emerald-800 border border-emerald-200',
  ON_HOLD:   'bg-amber-100 text-amber-700 border border-amber-200',
  COMPLETED: 'bg-brand-100 text-brand-700 border border-brand-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border border-slate-200',
}

function FundingBar({ project }: { project: Project }) {
  const funding = (project.funding as Pick<ProjectFunding, 'status' | 'amount'>[] | undefined) ?? []
  const received = funding.filter((f) => f.status === 'RECEIVED').reduce((s, f) => s + Number(f.amount), 0)
  const pledged  = funding.filter((f) => f.status === 'PLEDGED').reduce((s, f) => s + Number(f.amount), 0)
  const budget   = Number(project.budget)
  const receivedPct = budget > 0 ? Math.min(100, (received / budget) * 100) : 0
  const pledgedPct  = budget > 0 ? Math.min(100 - receivedPct, (pledged / budget) * 100) : 0

  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{project.currency?.symbol}{received.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</span>
        <span className="text-slate-400">/ {project.currency?.symbol}{budget.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full flex">
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${receivedPct}%` }} />
          <div className="h-full bg-emerald-200" style={{ width: `${pledgedPct}%` }} />
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-0.5">
        {receivedPct.toFixed(0)}% received{pledgedPct > 0 ? ` - ${pledgedPct.toFixed(0)}% pledged` : ''}
      </p>
    </div>
  )
}

export default function ProjectsListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, search, status],
    queryFn: () => projectsApi.list({ page, limit: 20, search: search || undefined, status: status || undefined }),
    staleTime: 30_000,
  })

  const projects: Project[] = data?.success ? (data.data as Project[]) : []
  const meta = data?.success ? data.meta : undefined

  const columns: Column<Project>[] = [
    { accessor: 'projectNumber', header: 'Project #', render: (_v, p) => <span className="font-mono text-xs font-semibold text-brand-700">{p.projectNumber}</span> },
    { accessor: 'name', header: 'Project', render: (_v, p) => (
      <div>
        <p className="font-medium text-slate-800">{p.name}</p>
        {p.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{p.description}</p>}
      </div>
    )},
    { accessor: 'status', header: 'Status', render: (_v, p) => (
      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status.replace('_', ' ')}</span>
    )},
    { accessor: 'startDate', header: 'Timeline', render: (_v, p) => (
      <div className="text-xs text-slate-500">
        {p.startDate ? formatDate(p.startDate) : '--'}
        {p.endDate ? <><br />{formatDate(p.endDate)}</> : ''}
      </div>
    )},
    { accessor: 'budget', header: 'Funding Progress', render: (_v, p) => <FundingBar project={p} /> },
    { accessor: 'id', header: '', render: (_v, p) => (
      <button onClick={() => navigate(`/projects/${p.id}`)} className="btn-icon" title="View project">
        <Eye size={15} />
      </button>
    )},
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Capital projects, renovations, and major school initiatives"
        action={
          <button onClick={() => navigate('/projects/new')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Project
          </button>
        }
      />

      <div className="card-md flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 w-full" placeholder="Search projects..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="select w-40" value={status} onChange={(e) => { setStatus(e.target.value as ProjectStatus | ''); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="PLANNING">Planning</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={projects}
          isLoading={isLoading}
          emptyMessage="No projects yet. Create your first project to start tracking funding and progress."
          rowKey={(_r, i) => i}
        />
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
