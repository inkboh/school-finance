import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Info } from 'lucide-react'
import { loansApi, settingsApi } from '../../lib/api'
import { PageHeader, FormField } from '../../components/shared'
import type { Currency } from '../../types'

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z.object({
  loanType: z.enum(['BORROWED', 'LENT'], {
    required_error: 'Please select a loan type.',
  }),
  partyName: z.string().min(1, 'Party name is required.').max(100),
  partyContact: z.string().max(100).optional(),
  purpose: z.string().max(200).optional(),
  principal: z
    .string()
    .min(1, 'Principal amount is required.')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: 'Must be a positive number.',
    }),
  currencyId: z.string().min(1, 'Please select a currency.'),
  interestRate: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
      { message: 'Must be between 0 and 100.' }
    ),
  loanDate: z.string().min(1, 'Loan date is required.'),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Input class helper ───────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 disabled:bg-slate-50 disabled:text-slate-400'

const errorInputClass =
  'w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300'

function inputCls(hasError: boolean) {
  return hasError ? errorInputClass : inputClass
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewLoanPage() {
  const navigate = useNavigate()

  // Load currencies for selector
  const { data: currenciesRes } = useQuery({
    queryKey: ['settings', 'currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
  })
  const currencies: Currency[] =
    currenciesRes?.success ? (currenciesRes.data as Currency[]) : []

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      loanDate: new Date().toISOString().split('T')[0],
    },
  })

  const watchedInterestRate = watch('interestRate')
  const isInterestFree = !watchedInterestRate || watchedInterestRate.trim() === ''

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      loansApi.create({
        loanType: values.loanType,
        partyName: values.partyName,
        partyContact: values.partyContact || undefined,
        purpose: values.purpose || undefined,
        principal: Number(values.principal),
        currencyId: values.currencyId,
        interestRate: values.interestRate ? Number(values.interestRate) : undefined,
        loanDate: values.loanDate,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        navigate(`/loans/${res.data.id}`)
      }
    },
  })

  const onSubmit = (values: FormValues) => mutation.mutate(values)

  const serverError =
    mutation.isError
      ? 'An unexpected error occurred. Please try again.'
      : !mutation.data?.success && mutation.data?.error
        ? mutation.data.error
        : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Loan"
        subtitle="Record a loan the school borrowed or lent."
        action={
          <button
            type="button"
            onClick={() => navigate('/loans')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={15} />
            Back to Loans
          </button>
        }
      />

      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Loan type explainer banner */}
          <div className="flex items-start gap-3 rounded-t-xl border-b border-slate-100 bg-brand-50 px-6 py-4">
            <Info size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-sm text-brand-700">
              <span className="font-semibold">BORROWED</span> — We owe this money to the party.&nbsp;&nbsp;
              <span className="font-semibold">LENT</span> — This party owes us money.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
            {/* Server error */}
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Loan Type */}
            <FormField
              label="Loan Type"
              required
              htmlFor="loanType"
              error={errors.loanType?.message}
            >
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      value: 'BORROWED',
                      label: 'BORROWED',
                      sub: 'We owe this money',
                      color: 'red',
                    },
                    {
                      value: 'LENT',
                      label: 'LENT',
                      sub: 'Party owes us money',
                      color: 'emerald',
                    },
                  ] as const
                ).map((opt) => {
                  const id = `loanType-${opt.value}`
                  return (
                    <label
                      key={opt.value}
                      htmlFor={id}
                      className="relative flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-slate-200 p-4 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                    >
                      <input
                        id={id}
                        type="radio"
                        value={opt.value}
                        {...register('loanType')}
                        className="sr-only"
                      />
                      <span
                        className={`text-sm font-semibold ${
                          opt.color === 'red' ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-xs text-slate-500">{opt.sub}</span>
                    </label>
                  )
                })}
              </div>
              {errors.loanType && (
                <p className="mt-1 text-xs text-red-600">{errors.loanType.message}</p>
              )}
            </FormField>

            {/* Party Name */}
            <FormField
              label="Party Name"
              required
              htmlFor="partyName"
              error={errors.partyName?.message}
            >
              <input
                id="partyName"
                type="text"
                placeholder="e.g. Community Bank, Mr. John Doe"
                {...register('partyName')}
                className={inputCls(!!errors.partyName)}
              />
            </FormField>

            {/* Party Contact */}
            <FormField
              label="Party Contact"
              htmlFor="partyContact"
              error={errors.partyContact?.message}
              hint="Phone number, email, or any contact detail."
            >
              <input
                id="partyContact"
                type="text"
                placeholder="e.g. +1 555 000 1234"
                {...register('partyContact')}
                className={inputCls(!!errors.partyContact)}
              />
            </FormField>

            {/* Purpose */}
            <FormField
              label="Purpose"
              htmlFor="purpose"
              error={errors.purpose?.message}
            >
              <input
                id="purpose"
                type="text"
                placeholder="e.g. Infrastructure development"
                {...register('purpose')}
                className={inputCls(!!errors.purpose)}
              />
            </FormField>

            {/* Principal + Currency (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Principal Amount"
                required
                htmlFor="principal"
                error={errors.principal?.message}
              >
                <input
                  id="principal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register('principal')}
                  className={inputCls(!!errors.principal)}
                />
              </FormField>

              <FormField
                label="Currency"
                required
                htmlFor="currencyId"
                error={errors.currencyId?.message}
              >
                <select
                  id="currencyId"
                  {...register('currencyId')}
                  className={inputCls(!!errors.currencyId)}
                >
                  <option value="">Select currency…</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Interest Rate */}
            <FormField
              label="Interest Rate (%)"
              htmlFor="interestRate"
              error={errors.interestRate?.message}
              hint={
                isInterestFree
                  ? 'Leave blank for interest-free loan.'
                  : undefined
              }
            >
              <div className="relative">
                <input
                  id="interestRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 5.50"
                  {...register('interestRate')}
                  className={inputCls(!!errors.interestRate)}
                />
                {isInterestFree && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    Interest-free
                  </span>
                )}
              </div>
            </FormField>

            {/* Loan Date + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Loan Date"
                required
                htmlFor="loanDate"
                error={errors.loanDate?.message}
              >
                <input
                  id="loanDate"
                  type="date"
                  {...register('loanDate')}
                  className={inputCls(!!errors.loanDate)}
                />
              </FormField>

              <FormField
                label="Due Date"
                htmlFor="dueDate"
                error={errors.dueDate?.message}
                hint="Leave blank if open-ended."
              >
                <input
                  id="dueDate"
                  type="date"
                  {...register('dueDate')}
                  className={inputCls(!!errors.dueDate)}
                />
              </FormField>
            </div>

            {/* Notes */}
            <FormField
              label="Notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <textarea
                id="notes"
                rows={3}
                placeholder="Any additional details about this loan…"
                {...register('notes')}
                className={inputCls(!!errors.notes)}
              />
            </FormField>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => navigate('/loans')}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || mutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {mutation.isPending ? 'Saving…' : 'Create Loan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
