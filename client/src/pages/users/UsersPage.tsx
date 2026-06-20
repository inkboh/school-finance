import React, { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, UserCog, Power, PowerOff } from 'lucide-react'
import { usersApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { formatDate, getRoleLabel } from '../../lib/utils'
import type { User, Role } from '../../types'
import {
  PageHeader,
  DataTable,
  ConfirmModal,
  FormField,
} from '../../components/shared'
import type { Column } from '../../components/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = [
  'SUPER_ADMIN',
  'CASHIER',
  'FINANCE_MANAGER',
  'PRINCIPAL',
  'AUDITOR',
  'DIRECTOR',
]

// ─── Role badge ───────────────────────────────────────────────────────────────

function getRoleBadgeClass(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200'
    case 'FINANCE_MANAGER':
      return 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
    case 'PRINCIPAL':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
    case 'CASHIER':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
    case 'AUDITOR':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
    case 'DIRECTOR':
      return 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
  }
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(role)}`}
    >
      {getRoleLabel(role)}
    </span>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const firstFocusRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    firstFocusRef.current?.focus()

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="user-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2
            id="user-modal-title"
            ref={firstFocusRef}
            tabIndex={-1}
            className="text-base font-semibold text-slate-900 outline-none"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Invite user form ─────────────────────────────────────────────────────────

interface InviteUserFormData {
  name: string
  email: string
  role: Role
}

function AddUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<InviteUserFormData>({ name: '', email: '', role: 'CASHIER' })
  const [errors, setErrors] = useState<Partial<Record<keyof InviteUserFormData, string>>>({})

  const createMutation = useMutation({
    mutationFn: (d: Partial<User>) => usersApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  function validate(): boolean {
    const errs: Partial<Record<keyof InviteUserFormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.email.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address.'
    if (!form.role) errs.role = 'Role is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    })
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20'
  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20'

  return (
    <Modal title="Invite User" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-700">
            An invitation email will be sent with a temporary password. The user must set a
            permanent password on first sign-in.
          </div>

          <FormField label="Name" required error={errors.name} htmlFor="add-name">
            <input
              id="add-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </FormField>

          <FormField label="Email" required error={errors.email} htmlFor="add-email">
            <input
              id="add-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
              placeholder="jane@school.edu"
              autoComplete="email"
            />
          </FormField>

          <FormField label="Role" required error={errors.role} htmlFor="add-role">
            <select
              id="add-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className={selectClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {getRoleLabel(r)}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {createMutation.isError && (
          <p className="mt-3 text-xs text-red-600">
            Failed to invite user. The email may already be in use.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Sending invite…' : 'Invite User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit user modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
}: {
  user: User
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
  })
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'role', string>>>({})

  const updateMutation = useMutation({
    mutationFn: (d: Partial<User>) => usersApi.update(user.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  function validate(): boolean {
    const errs: Partial<Record<'name' | 'email' | 'role', string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.email.trim()) errs.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    updateMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
    })
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20'
  const selectClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20'

  return (
    <Modal title={`Edit — ${user.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <FormField label="Name" required error={errors.name} htmlFor="edit-name">
            <input
              id="edit-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </FormField>

          <FormField label="Email" required error={errors.email} htmlFor="edit-email">
            <input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
            />
          </FormField>

          <FormField label="Role" required htmlFor="edit-role">
            <select
              id="edit-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className={selectClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {getRoleLabel(r)}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {updateMutation.isError && (
          <p className="mt-3 text-xs text-red-600">
            Failed to update user. Please try again.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Status toggle confirmation
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const users: User[] = data?.success ? data.data : []

  const toggleMutation = useMutation({
    mutationFn: (id: string) => usersApi.toggleStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setToggleTarget(null)
    },
  })

  const columns: Column<User>[] = [
    {
      header: 'Name',
      accessor: 'name',
      render: (_, row) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    {
      header: 'Email',
      accessor: 'email',
      // Hidden on mobile – the Name column already shows it
      className: 'hidden lg:table-cell',
      render: (v) => <span className="text-slate-600">{v as string}</span>,
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (v) => <RoleBadge role={v as Role} />,
    },
    {
      header: 'Account',
      accessor: 'cognitoStatus',
      render: (v) => {
        const status = v as string | null | undefined
        if (!status) return null
        if (status === 'CONFIRMED')
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Confirmed
            </span>
          )
        if (status === 'FORCE_CHANGE_PASSWORD')
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Pending setup
            </span>
          )
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            {status}
          </span>
        )
      },
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (v) =>
        v ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Inactive
          </span>
        ),
    },
    {
      header: 'Created',
      accessor: 'createdAt',
      className: 'hidden md:table-cell',
      render: (v) => (
        <span className="text-xs text-slate-500">{formatDate(v as string)}</span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_, row) => {
        const isSelf = currentUser?.id === row.id
        return (
          <div className="flex items-center gap-1.5">
            {/* Edit */}
            <button
              type="button"
              onClick={() => setEditingUser(row)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Edit user"
            >
              <UserCog size={13} />
              Edit
            </button>

            {/* Toggle status */}
            <button
              type="button"
              disabled={isSelf || toggleMutation.isPending}
              onClick={() => !isSelf && setToggleTarget(row)}
              title={
                isSelf
                  ? 'You cannot deactivate your own account'
                  : row.isActive
                  ? 'Deactivate user'
                  : 'Activate user'
              }
              className={[
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                isSelf
                  ? 'cursor-not-allowed text-slate-300'
                  : row.isActive
                  ? 'text-red-500 hover:bg-red-50 hover:text-red-700'
                  : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800',
              ].join(' ')}
            >
              {row.isActive ? <PowerOff size={13} /> : <Power size={13} />}
              {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage system users and their access roles."
        action={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Plus size={15} />
            Invite User
          </button>
        }
      />

      <DataTable<User>
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found."
        rowKey={(row) => row.id}
      />

      {/* Add user modal */}
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}

      {/* Edit user modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Toggle status confirmation */}
      {toggleTarget && (
        <ConfirmModal
          isOpen
          title={toggleTarget.isActive ? 'Deactivate User' : 'Activate User'}
          message={
            toggleTarget.isActive
              ? `Deactivate ${toggleTarget.name}? They will no longer be able to log in.`
              : `Activate ${toggleTarget.name}? They will regain access to the system.`
          }
          confirmLabel={toggleTarget.isActive ? 'Deactivate' : 'Activate'}
          confirmVariant={toggleTarget.isActive ? 'danger' : 'primary'}
          onConfirm={() => toggleMutation.mutate(toggleTarget.id)}
          onClose={() => setToggleTarget(null)}
        />
      )}
    </div>
  )
}
