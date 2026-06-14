import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Info } from 'lucide-react'
import { feesApi, settingsApi } from '../../lib/api'
import { FormField } from '../../components/shared'

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z
  .object({
    studentName: z.string().min(1, 'Student name is required'),
    studentId: z.string().optional(),
    grade: z.string().optional(),
    categoryId: z.string().min(1, 'Fee category is required'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Must be a positive number'),
    currencyId: z.string().min(1, 'Currency is required'),
    exchangeRate: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === '' || (!isNaN(Number(v)) && Number(v) > 0),
        'Exchange rate must be a positive number'
      ),
    paymentDate: z.string().min(1, 'Payment date is required'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY', 'CARD', 'OTHER'], {
      required_error: 'Payment method is required',
    }),
    reference: z.string().optional(),
    notes: z.string().optional(),
  })

type FormValues = z.infer<typeof schema>

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Card',
  OTHER: 'Other',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewFeeReceiptPage() {
  const navigate = useNavigate()

  // ── Data: currencies & fee categories ─────────────────────────────────────
  const { data: currenciesResponse } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: categoriesResponse } = useQuery({
    queryKey: ['feeCategories'],
    queryFn: () => settingsApi.feeCategories({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const currencies = currenciesResponse?.success ? currenciesResponse.data : []
  const categories = categoriesResponse?.success ? categoriesResponse.data : []

  const baseCurrency = useMemo(
    () => currencies.find((c) => c.isBaseCurrency),
    [currencies]
  )

  // ── Form ───────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentName: '',
      studentId: '',
      grade: '',
      categoryId: '',
      amount: '',
      currencyId: '',
      exchangeRate: '1',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      reference: '',
      notes: '',
    },
  })

  const watchedCurrencyId = watch('currencyId')
  const watchedAmount = watch('amount')
  const watchedExchangeRate = watch('exchangeRate')

  // Determine selected currency object
  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.id === watchedCurrencyId),
    [currencies, watchedCurrencyId]
  )

  const isBaseCurrencySelected = selectedCurrency?.isBaseCurrency ?? false

  // Auto-set exchange rate to 1 when base currency is chosen
  useEffect(() => {
    if (isBaseCurrencySelected) {
      setValue('exchangeRate', '1')
    }
  }, [isBaseCurrencySelected, setValue])

  // Computed preview
  const amountNum = parseFloat(watchedAmount ?? '0') || 0
  const rateNum = parseFloat(watchedExchangeRate ?? '1') || 1
  const amountBase = amountNum * rateNum

  // ── Submit ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      feesApi.create({
        studentName: data.studentName,
        studentId: data.studentId || undefined,
        grade: data.grade || undefined,
        categoryId: data.categoryId,
        amount: parseFloat(data.amount),
        currencyId: data.currencyId,
        exchangeRate: parseFloat(data.exchangeRate || '1'),
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        reference: data.reference || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        navigate('/fees')
      }
    },
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400'

  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + heading */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <h1 className="text-xl font-semibold text-slate-900">New Fee Receipt</h1>
      </div>

      {/* Separation-of-duties notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          This receipt will be submitted for approval. You cannot approve your own entries.
        </span>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Student Name */}
          <div className="sm:col-span-2">
            <FormField
              label="Student Name"
              required
              htmlFor="studentName"
              error={errors.studentName?.message}
            >
              <input
                id="studentName"
                type="text"
                placeholder="Full name of student"
                className={inputClass}
                {...register('studentName')}
              />
            </FormField>
          </div>

          {/* Student ID */}
          <FormField
            label="Student ID"
            htmlFor="studentId"
            error={errors.studentId?.message}
          >
            <input
              id="studentId"
              type="text"
              placeholder="Optional"
              className={inputClass}
              {...register('studentId')}
            />
          </FormField>

          {/* Grade */}
          <FormField
            label="Grade / Class"
            htmlFor="grade"
            error={errors.grade?.message}
          >
            <input
              id="grade"
              type="text"
              placeholder="e.g. Grade 5, Form 2"
              className={inputClass}
              {...register('grade')}
            />
          </FormField>

          {/* Fee Category */}
          <FormField
            label="Fee Category"
            required
            htmlFor="categoryId"
            error={errors.categoryId?.message}
          >
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <select id="categoryId" className={selectClass} {...field}>
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* Payment Method */}
          <FormField
            label="Payment Method"
            required
            htmlFor="paymentMethod"
            error={errors.paymentMethod?.message}
          >
            <Controller
              name="paymentMethod"
              control={control}
              render={({ field }) => (
                <select id="paymentMethod" className={selectClass} {...field}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* Currency */}
          <FormField
            label="Currency"
            required
            htmlFor="currencyId"
            error={errors.currencyId?.message}
          >
            <Controller
              name="currencyId"
              control={control}
              render={({ field }) => (
                <select id="currencyId" className={selectClass} {...field}>
                  <option value="">Select currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                      {c.isBaseCurrency ? ' (Base)' : ''}
                    </option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* Amount */}
          <FormField
            label="Amount"
            required
            htmlFor="amount"
            error={errors.amount?.message}
          >
            <div className="relative">
              {selectedCurrency && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  {selectedCurrency.symbol}
                </span>
              )}
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={[inputClass, selectedCurrency ? 'pl-7' : ''].join(' ')}
                {...register('amount')}
              />
            </div>
          </FormField>

          {/* Exchange Rate (hidden when base currency) */}
          {!isBaseCurrencySelected && watchedCurrencyId && (
            <FormField
              label="Exchange Rate"
              htmlFor="exchangeRate"
              error={errors.exchangeRate?.message}
              hint={
                baseCurrency
                  ? `Amount × Rate = equivalent in ${baseCurrency.code}`
                  : 'Amount × Rate = base currency equivalent'
              }
            >
              <input
                id="exchangeRate"
                type="number"
                min="0"
                step="0.000001"
                placeholder="1.000000"
                className={inputClass}
                {...register('exchangeRate')}
              />
            </FormField>
          )}

          {/* Amount in base currency preview */}
          {watchedCurrencyId && amountNum > 0 && (
            <div
              className={[
                'flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3',
                isBaseCurrencySelected ? 'sm:col-span-2' : '',
              ].join(' ')}
            >
              <span className="text-sm text-indigo-600">
                Amount in {baseCurrency?.code ?? 'base currency'}:
              </span>
              <span className="font-semibold text-indigo-900">
                {baseCurrency?.symbol ?? ''}{' '}
                {amountBase.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {baseCurrency?.code ?? ''}
              </span>
            </div>
          )}

          {/* Payment Date */}
          <FormField
            label="Payment Date"
            required
            htmlFor="paymentDate"
            error={errors.paymentDate?.message}
          >
            <input
              id="paymentDate"
              type="date"
              className={inputClass}
              {...register('paymentDate')}
            />
          </FormField>

          {/* Reference */}
          <FormField
            label="Reference"
            htmlFor="reference"
            error={errors.reference?.message}
            hint="Cheque number, transfer reference, etc."
          >
            <input
              id="reference"
              type="text"
              placeholder="Optional"
              className={inputClass}
              {...register('reference')}
            />
          </FormField>

          {/* Notes */}
          <div className="sm:col-span-2">
            <FormField
              label="Notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <textarea
                id="notes"
                rows={3}
                placeholder="Any additional notes..."
                className={inputClass}
                {...register('notes')}
              />
            </FormField>
          </div>
        </div>

        {/* Server error */}
        {createMutation.isError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to create receipt. Please check your inputs and try again.
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
