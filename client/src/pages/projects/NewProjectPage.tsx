import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { projectsApi, settingsApi } from '../../lib/api'
import { FormField } from '../../components/shared'

const schema = z.object({
  name:        z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  scope:       z.string().optional(),
  status:      z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('PLANNING'),
  startDate:   z.string().optional(),
  endDate:     z.string().optional(),
  budget:      z.string().min(1, 'Budget is required').refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  currencyId:  z.string().min(1, 'Currency is required'),
  notes:       z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewProjectPage() {
  const navigate = useNavigate()

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60_000,
  })
  const currencies = currenciesRes?.success ? currenciesRes.data : []
  const baseCurrency = currencies.find((c) => c.isBaseCurrency)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'PLANNING', currencyId: baseCurrency?.id ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => projectsApi.create({
      ...values,
      budget: Number(values.budget),
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    }),
    onSuccess: (data) => {
      if (data.success) navigate(`/projects/${data.data.id}`)
    },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/projects')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="page-title">New Project</h1>
          <p className="page-subtitle">Track capital projects, renovations, and major initiatives</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="card-md space-y-5">
        <FormField label="Project Name" required error={errors.name?.message}>
          <input className="input" {...register('name')} placeholder="e.g. New Classroom Block, Library Renovation" />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <textarea className="input min-h-[70px]" {...register('description')} placeholder="Short project description…" />
        </FormField>

        <FormField label="Scope / Deliverables" error={errors.scope?.message}>
          <textarea className="input min-h-[100px]" {...register('scope')} placeholder="Detailed scope of work, deliverables, and objectives…" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Status" error={errors.status?.message}>
            <select className="select" {...register('status')}>
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </FormField>
          <FormField label="Start Date" error={errors.startDate?.message}>
            <input type="date" className="input" {...register('startDate')} />
          </FormField>
          <FormField label="End Date" error={errors.endDate?.message}>
            <input type="date" className="input" {...register('endDate')} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Total Budget" required error={errors.budget?.message}>
            <input type="number" step="0.01" min="0" className="input" {...register('budget')} placeholder="0.00" />
          </FormField>
          <FormField label="Currency" required error={errors.currencyId?.message}>
            <select className="select" {...register('currencyId')}>
              <option value="">Select…</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="Notes" error={errors.notes?.message}>
          <textarea className="input min-h-[70px]" {...register('notes')} />
        </FormField>

        {mutation.error && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={() => navigate('/projects')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
