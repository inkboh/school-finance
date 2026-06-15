import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Edit2, Save, X, FileText, File } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { documentsApi } from '../../lib/api'
import { FormField } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { DocumentCategory, PolicyDocument } from '../../types'

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  POLICY:     'bg-brand-100 text-brand-700 border border-brand-200',
  GUIDELINE:  'bg-blue-100 text-blue-700 border border-blue-200',
  PROCEDURE:  'bg-indigo-100 text-indigo-700 border border-indigo-200',
  REGULATION: 'bg-purple-100 text-purple-700 border border-purple-200',
  CONTRACT:   'bg-orange-100 text-orange-700 border border-orange-200',
  REPORT:     'bg-teal-100 text-teal-700 border border-teal-200',
  OTHER:      'bg-slate-100 text-slate-600 border border-slate-200',
}

interface EditValues {
  title: string; category: DocumentCategory; description: string
  version: string; issuedDate: string; effectiveDate: string; expiryDate: string
  notes: string; isActive: boolean
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
  })

  const doc = data?.success ? (data.data as PolicyDocument) : null

  const { register, handleSubmit, reset } = useForm<EditValues>()

  const mutation = useMutation({
    mutationFn: (values: EditValues) => documentsApi.update(id!, {
      ...values,
      description: values.description || undefined,
      expiryDate: values.expiryDate || undefined,
      notes: values.notes || undefined,
      issuedDate: values.issuedDate,
      effectiveDate: values.effectiveDate,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] })
      qc.invalidateQueries({ queryKey: ['documents'] })
      setEditing(false)
    },
  })

  function startEdit() {
    if (!doc) return
    reset({
      title: doc.title,
      category: doc.category,
      description: doc.description ?? '',
      version: doc.version,
      issuedDate: doc.issuedDate.slice(0, 10),
      effectiveDate: doc.effectiveDate.slice(0, 10),
      expiryDate: doc.expiryDate ? doc.expiryDate.slice(0, 10) : '',
      notes: doc.notes ?? '',
      isActive: doc.isActive,
    })
    setEditing(true)
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
  if (!doc) return <div className="text-center text-slate-500 py-16">Document not found.</div>

  const expired = doc.expiryDate && new Date(doc.expiryDate) < new Date()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/documents')} className="btn-icon"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="page-title">{doc.title}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${CATEGORY_COLORS[doc.category]}`}>{doc.category}</span>
              {!doc.isActive && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>}
              {expired && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Expired</span>}
            </div>
            <p className="page-subtitle font-mono">{doc.docNumber} · v{doc.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {doc.fileUrl && (
            <a href={documentsApi.downloadUrl(doc.id)} download className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Download
            </a>
          )}
          {!editing && (
            <button onClick={startEdit} className="btn-secondary flex items-center gap-2 text-sm">
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="card-md">
        {editing ? (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Title" required><input className="input" {...register('title')} /></FormField>
              </div>
              <FormField label="Category" required>
                <select className="select" {...register('category')}>
                  {(['POLICY','GUIDELINE','PROCEDURE','REGULATION','CONTRACT','REPORT','OTHER'] as DocumentCategory[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Version"><input className="input" {...register('version')} /></FormField>
            </div>
            <FormField label="Description"><textarea className="input min-h-[60px]" {...register('description')} /></FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Issued"><input type="date" className="input" {...register('issuedDate')} /></FormField>
              <FormField label="Effective"><input type="date" className="input" {...register('effectiveDate')} /></FormField>
              <FormField label="Expires"><input type="date" className="input" {...register('expiryDate')} /></FormField>
            </div>
            <FormField label="Notes"><textarea className="input min-h-[60px]" {...register('notes')} /></FormField>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('isActive')} />
              Active document
            </label>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5"><X size={14} /> Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={mutation.isPending}>
                <Save size={14} /> {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-y-3 gap-x-8 sm:grid-cols-2">
            {[
              ['Issued Date', formatDate(doc.issuedDate)],
              ['Effective Date', formatDate(doc.effectiveDate)],
              ['Expiry Date', doc.expiryDate ? formatDate(doc.expiryDate) : '—'],
              ['Created By', doc.createdBy?.name ?? '—'],
              ['Added', formatDate(doc.createdAt)],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</p>
                <p className="text-sm text-slate-800 mt-0.5">{v}</p>
              </div>
            ))}
            {doc.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Description</p>
                <p className="text-sm text-slate-700 mt-0.5">{doc.description}</p>
              </div>
            )}
            {doc.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{doc.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* File attachment */}
      {doc.fileUrl && (
        <div className="card-md">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Attached File</p>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <File size={24} className="text-brand-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{doc.fileName ?? 'document'}</p>
              {doc.fileSize && <p className="text-xs text-slate-400">{(doc.fileSize / 1024).toFixed(1)} KB</p>}
            </div>
            <a href={documentsApi.downloadUrl(doc.id)} download className="btn-secondary flex items-center gap-1.5 text-xs shrink-0">
              <Download size={13} /> Download
            </a>
          </div>
        </div>
      )}

      {/* Text content */}
      {doc.content && (
        <div className="card-md">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-slate-400" />
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Document Content</p>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{doc.content}</pre>
        </div>
      )}
    </div>
  )
}
