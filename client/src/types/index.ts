// ─── Enums ────────────────────────────────────────────────────────────────────

export type Role =
  | 'SUPER_ADMIN'
  | 'CASHIER'
  | 'FINANCE_MANAGER'
  | 'PRINCIPAL'
  | 'AUDITOR'
  | 'DIRECTOR'

export type VoteType = 'FOR' | 'AGAINST' | 'ABSTAIN'

export interface DirectorVote {
  id: string
  entityType: string
  entityId: string
  vote: VoteType
  comment?: string
  voterId: string
  createdAt: string
  updatedAt: string
  voter: { id: string; name: string; role: string }
}

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
  categoryId?: string
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

// ─── Fee Tracker ──────────────────────────────────────────────────────────────

export type MonthPaymentStatus = 'PAID' | 'PENDING' | 'UNPAID' | 'NOT_ENROLLED' | 'UPCOMING'

export interface MonthPayment {
  status: MonthPaymentStatus
  receiptId?: string
  receiptNumber?: string
  amount?: number
}

export interface FeeTrackerRow {
  studentDbId: string
  studentId: string
  firstName: string
  lastName: string
  grade: string
  studentStatus: string
  enrolledFrom: string
  payments: Record<string, MonthPayment>
}

export interface FeeTrackerSummary {
  paid: number
  pending: number
  unpaid: number
  upcoming: number
  totalCollected: number
}

export interface FeeTrackerData {
  year: string
  months: string[]
  currentMonth: string
  rows: FeeTrackerRow[]
  summary: Record<string, FeeTrackerSummary>
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

// ─── Students ─────────────────────────────────────────────────────────────────

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'WITHDRAWN' | 'SUSPENDED'

export interface Student {
  id: string
  studentId: string
  firstName: string
  lastName: string
  grade: string
  section?: string
  dateOfBirth?: string
  enrollmentDate: string
  status: StudentStatus
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  parentAddress?: string
  notes?: string
  createdAt: string
  updatedAt: string
  feeReceipts?: FeeReceipt[]
}

export interface StudentStats {
  total: number
  active: number
  graduated: number
  withdrawn: number
  byGrade: { grade: string; _count: { id: number } }[]
}

// ─── Recurring Obligations ────────────────────────────────────────────────────

export type ObligationCategory =
  | 'INSURANCE' | 'TAX' | 'PERMIT' | 'CONTRACT'
  | 'UTILITY' | 'SUBSCRIPTION' | 'RENT' | 'OTHER'

export type ObligationFrequency =
  | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'BIANNUALLY' | 'ANNUALLY' | 'ONCE'

export interface RecurringObligation {
  id: string
  name: string
  description?: string
  category: ObligationCategory
  amount: number
  currencyId: string
  frequency: ObligationFrequency
  nextDueDate: string
  lastPaidDate?: string
  vendorName?: string
  vendorContact?: string
  isActive: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  currency?: { code: string; symbol: string }
  payments?: ObligationPayment[]
}

export interface ObligationPayment {
  id: string
  obligationId: string
  amount: number
  currencyId: string
  exchangeRate: number
  amountBase: number
  paidDate: string
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
  status: TxStatus
  createdById: string
  approvedById?: string
  approvedAt?: string
  rejectedReason?: string
  createdAt: string
  currency?: { code: string; symbol: string }
  createdBy?: { name: string }
  approvedBy?: { name: string }
}

export interface ObligationSummary {
  total: number
  overdue: number
  dueSoon: number
  upcoming: RecurringObligation[]
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type FundingType = 'INTERNAL' | 'PTA' | 'GRANT' | 'DONATION' | 'LOAN' | 'OTHER'
export type FundingStatus = 'PLEDGED' | 'RECEIVED' | 'CANCELLED'

export interface Project {
  id: string
  projectNumber: string
  name: string
  description?: string
  scope?: string
  status: ProjectStatus
  startDate?: string
  endDate?: string
  budget: number
  currencyId: string
  notes?: string
  createdById: string
  createdAt: string
  updatedAt: string
  currency?: { code: string; symbol: string }
  createdBy?: { name: string }
  funding?: ProjectFunding[]
}

export interface ProjectFunding {
  id: string
  projectId: string
  source: string
  type: FundingType
  amount: number
  currencyId: string
  date: string
  status: FundingStatus
  notes?: string
  createdAt: string
  currency?: { code: string; symbol: string }
}

// ─── Policy Documents ─────────────────────────────────────────────────────────

export type DocumentCategory =
  | 'POLICY' | 'GUIDELINE' | 'PROCEDURE' | 'REGULATION'
  | 'CONTRACT' | 'REPORT' | 'OTHER'

export interface PolicyDocument {
  id: string
  docNumber: string
  title: string
  category: DocumentCategory
  description?: string
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  version: string
  issuedDate: string
  effectiveDate: string
  expiryDate?: string
  isActive: boolean
  createdById: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy?: { name: string }
}
