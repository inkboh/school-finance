import React, { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { expensesApi, settingsApi } from '../../lib/api'
import { PageHeader, FormField } from '../../components/shared'
import type { ExpenseCategory, PaymentMethod } from '../../types'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required').max(500),
  vendor: z.string().max(200).optional(),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  currencyId: z.string().min(1, 'Currency is required'),
  exchangeRate: z
    .number({ invalid_type_error: 'Exchange rate must be a number' })
    .positive('Exchange rate must be greater than 0')
    .optional(),
  expenseDate: z.string().min(1, 'Expense date is required'),
  paymentMethod: z.enum(
    ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY', 'CARD', 'OTHER'],
    { required_error: 'Payment method is required' },
  ),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Payment method options ────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a flat list of category options with hierarchical labels.
 * Parents appear first, then their children indented.
 */
function buildCategoryOptions(
  categories: ExpenseCategory[],
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []

  const parents = categories.filter((c) => !c.parentId)
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId)

  for (const parent of parents) {
    options.push({ value: parent.id, label: parent.name })
    for (const child of childrenOf(parent.id)) {
      options.push({ value: child.id, label: `${parent.name} › ${child.name}` })
    }
  }

  // Catch any orphaned children not covered above
  for (const cat of categories) {
    if (cat.parentId && !parents.some((p) => p.id === cat.parentId)) {
      options.push({ value: cat.id, label: cat.name })
    }
  }

  return options
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function NewExpensePage() {
  const navigate = useNavigate()

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => settingsApi.expenseCategories({ isActive: true }),
    staleTime: 5 * 60 * 1000,
  })

  const currencies = currenciesData?.success ? currenciesData.data : []
  const categories = categoriesData?.success ? categoriesData.data : []

  const baseCurrency = currencies.find((c) => c.isBaseCurrency)

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  )

  // ── Form ─────────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
    },
  })

  const selectedCurrencyId = watch('currencyId')
  const amount = watch('amount')
  const exchangeRate = watch('exchangeRate')

  const selectedCurrency = currencies.find((c) => c.id === selectedCurrencyId)
  const isNonBase =
    selectedCurrency && baseCurrency
      ? selectedCurrency.id !== baseCurrency.id
      : false

  const amountInBase = useMemo(() => {
    if (!amount || isNaN(amount)) return null
    if (!isNonBase) return amount
    if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) return null
    return amount * exchangeRate
  }, [amount, exchangeRate, isNonBase])

  // ── Mutation ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      expensesApi.create({
        ...values,
        vendor: values.vendor || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
        exchangeRate: isNonBase ? values.exchangeRate : 1,
      }),
    onSuccess: () => navigate('/expenses'),
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values)
  }

  // ── Input class ───────────────────────────────────────────────────────────────
  const inputClass = (hasError: boolean) =>
    [
      'w-full rounded-lg border px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2',
      hasError
        ? 'border-red-400 focus:border-red-400 focus:ring-red-300'
        : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-300',
    ].join(' ')

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Expense"
        subtitle="Record a new school expenditure"
        action={
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={15} />
            Back to Expenses
          </button>
        }
      />

      {/* Separation of duties notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          Expenses require approval from a different staff member. You will not
          be able to approve an expense you have created.
        </span>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* Category */}
          <div className="sm:col-span-2">
            <FormField
              label="Category"
              required
              error={errors.categoryId?.message}
              htmlFor="categoryId"
            >
              <select
                id="categoryId"
                {...register('categoryId')}
                className={inputClass(!!errors.categoryId)}
              >
                <option value="">Select a category…</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <FormField
              label="Description"
              required
              error={errors.description?.message}
              htmlFor="description"
            >
              <textarea
                id="description"
                {...register('description')}
                rows={2}
                placeholder="What was this expense for?"
                className={inputClass(!!errors.description)}
              />
            </FormField>
          </div>

          {/* Vendor */}
          <FormField
            label="Vendor"
            error={errors.vendor?.message}
            htmlFor="vendor"
          >
            <input
              id="vendor"
              type="text"
              {...register('vendor')}
              placeholder="Supplier or vendor name"
              className={inputClass(!!errors.vendor)}
            />
          </FormField>

          {/* Expense Date */}
          <FormField
            label="Expense Date"
            required
            error={errors.expenseDate?.message}
            htmlFor="expenseDate"
          >
            <input
              id="expenseDate"
              type="date"
              {...register('expenseDate')}
              className={inputClass(!!errors.expenseDate)}
            />
          </FormField>

          {/* Currency */}
          <FormField
            label="Currency"
            required
            error={errors.currencyId?.message}
            htmlFor="currencyId"
          >
            <select
              id="currencyId"
              {...register('currencyId')}
              className={inputClass(!!errors.currencyId)}
            >
              <option value="">Select currency…</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                  {c.isBaseCurrency ? ' (base)' : ''}
                </option>
              ))}
            </select>
          </FormField>

          {/* Amount */}
          <FormField
            label="Amount"
            required
            error={errors.amount?.message}
            htmlFor="amount"
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
                step="0.01"
                min="0"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                className={[inputClass(!!errors.amount), selectedCurrency ? 'pl-8' : ''].join(' ')}
              />
            </div>
          </FormField>

          {/* Exchange Rate — conditional on non-base currency */}
          {isNonBase && (
            <FormField
              label={`Exchange Rate (1 ${selectedCurrency?.code} = ? ${baseCurrency?.code})`}
              required
              error={errors.exchangeRate?.message}
              htmlFor="exchangeRate"
              hint={`Convert ${selectedCurrency?.code} to ${baseCurrency?.code ?? 'base currency'}`}
            >
              <input
                id="exchangeRate"
                type="number"
                step="0.000001"
                min="0"
                {...register('exchangeRate', { valueAsNumber: true })}
                placeholder="e.g. 0.037"
                className={inputClass(!!errors.exchangeRate)}
              />
            </FormField>
          )}

          {/* Amount in base currency preview */}
          {amountInBase !== null && baseCurrency && (
            <div
              className={[
                'flex items-center gap-2 rounded-lg border bg-slate-50 px-4 py-3',
                isNonBase ? '' : 'sm:col-span-1',
              ].join(' ')}
            >
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Amount in base currency ({baseCurrency.code})
                </p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">
                  {baseCurrency.symbol}{' '}
                  {amountInBase.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {baseCurrency.code}
                </p>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <FormField
            label="Payment Method"
            required
            error={errors.paymentMethod?.message}
            htmlFor="paymentMethod"
          >
            <select
              id="paymentMethod"
              {...register('paymentMethod')}
              className={inputClass(!!errors.paymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Reference */}
          <FormField
            label="Reference"
            error={errors.reference?.message}
            htmlFor="reference"
            hint="Invoice number, receipt number, etc."
          >
            <input
              id="reference"
              type="text"
              {...register('reference')}
              placeholder="Optional reference"
              className={inputClass(!!errors.reference)}
            />
          </FormField>

          {/* Notes */}
          <div className="sm:col-span-2">
            <FormField
              label="Notes"
              error={errors.notes?.message}
              htmlFor="notes"
            >
              <textarea
                id="notes"
                {...register('notes')}
                rows={3}
                placeholder="Any additional notes or context…"
                className={inputClass(!!errors.notes)}
              />
            </FormField>
          </div>
        </div>

        {/* Error message */}
        {createMutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to create expense. Please check the form and try again.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving…' : 'Submit Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}
