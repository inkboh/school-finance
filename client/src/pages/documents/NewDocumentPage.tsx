import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, FileText, Upload, X, File } from 'lucide-react'
import { documentsApi } from '../../lib/api'
import { FormField } from '../../components/shared'

const schema = z.object({
  title:         z.string().min(1, 'Title is required'),
  category:      z.enum(['POLICY', 'GUIDELINE', 'PROCEDURE', 'REGULATION', 'CONTRACT', 'REPORT', 'OTHER']),
  description:   z.string().optional(),
  version:       z.string().default('1.0'),
  issuedDate:    z.string().min(1, 'Issued date is required'),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  expiryDate:    z.string().optional(),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewDocumentPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'POLICY',
      version: '1.0',
      issuedDate: new Date().toISOString().slice(0, 10),
      effectiveDate: new Date().toISOString().slice(0, 10),
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (mode === 'file' && file) {
        const fd = new FormData()
        Object.entries(values).forEach(([k, v]) => { if (v) fd.append(k, String(v)) })
        fd.append('file', file)
        return documentsApi.create(fd)
      }
      return documentsApi.create({
        ...values,
        content: content || undefined,
        expiryDate: values.expiryDate || undefined,
      })
    },
    onSuccess: (data) => {
      if (data.success) navigate(`/documents/${data.data.id}`)
    },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/documents')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="page-title">Add Document</h1>
          <p className="page-subtitle">School policy, guideline, or official document</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        {/* Metadata card */}
        <div className="card-md space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Title" required error={errors.title?.message}>
                <input className="input" {...register('title')} placeholder="e.g. Student Code of Conduct, Procurement Policy" />
              </FormField>
            </div>
            <FormField label="Category" required error={errors.category?.message}>
              <select className="select" {...register('category')}>
                <option value="POLICY">Policy</option>
                <option value="GUIDELINE">Guideline</option>
                <option value="PROCEDURE">Procedure</option>
                <option value="REGULATION">Regulation</option>
                <option value="CONTRACT">Contract</option>
                <option value="REPORT">Report</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
            <FormField label="Version" error={errors.version?.message}>
              <input className="input" {...register('version')} placeholder="1.0" />
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message}>
            <textarea className="input min-h-[70px]" {...register('description')} placeholder="Brief description of this document…" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Issued Date" required error={errors.issuedDate?.message}>
              <input type="date" className="input" {...register('issuedDate')} />
            </FormField>
            <FormField label="Effective Date" required error={errors.effectiveDate?.message}>
              <input type="date" className="input" {...register('effectiveDate')} />
            </FormField>
            <FormField label="Expiry Date" error={errors.expiryDate?.message}>
              <input type="date" className="input" {...register('expiryDate')} />
            </FormField>
          </div>
          <FormField label="Notes" error={errors.notes?.message}>
            <textarea className="input min-h-[60px]" {...register('notes')} />
          </FormField>
        </div>

        {/* Content card */}
        <div className="card-md space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Document Content</p>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 divide-x divide-slate-200">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'text' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <FileText size={15} /> Text Content
              </button>
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'file' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Upload size={15} /> File Upload
              </button>
            </div>
          </div>

          {mode === 'text' ? (
            <textarea
              className="input min-h-[240px] font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type the document content here…"
            />
          ) : (
            <div>
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <File size={24} className="text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="btn-icon shrink-0">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center gap-3 text-slate-500 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
                >
                  <Upload size={28} className="text-slate-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs text-slate-400 mt-0.5">PDF, DOC, DOCX, TXT, PNG, JPG up to 20MB</p>
                  </div>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>

        {mutation.error && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/documents')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Document'}
          </button>
        </div>
      </form>
    </div>
  )
}
