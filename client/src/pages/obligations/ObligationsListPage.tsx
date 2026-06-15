import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldAlert, CheckCircle, CreditCard, AlertTriangle, Clock, Vote, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { obligationsApi, settingsApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { PageHeader, DataTable } from '../../components/shared'
import VotePanel from '../../components/shared/VotePanel'
import type { Column } from '../../components/shared'
import { formatDate } from '../../lib/utils'
import type { RecurringObligation, ObligationCategory, ObligationPayment } from '../../types'

interface Toast { id: number; message: string; type: 'success' | 'error' }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={[
          'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
          t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
        ].join(' ')}>
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => onRemove(t.id)} className="shrink-0 rounded p-0.5 hover:bg-white/20">x</button>
        </div>
      ))}
    </div>
  )
}

interface PaymentFormValues {
  amount: string; currencyId: string; exchangeRate: string
  paidDate: string; paymentMethod: string; reference: string; notes: string
}

function RecordPaymentModal({ obl, currencies, onClose, onSuccess }: {
  obl: RecurringObligation
  currencies: { id: string; code: string; name: string; isBaseCurrency: boolean }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { register, handleSubmit } = useForm<PaymentFormValues>({
    defaultValues: {
      amount: String(obl.amount),
      currencyId: obl.currencyId,
      exchangeRate: '1',
      paidDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK_TRANSFER',
    },
  })
  const mutation = useMutation({
    mutationFn: (v: PaymentFormValues) => obligationsApi.recordPayment(obl.id, {
      amount: Number(v.amount),
      currencyId: v.currencyId,
      exchangeRate: Number(v.exchangeRate) || 1,
      amountBase: Number(v.amount) * (Number(v.exchangeRate) || 1),
      paidDate: v.paidDate,
      paymentMethod: v.paymentMethod,
      reference: v.reference || undefined,
      notes: v.notes || undefined,
    }),
    onSuccess: () => { onSuccess(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 animate-scale-in">
        <h2 className="text-base font-semibold text-slate-800">Record Payment - {obl.name}</h2>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input type="number" step="0.01" min="0" className="input" {...register('amount')} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="select" {...register('currencyId')}>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date Paid</label>
              <input type="date" className="input" {...register('paidDate')} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="select" {...register('paymentMethod')}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" {...register('reference')} placeholder="Cheque / transfer ref..." />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[60px]" {...register('notes')} />
          </div>
          {mutation.error && <p className="text-sm text-red-600">Something went wrong.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  INSURANCE:    'bg-blue-100 text-blue-700',
  TAX:          'bg-purple-100 text-purple-700',
  PERMIT:       'bg-amber-100 text-amber-700',
  CONTRACT:     'bg-orange-100 text-orange-700',
  UTILITY:      'bg-cyan-100 text-cyan-700',
  SUBSCRIPTION: 'bg-indigo-100 text-indigo-700',
  RENT:         'bg-teal-100 text-teal-700',
  OTHER:        'bg-slate-100 text-slate-600',
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
  BIANNUALLY: 'Bi-annually', ANNUALLY: 'Annually', ONCE: 'One-time',
}

function VoteModal({ obl, onClose }: { obl: RecurringObligation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">{obl.name}</h2>
          <button type="button" onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        <VotePanel entityType="Obligation" entityId={obl.id} />
      </div>
    </div>
  )
}

export default function ObligationsListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isDirector = user?.role === 'DIRECTOR'
  const [category, setCategory] = useState<ObligationCategory | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  const [payingObl, setPayingObl] = useState<RecurringObligation | null>(null)
  const [votingObl, setVotingObl] = useState<RecurringObligation | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  const { data: summaryData } = useQuery({
    queryKey: ['obligation-summary'],
    queryFn: () => obligationsApi.summary(),
    staleTime: 30_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['obligations', category, showInactive],
    queryFn: () => obligationsApi.list({
      category: category || undefined,
      isActive: showInactive ? undefined : true,
    }),
    staleTime: 30_000,
  })

  const { data: currenciesRes } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => settingsApi.currencies({ isActive: true }),
    staleTime: 5 * 60_000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ oblId, paymentId }: { oblId: string; paymentId: string }) =>
      obligationsApi.approvePayment(oblId, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obligations'] })
      qc.invalidateQueries({ queryKey: ['obligation-summary'] })
      addToast('Payment approved!', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Approval failed'
      addToast(msg, 'error')
    },
  })

  const summary = summaryData?.success ? summaryData.data : null
  const obligations: RecurringObligation[] = data?.success ? (data.data as RecurringObligation[]) : []
  const currencies = currenciesRes?.success ? currenciesRes.data : []

  const today = new Date()

  function getDueStatus(obl: RecurringObligation) {
    const due = new Date(obl.nextDueDate)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return 'overdue'
    if (diffDays <= 30) return 'soon'
    return 'ok'
  }

  const columns: Column<RecurringObligation>[] = [
    { accessor: 'name', header: 'Obligation', render: (_v, o) => (
      <div>
        <p className="font-medium text-slate-800">{o.name}</p>
        {o.vendorName && <p className="text-xs text-slate-400">{o.vendorName}</p>}
      </div>
    )},
    { accessor: 'category', header: 'Category', render: (_v, o) => (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[o.category] ?? 'bg-slate-100 text-slate-600'}`}>{o.category}</span>
    )},
    { accessor: 'amount', header: 'Amount', render: (_v, o) => (
      <span className="font-semibold text-slate-800">
        {o.currency?.symbol}{Number(o.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })} {o.currency?.code}
      </span>
    )},
    { accessor: 'frequency', header: 'Frequency', render: (_v, o) => <span className="text-sm text-slate-600">{FREQ_LABELS[o.frequency]}</span> },
    { accessor: 'nextDueDate', header: 'Next Due', render: (_v, o) => {
      const status = getDueStatus(o)
      return (
        <div className="flex items-center gap-1.5">
          {status === 'overdue' && <AlertTriangle size={13} className="text-red-500" />}
          {status === 'soon' && <Clock size={13} className="text-amber-500" />}
          <span className={`text-sm font-medium ${status === 'overdue' ? 'text-red-600' : status === 'soon' ? 'text-amber-600' : 'text-slate-600'}`}>
            {formatDate(o.nextDueDate)}
          </span>
        </div>
      )
    }},
    ...(!isDirector ? [{
      accessor: 'payments' as keyof RecurringObligation,
      header: 'Pending',
      render: (_v: unknown, o: RecurringObligation) => {
        const pending = (o.payments as ObligationPayment[] | undefined)?.find((p) => p.status === 'PENDING_APPROVAL')
        if (!pending) return <span className="text-slate-300 text-xs">--</span>
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-amber-600 font-medium">Awaiting approval</span>
            {user?.role !== 'CASHIER' && pending.createdById !== user?.id && (
              <button
                onClick={() => approveMutation.mutate({ oblId: o.id, paymentId: pending.id })}
                className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium border border-emerald-300 rounded px-1.5 py-0.5 hover:bg-emerald-50"
              >
                <CheckCircle size={11} /> Approve
              </button>
            )}
          </div>
        )
      },
    }] : []),
    { accessor: 'id', header: '', render: (_v, o) => (
      isDirector ? (
        <button
          onClick={() => setVotingObl(o)}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 border border-brand-300 rounded px-2 py-1 hover:bg-brand-50"
        >
          <Vote size={12} /> Vote
        </button>
      ) : (
        <button
          onClick={() => setPayingObl(o)}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 border border-brand-300 rounded px-2 py-1 hover:bg-brand-50"
        >
          <CreditCard size={12} /> Pay
        </button>
      )
    )},
  ]

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Recurring Obligations"
          subtitle="Insurance, taxes, permits, contracts and other periodic payments"
          action={
            !isDirector ? (
              <button onClick={() => navigate('/obligations/new')} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Add Obligation
              </button>
            ) : undefined
          }
        />

        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-md text-center">
              <p className="text-2xl font-bold text-slate-800">{summary.total}</p>
              <p className="text-xs text-slate-500 mt-0.5">Active Obligations</p>
            </div>
            <div className="card-md text-center">
              <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
              <p className="text-xs text-slate-500 mt-0.5">Overdue</p>
            </div>
            <div className="card-md text-center">
              <p className="text-2xl font-bold text-amber-600">{summary.dueSoon}</p>
              <p className="text-xs text-slate-500 mt-0.5">Due in 30 Days</p>
            </div>
          </div>
        )}

        <div className="card-md flex flex-wrap gap-3 items-center">
          <select className="select w-44" value={category} onChange={(e) => setCategory(e.target.value as ObligationCategory | '')}>
            <option value="">All Categories</option>
            {['INSURANCE', 'TAX', 'PERMIT', 'CONTRACT', 'UTILITY', 'SUBSCRIPTION', 'RENT', 'OTHER'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" className="rounded" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>

        <div className="card overflow-hidden">
          <DataTable
            columns={columns}
            data={obligations}
            isLoading={isLoading}
            emptyMessage="No obligations yet. Add recurring payments your school is obligated to make."
            rowKey={(_r, i) => i}
          />
        </div>
      </div>

      {payingObl && (
        <RecordPaymentModal
          obl={payingObl}
          currencies={currencies}
          onClose={() => setPayingObl(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['obligations'] })
            qc.invalidateQueries({ queryKey: ['obligation-summary'] })
            addToast('Payment submitted for approval', 'success')
          }}
        />
      )}

      {votingObl && (
        <VoteModal obl={votingObl} onClose={() => setVotingObl(null)} />
      )}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </>
  )
}
