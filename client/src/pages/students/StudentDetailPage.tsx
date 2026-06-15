import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { studentsApi } from '../../lib/api'
import { DataTable, FormField } from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { FeeReceipt, StudentStatus } from '../../types'
import { useAuthStore } from '../../store/auth.store'

const STATUS_COLORS: Record<StudentStatus, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-800 border border-emerald-200',
  INACTIVE:  'bg-slate-100 text-slate-600 border border-slate-200',
  GRADUATED: 'bg-brand-100 text-brand-700 border border-brand-200',
  WITHDRAWN: 'bg-red-100 text-red-700 border border-red-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const GRADES = ['Creche', 'Nursery 1', 'Nursery 2', 'Kindergarten 1', 'Kindergarten 2']

interface FormValues {
  firstName: string; lastName: string; grade: string; section: string
  dateOfBirth: string; enrollmentDate: string; status: StudentStatus
  parentName: string; parentPhone: string; parentEmail: string; parentAddress: string; notes: string
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE_MANAGER'
  const [editing, setEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!),
    enabled: !!id,
  })

  const student = data?.success ? data.data : null

  const { register, handleSubmit, reset } = useForm<FormValues>()

  const mutation = useMutation({
    mutationFn: (values: FormValues) => studentsApi.update(id!, {
      ...values,
      section: values.section || undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      parentEmail: values.parentEmail || undefined,
      notes: values.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', id] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student-stats'] })
      setEditing(false)
    },
  })

  function startEdit() {
    if (!student) return
    reset({
      firstName: student.firstName,
      lastName: student.lastName,
      grade: student.grade,
      section: student.section ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      enrollmentDate: student.enrollmentDate.slice(0, 10),
      status: student.status,
      parentName: student.parentName ?? '',
      parentPhone: student.parentPhone ?? '',
      parentEmail: student.parentEmail ?? '',
      parentAddress: student.parentAddress ?? '',
      notes: student.notes ?? '',
    })
    setEditing(true)
  }

  const receiptColumns: Column<FeeReceipt>[] = [
    { accessor: 'receiptNumber', header: 'Receipt #', render: (_v, r) => <span className="font-mono text-xs text-brand-700">{r.receiptNumber}</span> },
    { accessor: 'category', header: 'Category', render: (_v, r) => r.category?.name ?? '—' },
    { accessor: 'amountBase', header: 'Amount', render: (_v, r) => formatCurrency(r.amountBase, '₵', 'GHS') },
    { accessor: 'paymentDate', header: 'Date', render: (_v, r) => formatDate(r.paymentDate) },
    { accessor: 'status', header: 'Status', render: (_v, r) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
        r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
        'bg-amber-100 text-amber-800'
      }`}>{r.status}</span>
    )},
  ]

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
  if (!student) return <div className="text-center text-slate-500 py-16">Student not found.</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/students')} className="btn-icon">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{student.firstName} {student.lastName}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[student.status]}`}>{student.status}</span>
            </div>
            <p className="page-subtitle font-mono">{student.studentId} · {student.grade}{student.section ? ` (${student.section})` : ''}</p>
          </div>
        </div>
        {!editing && canEdit && (
          <button onClick={startEdit} className="btn-secondary flex items-center gap-2">
            <Edit2 size={15} /> Edit
          </button>
        )}
      </div>

      {/* Info / Edit form */}
      <div className="card-md">
        {editing ? (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b pb-2">Student Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First Name" required><input className="input" {...register('firstName')} /></FormField>
              <FormField label="Last Name" required><input className="input" {...register('lastName')} /></FormField>
              <FormField label="Grade" required>
                <select className="select" {...register('grade')}>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </FormField>
              <FormField label="Section"><input className="input" {...register('section')} /></FormField>
              <FormField label="Date of Birth"><input type="date" className="input" {...register('dateOfBirth')} /></FormField>
              <FormField label="Enrollment Date"><input type="date" className="input" {...register('enrollmentDate')} /></FormField>
              <FormField label="Status">
                <select className="select" {...register('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </FormField>
            </div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b pb-2 pt-2">Parent / Guardian</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name"><input className="input" {...register('parentName')} /></FormField>
              <FormField label="Phone"><input className="input" {...register('parentPhone')} /></FormField>
              <FormField label="Email"><input type="email" className="input" {...register('parentEmail')} /></FormField>
              <FormField label="Address"><input className="input" {...register('parentAddress')} /></FormField>
            </div>
            <FormField label="Notes"><textarea className="input min-h-[70px]" {...register('notes')} /></FormField>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5"><X size={14} /> Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={mutation.isPending}>
                <Save size={14} /> {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b pb-2">Student Information</h2>
            <div className="grid gap-y-3 gap-x-8 sm:grid-cols-2">
              {([
                ['Student ID', <span key="id" className="font-mono text-brand-700">{student.studentId}</span>],
                ['Grade', `${student.grade}${student.section ? ` (${student.section})` : ''}`],
                ['Date of Birth', student.dateOfBirth ? formatDate(student.dateOfBirth) : '—'],
                ['Enrolled', formatDate(student.enrollmentDate)],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b pb-2 pt-2">Parent / Guardian</h2>
            <div className="grid gap-y-3 gap-x-8 sm:grid-cols-2">
              {[
                ['Name', student.parentName ?? '—'],
                ['Phone', student.parentPhone ?? '—'],
                ['Email', student.parentEmail ?? '—'],
                ['Address', student.parentAddress ?? '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {student.notes && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{student.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fee Receipt History */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Fee Receipt History</h2>
        <div className="card overflow-hidden">
          <DataTable
            columns={receiptColumns}
            data={student.feeReceipts ?? []}
            emptyMessage="No fee receipts linked to this student yet."
            rowKey={(_r, i) => i}
          />
        </div>
      </div>
    </div>
  )
}
