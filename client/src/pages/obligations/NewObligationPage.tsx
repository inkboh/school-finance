import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { obligationsApi, settingsApi } from '../../lib/api'
import { FormField } from '../../components/shared'

const schema = z.object({
  name:          z.string().min(1, 'Name is required'),
  description:   z.string().optional(),
  category:      z.enum(['INSURANCE', 'TAX', 'PERMIT', 'CONTRACT', 'UTILITY', 'SUBSCRIPTION', 'RENT', 'OTHER']),
  amount:        z.string().min(1, 'Amount is required').refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Must be positive'),
  currencyId:    z.string().min(1, 'Currency is required'),
  frequency:     z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'ANNUALLY', 'ONCE']),
  nextDueDate:   z.string().min(1, 'Next due date is required'),
  vendorName:    z.string().optional(),
  vendorContact: z.string().optional(),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const CATEGORIES = ['INSURANCE', 'TAX', 'PERMIT', 'CONTRACT', 'UTILITY', 'SUBSCRIPTION', 'RENT', 'OTHER']
const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly (every 3 months)' },
  { value: 'BIANNUALLY', label: 'Bi-annually (every 6 months)' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'ONCE', label: 'One-time' },
]

export default function NewObligationPage() {
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
    defaultValues: {
      category: 'TAX',
      frequency: 'ANNUALLY',
      currencyId: baseCurrency?.id ?? '',
      nextDueDate: new Date().toISOString().slice(0, 10),
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => obligationsApi.create({
      ...values,
      amount: Number(values.amount),
    }),
    onSuccess: (data) => {
      if (data.success) navigate('/obligations')
    },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/obligations')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="page-title">Add Recurring Obligation</h1>
          <p className="page-subtitle">Insurance, taxes, permits, subscriptions, and more</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="card-md space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Name" required error={errors.name?.message}>
              <input className="input" {...register('name')} placeholder="e.g. SSNIT Contribution, Fire Service Permit" />
            </FormField>
          </div>
          <FormField label="Category" required error={errors.category?.message}>
            <select className="select" {...register('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Frequency" required error={errors.frequency?.message}>
            <select className="select" {...register('frequency')}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </FormField>
          <FormField label="Amount" required error={errors.amount?.message}>
            <input type="number" step="0.01" min="0" className="input" {...register('amount')} placeholder="0.00" />
          </FormField>
          <FormField label="Currency" required error={errors.currencyId?.message}>
            <select className="select" {...register('currencyId')}>
              <option value="">Select…</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Next Due Date" required error={errors.nextDueDate?.message}>
            <input type="date" className="input" {...register('nextDueDate')} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
          <FormField label="Vendor / Provider" error={errors.vendorName?.message}>
            <input className="input" {...register('vendorName')} placeholder="e.g. GRA, SSNIT, SIC Insurance" />
          </FormField>
          <FormField label="Vendor Contact" error={errors.vendorContact?.message}>
            <input className="input" {...register('vendorContact')} placeholder="Phone or email" />
          </FormField>
        </div>

        <FormField label="Description" error={errors.description?.message}>
          <textarea className="input min-h-[70px]" {...register('description')} placeholder="Brief description…" />
        </FormField>

        <FormField label="Notes" error={errors.notes?.message}>
          <textarea className="input min-h-[70px]" {...register('notes')} placeholder="Internal notes…" />
        </FormField>

        {mutation.error && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={() => navigate('/obligations')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Add Obligation'}
          </button>
        </div>
      </form>
    </div>
  )
}
