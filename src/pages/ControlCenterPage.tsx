import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Database,
  FileText,
  Loader2,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { EcoDnaLogo } from '../components/EcoDnaLogo';
import { useAuth } from '../context/AuthContext';
import {
  adminDeleteDataset,
  adminDeleteUser,
  adminUpdateSettings,
  adminUpdateUser,
  downloadProtectedFile,
  fetchAdminOverview,
} from '../lib/api';
import type { AnalysisJobRecord, DatasetRecord, ReportRecord } from '../types/ecodna';

interface ControlCenterPageProps {
  onNavigateHome: () => void;
  onOpenAuth: () => void;
}

type AdminTab = 'users' | 'datasets' | 'analyses' | 'reports' | 'logs' | 'settings';

export const ControlCenterPage: React.FC<ControlCenterPageProps> = ({ onNavigateHome, onOpenAuth }) => {
  const { firebaseUser, logout } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDatasets: 0,
    totalAnalyses: 0,
    totalReports: 0,
    supabaseConfigured: false,
    analysisMode: 'DEMO_MODE',
  });

  const [users, setUsers] = useState<
    Array<{
      uid: string;
      email: string;
      fullName: string;
      organization: string;
      role: 'researcher' | 'admin';
      status: 'active' | 'suspended';
      emailVerified: boolean;
      lastSeenAt: string;
    }>
  >([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisJobRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [logs, setLogs] = useState<
    Array<{
      id: string;
      userId: string;
      actorEmail: string;
      action: string;
      resourceType: string;
      details: string;
      createdAt: string;
    }>
  >([]);
  const [settingsForm, setSettingsForm] = useState({
    maxFileSizeMb: 10,
    allowRegistration: true,
    maintenanceMode: false,
    defaultConfidenceThreshold: 85,
  });

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminOverview();
      setStats(data.stats);
      setUsers(data.users);
      setDatasets(data.datasets);
      setAnalyses(data.analyses);
      setReports(data.reports);
      setLogs(data.logs);
      setSettingsForm({
        maxFileSizeMb: data.settings.maxFileSizeMb,
        allowRegistration: data.settings.allowRegistration,
        maintenanceMode: data.settings.maintenanceMode,
        defaultConfidenceThreshold: data.settings.defaultConfidenceThreshold,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied or failed to load control center.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      void loadOverview();
    } else {
      setLoading(false);
    }
  }, [firebaseUser]);

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#061B14] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0D2B21] border border-emerald-800 rounded-xl p-8 space-y-5 text-center">
          <EcoDnaLogo variant="light" size="md" />
          <h1 className="font-display text-xl font-bold">Protected Control Center</h1>
          <p className="text-sm text-emerald-100/80">
            Administrator authentication is required to access system governance endpoints.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 bg-emerald-500 text-[#061B14] font-semibold text-sm rounded-lg cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-4 py-2 border border-emerald-700 text-sm rounded-lg cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && users.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#061B14] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0D2B21] border border-rose-800/70 rounded-xl p-8 space-y-4 text-center">
          <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto" />
          <h1 className="font-display text-xl font-bold">403 · Access Restricted</h1>
          <p className="text-sm text-emerald-100/80">{error}</p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-4 py-2 bg-white text-[#061B14] font-medium text-sm rounded-lg cursor-pointer"
          >
            Return to EcoDNA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAF9]">
      <header className="bg-[#061B14] text-white border-b border-emerald-950 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <EcoDnaLogo variant="light" size="sm" />
          <span className="text-xs font-mono text-teal-300">Control Center · Restricted Admin Console</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="px-3 py-1.5 bg-emerald-900 text-xs font-medium rounded-lg hover:bg-emerald-800 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-[1380px] mx-auto p-4 sm:p-8 space-y-6">
        {/* Global KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Users</p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#061B14] tabular-nums">{stats.totalUsers}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Datasets</p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#061B14] tabular-nums">{stats.totalDatasets}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Analyses</p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#061B14] tabular-nums">{stats.totalAnalyses}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Reports</p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#061B14] tabular-nums">{stats.totalReports}</p>
          </div>
        </section>

        {statusNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
            {statusNotice}
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit">
          {[
            { id: 'users' as const, label: 'Users', icon: Users },
            { id: 'datasets' as const, label: 'Datasets', icon: Database },
            { id: 'analyses' as const, label: 'Analyses', icon: Activity },
            { id: 'reports' as const, label: 'Reports', icon: FileText },
            { id: 'logs' as const, label: 'Activity Logs', icon: Activity },
            { id: 'settings' as const, label: 'System Settings', icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-white text-[#061B14] shadow-sm' : 'text-slate-600 hover:text-[#061B14]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab View */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading control center data...</span>
            </div>
          ) : tab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Name / Email</th>
                    <th className="py-2.5 pr-4 font-medium">Role</th>
                    <th className="py-2.5 pr-4 font-medium">Status</th>
                    <th className="py-2.5 pr-4 font-medium">Last Seen</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-[#061B14]">{u.fullName}</div>
                        <div className="text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 pr-4 font-mono">{u.role}</td>
                      <td className="py-3 pr-4 font-medium">
                        {u.status === 'active' ? (
                          <span className="text-emerald-700">● Active</span>
                        ) : (
                          <span className="text-rose-700">✖ Suspended</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-500">{u.lastSeenAt.slice(0, 16)}</td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setStatusNotice(null);
                            await adminUpdateUser(u.uid, {
                              status: u.status === 'active' ? 'suspended' : 'active',
                            });
                            setStatusNotice(`Updated status for ${u.email}`);
                            await loadOverview();
                          }}
                          className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setStatusNotice(null);
                            await adminUpdateUser(u.uid, {
                              role: u.role === 'admin' ? 'researcher' : 'admin',
                            });
                            setStatusNotice(`Updated role for ${u.email}`);
                            await loadOverview();
                          }}
                          className="px-2.5 py-1 border border-emerald-300 text-emerald-800 rounded hover:bg-emerald-50 cursor-pointer"
                        >
                          {u.role === 'admin' ? 'Set Researcher' : 'Grant Admin'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setStatusNotice(null);
                            await adminDeleteUser(u.uid);
                            setStatusNotice(`Deleted account ${u.email}`);
                            await loadOverview();
                          }}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded cursor-pointer align-middle"
                          title="Delete user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'datasets' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Dataset</th>
                    <th className="py-2.5 pr-4 font-medium">Owner UID</th>
                    <th className="py-2.5 pr-4 font-medium">Format</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Sequences</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datasets.map((d) => (
                    <tr key={d.id}>
                      <td className="py-3 pr-4 font-medium text-[#061B14]">{d.dataset_name}</td>
                      <td className="py-3 pr-4 font-mono text-slate-500">{d.owner_uid.slice(0, 14)}…</td>
                      <td className="py-3 pr-4 font-mono">{d.file_format}</td>
                      <td className="py-3 pr-4 font-mono text-right tabular-nums">{d.sequence_count}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await adminDeleteDataset(d.id);
                            setStatusNotice(`Removed dataset ${d.dataset_name}`);
                            await loadOverview();
                          }}
                          className="text-rose-700 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'analyses' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Job ID</th>
                    <th className="py-2.5 pr-4 font-medium">Mode</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Valid / Matched</th>
                    <th className="py-2.5 pr-4 font-medium">Status</th>
                    <th className="py-2.5 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyses.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-4 font-mono">{a.id.slice(0, 12)}…</td>
                      <td className="py-3 pr-4 font-mono">{a.analysis_mode}</td>
                      <td className="py-3 pr-4 font-mono text-right tabular-nums">
                        {a.valid_sequences} / {a.matched_sequences}
                      </td>
                      <td className="py-3 pr-4 text-emerald-700 font-medium">{a.status}</td>
                      <td className="py-3 font-mono text-slate-500">{a.started_at.slice(0, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'reports' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Title</th>
                    <th className="py-2.5 pr-4 font-medium">Format</th>
                    <th className="py-2.5 pr-4 font-medium">Date</th>
                    <th className="py-2.5 font-medium text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 pr-4 font-medium">{r.report_title}</td>
                      <td className="py-3 pr-4 font-mono">{r.export_format}</td>
                      <td className="py-3 pr-4 font-mono text-slate-500">{r.created_at.slice(0, 10)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void downloadProtectedFile(
                              `/api/reports/${encodeURIComponent(r.id)}/download`,
                              `${r.report_title}.${r.export_format.toLowerCase()}`
                            )
                          }
                          className="text-emerald-700 hover:underline cursor-pointer"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === 'logs' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
              {logs.map((l) => (
                <div key={l.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold text-emerald-800">{l.action}</span>{' '}
                    <span className="text-slate-600">· {l.details}</span>
                  </div>
                  <div className="font-mono text-slate-400">
                    {l.actorEmail} · {l.createdAt.slice(0, 19)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStatusNotice(null);
                await adminUpdateSettings(settingsForm);
                setStatusNotice('Platform system settings updated.');
                await loadOverview();
              }}
              className="max-w-lg space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Max Upload File Size (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settingsForm.maxFileSizeMb}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, maxFileSizeMb: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Default Alignment Confidence Threshold (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={settingsForm.defaultConfidenceThreshold}
                  onChange={(e) =>
                    setSettingsForm((s) => ({ ...s, defaultConfidenceThreshold: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.allowRegistration}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, allowRegistration: e.target.checked }))}
                />
                <span>Allow new researcher registrations</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.maintenanceMode}
                  onChange={(e) => setSettingsForm((s) => ({ ...s, maintenanceMode: e.target.checked }))}
                />
                <span>Enable maintenance mode (pause non-admin uploads &amp; analyses)</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer"
              >
                Save System Settings
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
