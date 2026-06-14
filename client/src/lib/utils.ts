import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { LoanStatus, PaymentMethod, Role, TxStatus } from '../types'

// ─── Class name helper ────────────────────────────────────────────────────────

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes))
}

// ─── Currency formatting ──────────────────────────────────────────────────────

/**
 * Formats a monetary amount as "$ 1,250.00 USD"
 */
export function formatCurrency(
  amount: number,
  currencySymbol: string,
  currencyCode: string
): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currencySymbol} ${formatted} ${currencyCode}`
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Formats an ISO date string as "14 Jun 2026"
 */
export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'd MMM yyyy')
  } catch {
    return dateStr
  }
}

/**
 * Formats an ISO date string as "14 Jun 2026, 09:30"
 */
export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "d MMM yyyy, HH:mm")
  } catch {
    return dateStr
  }
}

// ─── Status badge colors ──────────────────────────────────────────────────────

/**
 * Returns Tailwind badge classes for a transaction status.
 */
export function getStatusColor(status: TxStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800 border border-green-200'
    case 'REJECTED':
      return 'bg-red-100 text-red-800 border border-red-200'
    case 'PENDING_APPROVAL':
    default:
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
  }
}

/**
 * Returns Tailwind badge classes for a loan status.
 */
export function getLoanStatusColor(status: LoanStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800 border border-blue-200'
    case 'PAID':
      return 'bg-green-100 text-green-800 border border-green-200'
    case 'DEFAULTED':
      return 'bg-red-100 text-red-800 border border-red-200'
    case 'WRITTEN_OFF':
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

// ─── Label helpers ────────────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a user role.
 */
export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin'
    case 'CASHIER':
      return 'Cashier'
    case 'FINANCE_MANAGER':
      return 'Finance Manager'
    case 'PRINCIPAL':
      return 'Principal'
    case 'AUDITOR':
      return 'Auditor'
    default:
      return role
  }
}

/**
 * Returns a human-readable label for a payment method.
 */
export function getPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'CASH':
      return 'Cash'
    case 'BANK_TRANSFER':
      return 'Bank Transfer'
    case 'CHEQUE':
      return 'Cheque'
    case 'MOBILE_MONEY':
      return 'Mobile Money'
    case 'CARD':
      return 'Card'
    case 'OTHER':
    default:
      return 'Other'
  }
}
