import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore, getAccessToken, getRefreshToken } from '../store/auth.store'
import type {
  ApiResponse,
  DashboardSummary,
  CashFlowPoint,
  RecentActivity,
  FeeReceipt,
  Expense,
  Loan,
  LoanPayment,
  Currency,
  FeeCategory,
  ExpenseCategory,
  User,
  AuditLog,
} from '../types'

// ─── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor — attach bearer token ────────────────────────────────

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor — silent token refresh on 401 ──────────────────────

let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config ?? {}

    const is401 = error.response?.status === 401
    const isAuthEndpoint =
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/refresh')

    if (!is401 || isAuthEndpoint || original._retry) {
      return Promise.reject(error)
    }

    original._retry = true

    try {
      // De-duplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const refreshToken = getRefreshToken()
          const { data } = await axios.post<{
            accessToken: string
            refreshToken: string
          }>('/api/auth/refresh', { refreshToken })

          const { setAuth, logout } = useAuthStore.getState()
          const currentUser = useAuthStore.getState().user

          if (data.accessToken && currentUser) {
            setAuth(currentUser, data.accessToken, data.refreshToken ?? refreshToken ?? '')
          } else {
            logout()
            window.location.href = '/login'
          }

          return data.accessToken
        })().finally(() => {
          refreshPromise = null
        })
      }

      const newToken = await refreshPromise
      if (original.headers) {
        original.headers['Authorization'] = `Bearer ${newToken}`
      }
      return api(original)
    } catch {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }
  }
)

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  logout: (): Promise<void> =>
    api.post('/auth/logout', { refreshToken: getRefreshToken() }).then(() => undefined),

  me: (): Promise<ApiResponse<User>> =>
    api.get('/auth/me').then((r) => r.data),

  changePassword: (data: {
    currentPassword: string
    newPassword: string
  }): Promise<ApiResponse<void>> =>
    api.put('/auth/change-password', data).then((r) => r.data),
}

// ─── Fees API ─────────────────────────────────────────────────────────────────

export const feesApi = {
  list: (params?: Record<string, unknown>): Promise<ApiResponse<FeeReceipt[]>> =>
    api.get('/fees', { params }).then((r) => r.data),

  create: (data: Partial<FeeReceipt>): Promise<ApiResponse<FeeReceipt>> =>
    api.post('/fees', data).then((r) => r.data),

  get: (id: string): Promise<ApiResponse<FeeReceipt>> =>
    api.get(`/fees/${id}`).then((r) => r.data),

  approve: (id: string): Promise<ApiResponse<FeeReceipt>> =>
    api.post(`/fees/${id}/approve`).then((r) => r.data),

  reject: (id: string, reason: string): Promise<ApiResponse<FeeReceipt>> =>
    api.post(`/fees/${id}/reject`, { reason }).then((r) => r.data),
}

// ─── Expenses API ─────────────────────────────────────────────────────────────

export const expensesApi = {
  list: (params?: Record<string, unknown>): Promise<ApiResponse<Expense[]>> =>
    api.get('/expenses', { params }).then((r) => r.data),

  create: (data: Partial<Expense>): Promise<ApiResponse<Expense>> =>
    api.post('/expenses', data).then((r) => r.data),

  get: (id: string): Promise<ApiResponse<Expense>> =>
    api.get(`/expenses/${id}`).then((r) => r.data),

  approve: (id: string): Promise<ApiResponse<Expense>> =>
    api.post(`/expenses/${id}/approve`).then((r) => r.data),

  reject: (id: string, reason: string): Promise<ApiResponse<Expense>> =>
    api.post(`/expenses/${id}/reject`, { reason }).then((r) => r.data),
}

// ─── Loans API ────────────────────────────────────────────────────────────────

