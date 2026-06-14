import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Pencil, X, Info } from 'lucide-react'
import { settingsApi } from '../../lib/api'
import { formatDate } from '../../lib/utils'
import type { Currency, FeeCategory, ExpenseCategory } from '../../types'
import { PageHeader, FormField } from '../../components/shared'

// ─── Shared input/select styles ───────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50 disabled:text-slate-400'

const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200'

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        checked ? 'bg-indigo-600' : 'bg-slate-200',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ─── Inline "Add" card ────────────────────────────────────────────────────────

function AddCard({
  children,
  onCancel,
}: {
  children: React.ReactNode
  onCancel: () => void
}) {
  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">{children}</div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-indigo-100 hover:text-slate-600"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Table wrapper ────────────────────────────────────────────────────────────

function Table({
  headers,
  children,
  isEmpty,
  emptyMessage = 'No records found.',
}: {
  headers: string[]
  children: React.ReactNode
  isEmpty: boolean
  emptyMessage?: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length}>
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
                  <span className="text-sm">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab 1: Currencies ────────────────────────────────────────────────────────

function CurrenciesTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    symbol: '',
    isBaseCurrency: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'currencies'],
    queryFn: () => settingsApi.currencies(),
  })

  const currencies: Currency[] = data?.success ? data.data : []

  const createMutation = useMutation({
    mutationFn: (d: Partial<Currency>) => settingsApi.createCurrency(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'currencies'] })
      setShowAdd(false)
      setForm({ code: '', name: '', symbol: '', isBaseCurrency: false })
      setErrors({})
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Currency> }) =>
      settingsApi.updateCurrency(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'currencies'] })
    },
  })

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.code.trim()) errs.code = 'Code is required.'
    else if (form.code.trim().length !== 3) errs.code = 'Must be exactly 3 characters.'
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.symbol.trim()) errs.symbol = 'Symbol is required.'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    createMutation.mutate({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      isBaseCurrency: form.isBaseCurrency,
    })
  }

  return (
    <div>
      {/* Add form */}
      {showAdd && (
        <AddCard onCancel={() => { setShowAdd(false); setErrors({}) }}>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Code (3 chars)" required error={errors.code} htmlFor="curr-code">
                <input
                  id="curr-code"
                  type="text"
                  maxLength={3}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className={inputClass}
                  placeholder="USD"
                />
              </FormField>
              <FormField label="Name" required error={errors.name} htmlFor="curr-name">
                <input
                  id="curr-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="US Dollar"
                />
              </FormField>
              <FormField label="Symbol" required error={errors.symbol} htmlFor="curr-symbol">
                <input
                  id="curr-symbol"
                  type="text"
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  className={inputClass}
                  placeholder="$"
                />
              </FormField>
              <FormField label="Is Base Currency?" htmlFor="curr-base">
                <label className="flex cursor-pointer items-center gap-2 pt-1">
                  <input
                    id="curr-base"
                    type="checkbox"
                    checked={form.isBaseCurrency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isBaseCurrency: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">Set as base</span>
                </label>
              </FormField>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : 'Add Currency'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="mt-2 text-xs text-red-600">
                Failed to add currency. Please try again.
              </p>
            )}
          </form>
        </AddCard>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Plus size={15} />
          Add Currency
        </button>
      </div>

      <Table
        headers={['Code', 'Name', 'Symbol', 'Base Currency', 'Active']}
        isEmpty={!isLoading && currencies.length === 0}
        emptyMessage="No currencies configured."
      >
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 5 }).map((_, ci) => (
                  <td key={ci} className="px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))
          : currencies.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700">
                  {c.code}
                </td>
                <td className="px-4 py-3 text-slate-700">{c.name}</td>
                <td className="px-4 py-3 text-slate-700">{c.symbol}</td>
                <td className="px-4 py-3">
                  {c.isBaseCurrency ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      <Check size={11} />
                      Base
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ToggleSwitch
                    checked={c.isActive}
                    label={`Toggle active status for ${c.code}`}
                    disabled={updateMutation.isPending}
                    onChange={(v) =>
                      updateMutation.mutate({ id: c.id, d: { isActive: v } })
                    }
                  />
                </td>
              </tr>
            ))}
      </Table>
    </div>
  )
}

