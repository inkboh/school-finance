import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { loadCognitoConfig } from './lib/cognito'

import ProtectedRoute from './components/layout/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import FeesListPage from './pages/fees/FeesListPage'
import NewFeeReceiptPage from './pages/fees/NewFeeReceiptPage'
import FeeReceiptDetailPage from './pages/fees/FeeReceiptDetailPage'
import FeeTrackerPage from './pages/fees/FeeTrackerPage'
import ExpensesListPage from './pages/expenses/ExpensesListPage'
import NewExpensePage from './pages/expenses/NewExpensePage'
import ExpenseDetailPage from './pages/expenses/ExpenseDetailPage'
import LoansListPage from './pages/loans/LoansListPage'
import NewLoanPage from './pages/loans/NewLoanPage'
import LoanDetailPage from './pages/loans/LoanDetailPage'
import AuditPage from './pages/audit/AuditPage'
import SettingsPage from './pages/settings/SettingsPage'
import UsersPage from './pages/users/UsersPage'
import StudentsListPage from './pages/students/StudentsListPage'
import NewStudentPage from './pages/students/NewStudentPage'
import StudentDetailPage from './pages/students/StudentDetailPage'
import ObligationsListPage from './pages/obligations/ObligationsListPage'
import NewObligationPage from './pages/obligations/NewObligationPage'
import ProjectsListPage from './pages/projects/ProjectsListPage'
import NewProjectPage from './pages/projects/NewProjectPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import DocumentsListPage from './pages/documents/DocumentsListPage'
import NewDocumentPage from './pages/documents/NewDocumentPage'
import DocumentDetailPage from './pages/documents/DocumentDetailPage'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-gray-600 mb-6">Page not found</p>
        <a href="/dashboard" className="btn-primary">
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
    loadCognitoConfig()
    document.title = 'School Finance Manager'
  }, [loadFromStorage])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — all authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Fee Receipts */}
            <Route path="/fees" element={<FeesListPage />} />
            <Route path="/fees/tracker" element={<FeeTrackerPage />} />
            <Route
              path="/fees/new"
              element={
                <ProtectedRoute allowedRoles={['CASHIER', 'FINANCE_MANAGER']}>
                  <NewFeeReceiptPage />
                </ProtectedRoute>
              }
            />
            <Route path="/fees/:id" element={<FeeReceiptDetailPage />} />

            {/* Expenses */}
            <Route path="/expenses" element={<ExpensesListPage />} />
            <Route
              path="/expenses/new"
              element={
                <ProtectedRoute allowedRoles={['FINANCE_MANAGER']}>
                  <NewExpensePage />
                </ProtectedRoute>
              }
            />
            <Route path="/expenses/:id" element={<ExpenseDetailPage />} />

            {/* Loans */}
            <Route path="/loans" element={<LoansListPage />} />
            <Route
              path="/loans/new"
              element={
                <ProtectedRoute allowedRoles={['FINANCE_MANAGER']}>
                  <NewLoanPage />
                </ProtectedRoute>
              }
            />
            <Route path="/loans/:id" element={<LoanDetailPage />} />

            {/* Students */}
            <Route path="/students" element={<StudentsListPage />} />
            <Route path="/students/new" element={<NewStudentPage />} />
            <Route path="/students/:id" element={<StudentDetailPage />} />

            {/* Obligations */}
            <Route path="/obligations" element={<ObligationsListPage />} />
            <Route path="/obligations/new" element={<NewObligationPage />} />

            {/* Projects */}
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />

            {/* Documents */}
            <Route path="/documents" element={<DocumentsListPage />} />
            <Route path="/documents/new" element={<NewDocumentPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />

            {/* Audit — not for CASHIER */}
            <Route
              path="/audit"
              element={
                <ProtectedRoute allowedRoles={['AUDITOR', 'SUPER_ADMIN', 'PRINCIPAL', 'FINANCE_MANAGER']}>
                  <AuditPage />
                </ProtectedRoute>
              }
            />

            {/* SUPER_ADMIN only */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