export const loansApi = {
  list: (params?: Record<string, unknown>): Promise<ApiResponse<Loan[]>> =>
    api.get('/loans', { params }).then((r) => r.data),

  create: (data: Partial<Loan>): Promise<ApiResponse<Loan>> =>
    api.post('/loans', data).then((r) => r.data),

  get: (id: string): Promise<ApiResponse<Loan>> =>
    api.get(`/loans/${id}`).then((r) => r.data),

  updateStatus: (
    id: string,
    status: string
  ): Promise<ApiResponse<Loan>> =>
    api.put(`/loans/${id}/status`, { status }).then((r) => r.data),

  createPayment: (
    loanId: string,
    data: Partial<LoanPayment>
  ): Promise<ApiResponse<LoanPayment>> =>
    api.post(`/loans/${loanId}/payments`, data).then((r) => r.data),

  approvePayment: (
    loanId: string,
    paymentId: string
  ): Promise<ApiResponse<LoanPayment>> =>
    api.post(`/loans/${loanId}/payments/${paymentId}/approve`).then((r) => r.data),
}

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  summary: (): Promise<ApiResponse<DashboardSummary>> =>
    api.get('/dashboard/summary').then((r) => r.data),

  cashFlow: (params?: { months?: number }): Promise<ApiResponse<CashFlowPoint[]>> =>
    api.get('/dashboard/cash-flow', { params }).then((r) => r.data),

  recentActivity: (params?: { limit?: number }): Promise<ApiResponse<RecentActivity[]>> =>
    api.get('/dashboard/recent-activity', { params }).then((r) => r.data),
}

// ─── Settings API ─────────────────────────────────────────────────────────────

export const settingsApi = {
  currencies: (params?: Record<string, unknown>): Promise<ApiResponse<Currency[]>> =>
    api.get('/settings/currencies', { params }).then((r) => r.data),

  createCurrency: (data: Partial<Currency>): Promise<ApiResponse<Currency>> =>
    api.post('/settings/currencies', data).then((r) => r.data),

  updateCurrency: (id: string, data: Partial<Currency>): Promise<ApiResponse<Currency>> =>
    api.put(`/settings/currencies/${id}`, data).then((r) => r.data),

  exchangeRates: (params?: Record<string, unknown>): Promise<ApiResponse<unknown[]>> =>
    api.get('/settings/exchange-rates', { params }).then((r) => r.data),

  createExchangeRate: (data: unknown): Promise<ApiResponse<unknown>> =>
    api.post('/settings/exchange-rates', data).then((r) => r.data),

  feeCategories: (params?: Record<string, unknown>): Promise<ApiResponse<FeeCategory[]>> =>
    api.get('/settings/fee-categories', { params }).then((r) => r.data),

  createFeeCategory: (data: Partial<FeeCategory>): Promise<ApiResponse<FeeCategory>> =>
    api.post('/settings/fee-categories', data).then((r) => r.data),

  updateFeeCategory: (id: string, data: Partial<FeeCategory>): Promise<ApiResponse<FeeCategory>> =>
    api.put(`/settings/fee-categories/${id}`, data).then((r) => r.data),

  expenseCategories: (params?: Record<string, unknown>): Promise<ApiResponse<ExpenseCategory[]>> =>
    api.get('/settings/expense-categories', { params }).then((r) => r.data),

  createExpenseCategory: (data: Partial<ExpenseCategory>): Promise<ApiResponse<ExpenseCategory>> =>
    api.post('/settings/expense-categories', data).then((r) => r.data),

  updateExpenseCategory: (id: string, data: Partial<ExpenseCategory>): Promise<ApiResponse<ExpenseCategory>> =>
    api.put(`/settings/expense-categories/${id}`, data).then((r) => r.data),
}

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: Record<string, unknown>): Promise<ApiResponse<User[]>> =>
    api.get('/users', { params }).then((r) => r.data),

  create: (data: Partial<User> & { password?: string }): Promise<ApiResponse<User>> =>
    api.post('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<User>): Promise<ApiResponse<User>> =>
    api.put(`/users/${id}`, data).then((r) => r.data),

  toggleStatus: (id: string): Promise<ApiResponse<User>> =>
    api.post(`/users/${id}/toggle-status`).then((r) => r.data),
}

// ─── Audit API ────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params?: Record<string, unknown>): Promise<ApiResponse<AuditLog[]>> =>
    api.get('/audit', { params }).then((r) => r.data),
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { api }
export default api
