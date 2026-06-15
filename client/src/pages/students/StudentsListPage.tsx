import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Search } from 'lucide-react'
import { studentsApi } from '../../lib/api'
import { PageHeader, DataTable, Pagination } from '../../components/shared'
import type { Column } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { Student, StudentStatus } from '../../types'
import { useAuthStore } from '../../store/auth.store'

const STATUS_COLORS: Record<StudentStatus, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-800 border border-emerald-200',
  INACTIVE:  'bg-slate-100 text-slate-600 border border-slate-200',
  GRADUATED: 'bg-brand-100 text-brand-700 border border-brand-200',
  WITHDRAWN: 'bg-red-100 text-red-700 border border-red-200',
  SUSPENDED: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const GRADES = ['Creche', 'Nursery 1', 'Nursery 2', 'Kindergarten 1', 'Kindergarten 2']

export default function StudentsListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canEditGrade = user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE_MANAGER'
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState<StudentStatus | ''>('')

  const { data: statsData } = useQuery({
    queryKey: ['student-stats'],
    queryFn: () => studentsApi.stats(),
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search, grade, status],
    queryFn: () => studentsApi.list({ page, limit: 25, search: search || undefined, grade: grade || undefined, status: status || undefined }),
    staleTime: 30_000,
  })

  const stats = statsData?.success ? statsData.data : null
  const students: Student[] = data?.success ? (data.data as Student[]) : []
  const meta = data?.success ? data.meta : undefined

  const gradeMutation = useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: string }) =>
      studentsApi.update(id, { grade }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['student-stats'] })
    },
  })

  const columns: Column<Student>[] = [
    { accessor: 'studentId', header: 'Student ID', render: (_v, s) => <span className="font-mono text-xs font-semibold text-brand-700">{s.studentId}</span> },
    { accessor: 'lastName', header: 'Name', render: (_v, s) => <span className="font-medium text-slate-800">{s.lastName}, {s.firstName}</span> },
    { accessor: 'grade', header: 'Grade', render: (_v, s) => canEditGrade ? (
      <select
        className="select select-sm py-0.5 text-sm"
        value={s.grade}
        onChange={(e) => gradeMutation.mutate({ id: s.id, grade: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="Unknown">— unassigned —</option>
        {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
    ) : (
      <span className="text-slate-600">{s.grade}{s.section ? ` (${s.section})` : ''}</span>
    )},
    { accessor: 'status', header: 'Status', render: (_v, s) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
    )},
    { accessor: 'parentName', header: 'Parent / Guardian', render: (_v, s) => (
      <div>
        <p className="text-slate-700 text-sm">{s.parentName ?? '--'}</p>
        {s.parentPhone && <p className="text-xs text-slate-400">{s.parentPhone}</p>}
      </div>
    )},
    { accessor: 'enrollmentDate', header: 'Enrolled', render: (_v, s) => <span className="text-slate-500 text-sm">{formatDate(s.enrollmentDate)}</span> },
    { accessor: 'id', header: '', render: (_v, s) => (
      <button onClick={() => navigate(`/students/${s.id}`)} className="btn-icon" title="View student">
        <Eye size={15} />
      </button>
    )},
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle="Manage student records and fee associations"
        action={
          <button onClick={() => navigate('/students/new')} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Student
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-800' },
            { label: 'Active', value: stats.active, color: 'text-emerald-700' },
            { label: 'Graduated', value: stats.graduated, color: 'text-brand-700' },
            { label: 'Withdrawn', value: stats.withdrawn, color: 'text-red-600' },
          ].map((s) => (
            <div key={s.label} className="card-md text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card-md">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Search name, ID, parent..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <select className="select w-40" value={grade} onChange={(e) => { setGrade(e.target.value); setPage(1) }}>
            <option value="">All Grades</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="select w-36" value={status} onChange={(e) => { setStatus(e.target.value as StudentStatus | ''); setPage(1) }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="GRADUATED">Graduated</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={students}
          isLoading={isLoading}
          emptyMessage="No students found. Add the first student to get started."
          rowKey={(_r, i) => i}
        />
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
