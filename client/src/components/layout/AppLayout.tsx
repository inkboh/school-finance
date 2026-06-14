import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Landmark,
  ClipboardList,
  Settings,
  Users,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  allowedRoles?: string[];
  hiddenRoles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'Fee Receipts',
    to: '/fees',
    icon: <Receipt size={18} />,
  },
  {
    label: 'Expenses',
    to: '/expenses',
    icon: <CreditCard size={18} />,
  },
  {
    label: 'Loans',
    to: '/loans',
    icon: <Landmark size={18} />,
  },
  {
    label: 'Audit Trail',
    to: '/audit',
    icon: <ClipboardList size={18} />,
    hiddenRoles: ['CASHIER'],
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: <Settings size={18} />,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    label: 'Users',
    to: '/users',
    icon: <Users size={18} />,
    allowedRoles: ['SUPER_ADMIN'],
  },
];

function isNavItemVisible(item: NavItem, role: string | undefined): boolean {
  if (!role) return false;
  if (item.hiddenRoles && item.hiddenRoles.includes(role)) return false;
  if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
  return true;
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, user?.role),
  );

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white',
    ].join(' ');

  const sidebar = (
    <aside className="flex h-full w-60 flex-col bg-slate-800">
      {/* Logo / school name */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-700 px-4">
        <img src="/logo.jpg" alt="Riverdale Academy" className="h-10 w-10 rounded-full object-cover shrink-0" />
        <span className="truncate text-sm font-semibold text-white leading-tight">
          Riverdale Academy
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleNavItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.name ?? 'Unknown'}
            </p>
            <p className="truncate text-xs text-slate-400">
              {user?.role ?? '—'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">{sidebar}</div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-50 flex w-60 shrink-0 flex-col">
            {sidebar}
            <button
              type="button"
              className="absolute right-2 top-4 rounded-md p-1 text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          {/* School name (desktop breadcrumb area) */}
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-sm text-slate-400">
              {user?.schoolName ?? 'School Finance'}
            </span>
            <ChevronRight size={14} className="text-slate-300" />
          </div>

          {/* Right side: user info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-medium text-slate-700">
                {user?.name ?? 'User'}
              </span>
              <span className="text-xs text-slate-400">{user?.role ?? ''}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              aria-label="Logout"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
