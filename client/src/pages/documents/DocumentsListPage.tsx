import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Eye, Download, BookOpen, Search, FileText, File } from 'lucide-react'
import { documentsApi } from '../../lib/api'
import { PageHeader, DataTable, Pagination } from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { PolicyDocument, DocumentCategory } from '../../types'

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  POLICY:     'bg-brand-100 text-brand-700',
  GUIDELINE:  'bg-blue-100 text-blue-700',
  PROCEDURE:  'bg-indigo-100 text-indigo-700',
  REGULATION: 'bg-purple-100 text-purple-700',
  CONTRACT:   'bg-orange-100 text-orange-700',
  REPORT:     'bg-teal-100 text-teal-700',
  OTHER:      'bg-slate-100 text-slate-600',
}

export default function DocumentsListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentCategory | ''>('')
  const [showInactive, setShowInactive] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', page, search, category, showInactive],
    queryFn: () => documentsApi.list({
      page, limit: 20,
      search: search || undefined,
      category: category || undefined,
      isActive: showInactive ? undefined : true,
    }),
    staleTime: 30_000,
  })

  const documents: PolicyDocument[] = data?.success ? (data.data as PolicyDocument[]) : []
  const meta = data?.success ? data.meta : undefined

  const columns: Column<PolicyDocument>[] = [
    { accessor: 'docNumber', header: 'Doc #', render: (_v, d) => <span className="font-mono text-xs font-semibold text-brand-700">{d.docNumber}</span> },
    { accessor: 'title', header: 'Title', render: (_v, d) => (
      <div>
        <p className="font-medium text-slate-800">{d.title}</p>
        {d.description && <p className="text-xs text-slate-400 truncate max-w-[200px]">{d.description}</p>}
      </div>
    )},
    { accessor: 'category', header: 'Category', render: (_v, d) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[d.category]}`}>{d.category}</span>
    )},
    { accessor: 'version', header: 'Ver.', render: (_v, d) => <span className="text-xs text-slate-500">v{d.version}</span> },
    { accessor: 'fileUrl', header: 'Type', render: (_v, d) => (
      d.fileUrl
        ? <span className="flex items-center gap-1 text-xs text-slate-500"><File size={12} /> File</span>
        : <span className="flex items-center gap-1 text-xs text-slate-500"><FileText size={12} /> Text</span>
    )},
    { accessor: 'effectiveDate', header: 'Effective', render: (_v, d) => <span className="text-sm text-slate-600">{formatDate(d.effectiveDate)}</span> },
    { accessor: 'expiryDate', header: 'Expires', render: (_v, d) => {
      if (!d.expiryDate) return <span className="text-slate-300 text-xs">--</span>
      const expired = new Date(d.expiryDate) < new Date()
      return <span className={`text-sm ${expired ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{formatDate(d.expiryDate)}</span>
    }},
    { accessor: 'isActive', header: 'Active', render: (_v, d) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {d.isActive ? 'Yes' : 'No'}
      </span>
    )},
    { accessor: 'id', header: '', render: (_v, d) => (
      <div className="flex items-center gap-1">
        <button onClick={() => navigate(`/documents/${d.id}`)} className="btn-icon" title="View document">
          <Eye size={15} />
        </button>
        {d.fileUrl && (
          <a href={documentsApi.downloadUrl(d.id)} download className="btn-icon text-brand-600 hover:bg-brand-50" title="Download file">
            <Download size={15} />
          </a>
        )}
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Documents"
        subtitle="School policies, guidelines, procedures, and official documents"
        action={
          <button onClick={() => navigate('/documents/new')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Document
          </button>
        }
      />

      <div className="card-md flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9 w-full" placeholder="Search title, doc number..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="select w-44" value={category} onChange={(e) => { setCategory(e.target.value as DocumentCategory | ''); setPage(1) }}>
          <option value="">All Categories</option>
          {(['POLICY', 'GUIDELINE', 'PROCEDURE', 'REGULATION', 'CONTRACT', 'REPORT', 'OTHER'] as DocumentCategory[]).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" className="rounded" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={documents}
          isLoading={isLoading}
          emptyMessage="No documents yet. Upload school policies, guidelines, and official documents."
          rowKey={(_r, i) => i}
        />
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
