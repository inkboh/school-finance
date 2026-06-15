import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Info } from 'lucide-react'
import { studentsApi } from '../../lib/api'
import { FormField } from '../../components/shared'

const schema = z.object({
  firstName:     z.string().min(1, 'First name is required'),
  lastName:      z.string().min(1, 'Last name is required'),
  grade:         z.string().min(1, 'Grade is required'),
  section:       z.string().optional(),
  dateOfBirth:   z.string().optional(),
  enrollmentDate: z.string().optional(),
  parentName:    z.string().optional(),
  parentPhone:   z.string().optional(),
  parentEmail:   z.string().email('Invalid email').optional().or(z.literal('')),
  parentAddress: z.string().optional(),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const GRADES = ['Crèche', 'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']

export default function NewStudentPage() {
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { enrollmentDate: new Date().toISOString().slice(0, 10) },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => studentsApi.create({
      ...values,
      parentEmail: values.parentEmail || undefined,
    }),
    onSuccess: (data) => {
      if (data.success) navigate(`/students/${data.data.id}`)
    },
  })

  const onSubmit = (values: FormValues) => mutation.mutate(values)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/students')} className="btn-icon">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">Add Student</h1>
          <p className="page-subtitle">Student ID will be auto-generated (RA-YYYY-NNNN)</p>
        </div>
      </div>

      <div className="card-md flex items-start gap-3 bg-brand-50/60 border border-brand-200">
        <Info size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <p className="text-sm text-brand-800">
          A unique student ID in the format <strong>RA-{new Date().getFullYear()}-NNNN</strong> will be generated automatically when you save.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card-md space-y-5">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Student Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First Name" required error={errors.firstName?.message}>
            <input className="input" {...register('firstName')} placeholder="Kwame" />
          </FormField>
          <FormField label="Last Name" required error={errors.lastName?.message}>
            <input className="input" {...register('lastName')} placeholder="Asante" />
          </FormField>
          <FormField label="Grade" required error={errors.grade?.message}>
            <select className="select" {...register('grade')}>
              <option value="">Select grade…</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </FormField>
          <FormField label="Section / Class" error={errors.section?.message}>
            <input className="input" {...register('section')} placeholder="e.g. A, B" />
          </FormField>
          <FormField label="Date of Birth" error={errors.dateOfBirth?.message}>
            <input type="date" className="input" {...register('dateOfBirth')} />
          </FormField>
          <FormField label="Enrollment Date" error={errors.enrollmentDate?.message}>
            <input type="date" className="input" {...register('enrollmentDate')} />
          </FormField>
        </div>

        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 pt-2">Parent / Guardian</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" error={errors.parentName?.message}>
            <input className="input" {...register('parentName')} placeholder="Mrs. Ama Asante" />
          </FormField>
          <FormField label="Phone" error={errors.parentPhone?.message}>
            <input className="input" {...register('parentPhone')} placeholder="+233 20 000 0000" />
          </FormField>
          <FormField label="Email" error={errors.parentEmail?.message}>
            <input type="email" className="input" {...register('parentEmail')} placeholder="parent@example.com" />
          </FormField>
          <FormField label="Address" error={errors.parentAddress?.message}>
            <input className="input" {...register('parentAddress')} placeholder="Kumasi, Ghana" />
          </FormField>
        </div>

        <FormField label="Notes" error={errors.notes?.message}>
          <textarea className="input min-h-[80px]" {...register('notes')} placeholder="Any additional notes…" />
        </FormField>

        {mutation.error && (
          <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/students')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Student'}
          </button>
        </div>
      </form>
    </div>
  )
}
