// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role =
  | 'SUPER_ADMIN'
  | 'CASHIER'
  | 'FINANCE_MANAGER'
  | 'PRINCIPAL'
  | 'AUDITOR'

export type TxStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export type LoanType = 'BORROWED' | 'LENT'

export type LoanStatus = 'ACTIVE' | 'PAID' | 'DEFAULTED' | 'WRITTEN_OFF'

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'MOBILE_MONEY'
  | 'CARD'
  | 'OTHER'

// ─── Core models ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: Role
  isActive: boolean
  createdAt: string
}

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  isBaseCurrency: boolean
  isActive: boolean
}

export interface FeeCategory {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export interface ExpenseCategory {
  id: string
  name: string
  parentId?: string
  description?: string
  isActive: boolean
  parent?: { id: string; name: string }
  children?: ExpenseCategory[]
}

export interface FeeReceipt {
  id: string
  receiptNumber: string
  studentName: string
  studentId?: string
  grade?: string
  amount: number
  amountBase: number
  exchangeRate: number
  currencyId: string
  paymentDate: string
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
  status: TxStatus
  createdById: string
  approvedById?: string
  approvedAt?: string
  rejectedReason?: string
  createdAt: string
  category?: FeeCategory
  currency?: Currency
  createdBy?: { name: string }
  approvedBy?: { name: string }
}

export interface Expense {
  id: string
  expenseNumber: string
  categoryId: string
  description: string
  vendor?: string
  amount: number
  amountBase: number
  exchangeRate: number
  currencyId: string
  expenseDate: string
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
  status: TxStatus
  createdById: string
  approvedById?: string
  approvedAt?: string
  rejectedReason?: string
  createdAt: string
  category?: ExpenseCategory
  currency?: Currency
  createdBy?: { name: string }
  approvedBy?: { name: string }
}

export interface LoanPayment {
  id: string
  paymentNumber: string
  loanId: string
  amount: number
  amountBase: number
  exchangeRate: number
  currencyId: string
  paymentDate: string
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
  status: TxStatus
  createdById: string
  approvedById?: string
  approvedAt?: string
  createdAt: string
  currency?: Currency
  createdBy?: { name: string }
  approvedBy?: { name: string }
}

export interface Loan {
  id: string
  loanNumber: string
  loanType: LoanType
  partyName: string
  partyContact?: string
  purpose?: string
  principal: number
  currencyId: string
  interestRate?: number
  loanDate: string
  dueDate?: string
  status: LoanStatus
  notes?: string
  createdById: string
  createdAt: string
  currency?: Currency
  createdBy?: { name: string }
  payments?: LoanPayment[]
  totalPaid?: number
  outstanding?: number
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
  createdAt: string
  user?: { name: string; email: string }
}

// ─── API envelope ─────────────────────────────────────────────────────────────

export interface ApiMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ApiResponse<T> =
  | { success: true; data: T; meta?: ApiMeta }
  | { success: false; error: string; details?: unknown }

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  netBalance: number
  pendingApprovals: {
    receipts: number
    expenses: number
    loanPayments: number
  }
  currentMonth: {
    income: number
    expenses: number
    net: number
  }
  loans: {
    totalBorrowed: number
    totalLent: number
    outstandingBorrowed: number
    outstandingLent: number
  }
}

export interface CashFlowPoint {
  month: string
  income: number
  expenses: number
}

export interface RecentActivity {
  type: 'receipt' | 'expense' | 'loanPayment'
  number: string
  description: string
  amountBase: number
  currencyCode: string
  status: TxStatus
  date: string
  createdByName: string
}
