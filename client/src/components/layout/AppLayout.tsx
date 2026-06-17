import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  LayoutGrid,
  CreditCard,
  BarChart3,
  TrendingUp,
  Landmark,
  ClipboardList,
  Settings,
  Users,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Sparkles,
  GraduationCap,
  ShieldAlert,
  FolderKanban,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  end?: boolean;
  allowedRoles?: string[];
  hiddenRoles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/dashboard',      icon: <LayoutDashboard size={18} /> },
  { label: 'Fee Receipts', to: '/fees',           icon: <Receipt size={18} />,     end: true },
  { label: 'Fee Tracker',  to: '/fees/tracker',   icon: <LayoutGrid size={18} /> },
  { label: 'Expenses',     to: '/expenses',         icon: <CreditCard size={18} />, end: true },
  { label: 'Cash Flow',    to: '/cashflow',          icon: <TrendingUp size={18} /> },
  { label: 'Loans',        to: '/loans',       icon: <Landmark size={18} /> },
  { label: 'Students',     to: '/students',    icon: <GraduationCap size={18} /> },
  { label: 'Obligations',  to: '/obligations', icon: <ShieldAlert size={18} /> },
  { label: 'Projects',     to: '/projects',    icon: <FolderKanban size={18} /> },
  { label: 'Documents',    to: '/documents',   icon: <BookOpen size={18} /> },
  { label: 'Audit Trail',  to: '/audit',       icon: <ClipboardList size={18} />, hiddenRoles: ['CASHIER'] },
  { label: 'Settings',     to: '/settings',    icon: <Settings size={18} />, allowedRoles: ['SUPER_ADMIN'] },
  { label: 'Users',        to: '/users',       icon: <Users size={18} />,    allowedRoles: ['SUPER_ADMIN'] },
];

const ROLE_DISPLAY: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  CASHIER:         'Cashier',
  FINANCE_MANAGER: 'Finance Manager',
  PRINCIPAL:       'Principal',
  AUDITOR:         'Auditor',
  DIRECTOR:        'Director',
};

function isNavItemVisible(item: NavItem, role: string | undefined): boolean {
  if (!role) return false;
  if (item.hiddenRoles?.includes(role)) return false;
  if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
  return true;
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/20">
      {initials}
    </div>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(item, user?.role));

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
      isActive
        ? 'bg-white text-brand-700 shadow-sm font-semibold'
        : 'text-white/70 hover:bg-white/10 hover:text-white',
    ].join(' ');

  return (
    <aside className="flex h-full w-64 flex-col bg-gradient-to-b from-brand-700 via-brand-800 to-brand-950">
      {/* School identity */}
      <div className="flex h-20 shrink-0 items-center gap-3 px-5 border-b border-white/10">
        <div className="relative shrink-0">
          <img
            src="/logo.jpg"
            alt="Riverdale Academy"
            className="h-12 w-12 rounded-2xl object-cover shadow-lg ring-2 ring-white/20"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white leading-tight">Riverdale Academy</p>
          <p className="truncate text-[11px] text-white/50 leading-tight mt-0.5">Finance Manager</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-white/50 hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                <span className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-brand-100 text-brand-600' : 'text-white/60 group-hover:text-white/90',
                ].join(' ')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto text-brand-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Promo blurb */}
      <div className="mx-3 mb-3 rounded-xl bg-white/8 border border-white/10 px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-semibold text-white/80">Separation of Duties</span>
        </div>
        <p className="text-[11px] text-white/50 leading-tight">
          Every transaction requires a second approver — ensuring full financial integrity.
        </p>
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-white/8 transition-colors">
          <AvatarInitials name={user?.name ?? 'U'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white leading-tight">
              {user?.name ?? 'Unknown'}
            </p>
            <p className="truncate text-[11px] text-white/50 leading-tight">
              {ROLE_DISPLAY[user?.role ?? ''] ?? user?.role ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/15 hover:text-white transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex w-64 shrink-0 flex-col animate-slide-up">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 md:px-6 shadow-sm">
          <button
            type="button"
            className="btn-icon md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Riverdale Academy
            </span>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-xs text-slate-500">Finance System</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-semibold text-slate-800">
                {user?.name ?? 'User'}
              </span>
              <span className="text-xs text-slate-400">
                {ROLE_DISPLAY[user?.role ?? ''] ?? user?.role ?? ''}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-xs font-bold text-white shadow-sm">
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
