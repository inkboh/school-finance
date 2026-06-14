import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  children?: React.ReactNode;
}

function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <ShieldOff size={32} className="text-red-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          403 — Forbidden
        </h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          You do not have permission to view this page. Contact your
          administrator if you believe this is a mistake.
        </p>
      </div>
      <a
        href="/dashboard"
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to Dashboard
      </a>
    </div>
  );
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role ?? '';
    if (!allowedRoles.includes(userRole)) {
      return <ForbiddenPage />;
    }
  }

  // When wrapping children directly, render them; otherwise render outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
}
