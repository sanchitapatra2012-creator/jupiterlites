import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  Database,
  Dna,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  UploadCloud,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { HealthStatus } from '../types/ecodna';
import { EcoDnaLogo } from './EcoDnaLogo';

export type AppRoute =
  | 'dashboard'
  | 'upload'
  | 'datasets'
  | 'taxonomy'
  | 'biodiversity'
  | 'reports'
  | 'profile';

interface AppShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  health: HealthStatus | null;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload Dataset', icon: UploadCloud },
  { id: 'datasets', label: 'My Datasets', icon: Database },
  { id: 'taxonomy', label: 'Taxonomy Results', icon: Dna },
  { id: 'biodiversity', label: 'Biodiversity Analysis', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'profile', label: 'Profile', icon: UserCircle },
];

export const AppShell: React.FC<AppShellProps> = ({ currentRoute, onNavigate, health, children }) => {
  const {
    firebaseUser,
    profile,
    notifications,
    logout,
    markNotificationRead,
    resendVerificationEmail,
    refreshVerificationStatus,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [verifMessage, setVerifMessage] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeItem = NAV_ITEMS.find((n) => n.id === currentRoute);

  return (
    <div className="min-h-screen bg-[#F7FAF9] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#061B14] text-emerald-50 border-r border-emerald-950">
        <div className="h-16 px-5 flex items-center border-b border-emerald-900/70">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-md"
          >
            <EcoDnaLogo variant="light" size="md" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-800/80 text-white'
                    : 'text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-teal-300" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900/70 space-y-3">
          <div className="px-2">
            <p className="text-xs font-medium text-white truncate">{profile?.fullName || firebaseUser?.email}</p>
            <p className="text-xs text-emerald-300/80 truncate">{profile?.email || firebaseUser?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm font-medium text-emerald-100 hover:bg-emerald-900/80 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-teal-300" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-[#061B14] text-emerald-50 flex flex-col h-full z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-emerald-900/70">
              <EcoDnaLogo variant="light" size="md" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-emerald-200 hover:text-white cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      active ? 'bg-emerald-800 text-white' : 'text-emerald-100/80 hover:bg-emerald-900/60'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-teal-300" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-emerald-900/70">
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm font-medium text-emerald-100 hover:bg-emerald-900 cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-teal-300" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold text-[#061B14] truncate">
                {activeItem?.label ?? 'Workspace'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {health && (
              <span className="hidden md:inline-block text-xs font-mono text-slate-500">
                {health.analysisMode === 'DEMO_MODE' ? 'DEMO MODE (Curated Reference)' : 'NCBI/BOLD Live'}
                {' · '}
                {health.supabaseConfigured ? 'Supabase Connected' : 'Local Preview Storage'}
              </span>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 text-slate-600 hover:text-[#061B14] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-mono flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#061B14]">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) void markNotificationRead(n.id);
                          }}
                          className={`p-3.5 text-xs space-y-1 cursor-pointer hover:bg-slate-50 ${
                            n.read ? 'opacity-70' : 'bg-emerald-50/40'
                          }`}
                        >
                          <p className="font-semibold text-[#061B14]">{n.title}</p>
                          <p className="text-slate-600 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="px-3.5 py-2 bg-[#061B14] text-white text-xs font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Upload Dataset
            </button>
          </div>
        </header>

        {/* Email verification prompt if email/password user hasn't verified yet */}
        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
            <span>
              <strong>Email verification pending:</strong> Verify {firebaseUser.email} to confirm your researcher identity.
              {verifMessage ? ` (${verifMessage})` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendVerificationEmail();
                    setVerifMessage('Verification email sent');
                  } catch (e) {
                    setVerifMessage(e instanceof Error ? e.message : 'Unable to send');
                  }
                }}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded font-medium hover:bg-amber-100 cursor-pointer"
              >
                Resend Email
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await refreshVerificationStatus();
                  setVerifMessage(ok ? 'Verified!' : 'Still unverified');
                }}
                className="px-2.5 py-1 bg-amber-900 text-white rounded font-medium hover:bg-amber-800 cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