// ─── Tab 2: Exchange Rates ────────────────────────────────────────────────────

interface ExchangeRate {
  id: string
  currencyId: string
  rate: number
  effectiveDate: string
  createdAt: string
  currency?: { code: string; symbol: string }
}

function ExchangeRatesTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ currencyId: '', rate: '', effectiveDate: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'exchange-rates'],
    queryFn: () => settingsApi.exchangeRates(),
  })

  const { data: currData } = useQuery({
    queryKey: ['settings', 'currencies'],
    queryFn: () => settingsApi.currencies(),
  })

  const rates: ExchangeRate[] = data?.success ? (data.data as ExchangeRate[]) : []
  const currencies: Currency[] = currData?.success ? currData.data : []
  const baseCurrency = currencies.find((c) => c.isBaseCurrency)
  const nonBaseCurrencies = currencies.filter((c) => !c.isBaseCurrency && c.isActive)

  const selectedCurrency = nonBaseCurrencies.find((c) => c.id === form.currencyId)

  const createMutation = useMutation({
    mutationFn: (d: unknown) => settingsApi.createExchangeRate(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'exchange-rates'] })
      setShowAdd(false)
      setForm({ currencyId: '', rate: '', effectiveDate: '' })
      setErrors({})
    },
  })

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.currencyId) errs.currencyId = 'Currency is required.'
    if (!form.rate || isNaN(Number(form.rate)) || Number(form.rate) <= 0)
      errs.rate = 'Enter a positive rate.'
    if (!form.effectiveDate) errs.effectiveDate = 'Effective date is required.'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    createMutation.mutate({
      currencyId: form.currencyId,
      rate: Number(form.rate),
      effectiveDate: form.effectiveDate,
    })
  }

  return (
    <div>
      {showAdd && (
        <AddCard onCancel={() => { setShowAdd(false); setErrors({}) }}>
          <form onSubmit={handleSubmit}>
            {selectedCurrency && baseCurrency && (
              <div className="mb-3 flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                <Info size={13} className="shrink-0 text-indigo-400" />
                1 unit of {selectedCurrency.code} = {form.rate || '?'}{' '}
                {baseCurrency.code}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Currency" required error={errors.currencyId} htmlFor="er-currency">
                <select
                  id="er-currency"
                  value={form.currencyId}
                  onChange={(e) => setForm((f) => ({ ...f, currencyId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select currency…</option>
                  {nonBaseCurrencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rate" required error={errors.rate} htmlFor="er-rate">
                <input
                  id="er-rate"
                  type="number"
                  min="0"
                  step="any"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 1.25"
                />
              </FormField>
              <FormField
                label="Effective Date"
                required
                error={errors.effectiveDate}
                htmlFor="er-date"
              >
                <input
                  id="er-date"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, effectiveDate: e.target.value }))
                  }
                  className={inputClass}
                />
              </FormField>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : 'Add Rate'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="mt-2 text-xs text-red-600">Failed to add rate.</p>
            )}
          </form>
        </AddCard>
      )}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Plus size={15} />
          Add Rate
        </button>
      </div>

      <Table
        headers={['Currency', 'Rate', 'Effective Date', 'Created At']}
        isEmpty={!isLoading && rates.length === 0}
        emptyMessage="No exchange rates found."
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 4 }).map((_, ci) => (
                  <td key={ci} className="px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))
          : rates.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    {r.currency?.code ?? r.currencyId}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-slate-700">
                  {r.rate.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(r.effectiveDate)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {formatDate(r.createdAt)}
                </td>
              </tr>
            ))}
      </Table>
    </div>
  )
}

// ─── Tab 3: Fee Categories ────────────────────────────────────────────────────

function FeeCategoriesTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'fee-categories'],
    queryFn: () => settingsApi.feeCategories(),
  })

  const cats: FeeCategory[] = data?.success ? data.data : []

  const createMutation = useMutation({
    mutationFn: (d: Partial<FeeCategory>) => settingsApi.createFeeCategory(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'fee-categories'] })
      setShowAdd(false)
      setForm({ name: '', description: '' })
      setErrors({})
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<FeeCategory> }) =>
      settingsApi.updateFeeCategory(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'fee-categories'] })
      setEditingId(null)
      setEditErrors({})
    },
  })

  function validateForm(f: { name: string }) {
    const errs: Record<string, string> = {}
    if (!f.name.trim()) errs.name = 'Name is required.'
    return errs
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateForm(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    createMutation.mutate({ name: form.name.trim(), description: form.description.trim() || undefined })
  }

  function startEdit(cat: FeeCategory) {
    setEditingId(cat.id)
    setEditForm({ name: cat.name, description: cat.description ?? '' })
    setEditErrors({})
  }

  function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    const errs = validateForm(editForm)
    if (Object.keys(errs).length) { setEditErrors(errs); return }
    updateMutation.mutate({
      id,
      d: { name: editForm.name.trim(), description: editForm.description.trim() || undefined },
    })
  }

  return (
    <div>
      {showAdd && (
        <AddCard onCancel={() => { setShowAdd(false); setErrors({}) }}>
          <form onSubmit={handleAdd}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Name" required error={errors.name} htmlFor="fc-name">
                <input
                  id="fc-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Tuition"
                />
              </FormField>
              <FormField label="Description" htmlFor="fc-desc">
                <input
                  id="fc-desc"
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional description"
                />
              </FormField>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : 'Add Category'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="mt-2 text-xs text-red-600">Failed to add category.</p>
            )}
          </form>
        </AddCard>
      )}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Plus size={15} />
          Add Category
        </button>
      </div>

      <Table
        headers={['Name', 'Description', 'Active', 'Actions']}
        isEmpty={!isLoading && cats.length === 0}
        emptyMessage="No fee categories found."
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 4 }).map((_, ci) => (
                  <td key={ci} className="px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))
          : cats.map((cat) =>
              editingId === cat.id ? (
                <tr key={cat.id} className="bg-indigo-50">
                  <td colSpan={4} className="px-4 py-3">
                    <form onSubmit={(e) => handleEdit(e, cat.id)}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label="Name"
                          required
                          error={editErrors.name}
                          htmlFor={`fc-edit-name-${cat.id}`}
                        >
                          <input
                            id={`fc-edit-name-${cat.id}`}
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, name: e.target.value }))
                            }
                            className={inputClass}
                          />
                        </FormField>
                        <FormField
                          label="Description"
                          htmlFor={`fc-edit-desc-${cat.id}`}
                        >
                          <input
                            id={`fc-edit-desc-${cat.id}`}
                            type="text"
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, description: e.target.value }))
                            }
                            className={inputClass}
                          />
                        </FormField>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="submit"
                          disabled={updateMutation.isPending}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={cat.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{cat.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {cat.description ?? <span className="italic text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      checked={cat.isActive}
                      label={`Toggle active for ${cat.name}`}
                      disabled={updateMutation.isPending}
                      onChange={(v) =>
                        updateMutation.mutate({ id: cat.id, d: { isActive: v } })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </td>
                </tr>
              ),
            )}
      </Table>
    </div>
  )
}

// ─── Tab 4: Expense Categories ────────────────────────────────────────────────

function ExpenseCategoriesTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', parentId: '', description: '' })
  const [editForm, setEditForm] = useState({
    name: '',
    parentId: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'expense-categories'],
    queryFn: () => settingsApi.expenseCategories(),
  })

  const cats: ExpenseCategory[] = data?.success ? data.data : []
  // Only show top-level (parentless) cats as possible parents
  const parentOptions = cats.filter((c) => !c.parentId && c.isActive)

  const createMutation = useMutation({
    mutationFn: (d: Partial<ExpenseCategory>) =>
      settingsApi.createExpenseCategory(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'expense-categories'] })
      setShowAdd(false)
      setForm({ name: '', parentId: '', description: '' })
      setErrors({})
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<ExpenseCategory> }) =>
      settingsApi.updateExpenseCategory(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'expense-categories'] })
      setEditingId(null)
      setEditErrors({})
    },
  })

  function validateForm(f: { name: string }) {
    const errs: Record<string, string> = {}
    if (!f.name.trim()) errs.name = 'Name is required.'
    return errs
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const errs = validateForm(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    createMutation.mutate({
      name: form.name.trim(),
      parentId: form.parentId || undefined,
      description: form.description.trim() || undefined,
    })
  }

  function startEdit(cat: ExpenseCategory) {
    setEditingId(cat.id)
    setEditForm({
      name: cat.name,
      parentId: cat.parentId ?? '',
      description: cat.description ?? '',
    })
    setEditErrors({})
  }

  function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    const errs = validateForm(editForm)
    if (Object.keys(errs).length) { setEditErrors(errs); return }
    updateMutation.mutate({
      id,
      d: {
        name: editForm.name.trim(),
        parentId: editForm.parentId || undefined,
        description: editForm.description.trim() || undefined,
      },
    })
  }

  return (
    <div>
      {showAdd && (
        <AddCard onCancel={() => { setShowAdd(false); setErrors({}) }}>
          <form onSubmit={handleAdd}>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="Name" required error={errors.name} htmlFor="ec-name">
                <input
                  id="ec-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Utilities"
                />
              </FormField>
              <FormField label="Parent Category" htmlFor="ec-parent">
                <select
                  id="ec-parent"
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">None (top-level)</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Description" htmlFor="ec-desc">
                <input
                  id="ec-desc"
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional"
                />
              </FormField>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : 'Add Category'}
              </button>
            </div>
            {createMutation.isError && (
              <p className="mt-2 text-xs text-red-600">Failed to add category.</p>
            )}
          </form>
        </AddCard>
      )}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={showAdd}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Plus size={15} />
          Add Category
        </button>
      </div>

      <Table
        headers={['Name', 'Parent Category', 'Description', 'Active', 'Actions']}
        isEmpty={!isLoading && cats.length === 0}
        emptyMessage="No expense categories found."
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 5 }).map((_, ci) => (
                  <td key={ci} className="px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))
          : cats.map((cat) =>
              editingId === cat.id ? (
                <tr key={cat.id} className="bg-indigo-50">
                  <td colSpan={5} className="px-4 py-3">
                    <form onSubmit={(e) => handleEdit(e, cat.id)}>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <FormField
                          label="Name"
                          required
                          error={editErrors.name}
                          htmlFor={`ec-edit-name-${cat.id}`}
                        >
                          <input
                            id={`ec-edit-name-${cat.id}`}
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, name: e.target.value }))
                            }
                            className={inputClass}
                          />
                        </FormField>
                        <FormField
                          label="Parent Category"
                          htmlFor={`ec-edit-parent-${cat.id}`}
                        >
                          <select
                            id={`ec-edit-parent-${cat.id}`}
                            value={editForm.parentId}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, parentId: e.target.value }))
                            }
                            className={selectClass}
                          >
                            <option value="">None (top-level)</option>
                            {parentOptions
                              .filter((p) => p.id !== cat.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </FormField>
                        <FormField
                          label="Description"
                          htmlFor={`ec-edit-desc-${cat.id}`}
                        >
                          <input
                            id={`ec-edit-desc-${cat.id}`}
                            type="text"
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, description: e.target.value }))
                            }
                            className={inputClass}
                          />
                        </FormField>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="submit"
                          disabled={updateMutation.isPending}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={cat.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {cat.parentId && (
                      <span className="mr-1.5 text-slate-300">↳</span>
                    )}
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {cat.parent?.name ?? (
                      <span className="italic text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {cat.description ?? (
                      <span className="italic text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      checked={cat.isActive}
                      label={`Toggle active for ${cat.name}`}
                      disabled={updateMutation.isPending}
                      onChange={(v) =>
                        updateMutation.mutate({ id: cat.id, d: { isActive: v } })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  </td>
                </tr>
              ),
            )}
      </Table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabKey = 'currencies' | 'exchangeRates' | 'feeCategories' | 'expenseCategories'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'currencies', label: 'Currencies' },
  { key: 'exchangeRates', label: 'Exchange Rates' },
  { key: 'feeCategories', label: 'Fee Categories' },
  { key: 'expenseCategories', label: 'Expense Categories' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('currencies')

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage currencies, exchange rates, and categories."
      />

      {/* Tab bar */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <Tab
              key={tab.key}
              label={tab.label}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'currencies' && <CurrenciesTab />}
      {activeTab === 'exchangeRates' && <ExchangeRatesTab />}
      {activeTab === 'feeCategories' && <FeeCategoriesTab />}
      {activeTab === 'expenseCategories' && <ExpenseCategoriesTab />}
    </div>
  )
}
