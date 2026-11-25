import React, { useEffect, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import type { AppRoute } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import {
  deleteDataset,
  downloadProtectedFile,
  fetchAnalysisJobs,
  fetchDatasets,
  fetchReports,
} from '../lib/api';
import type { AnalysisJobRecord, DatasetRecord, ReportRecord } from '../types/ecodna';

interface ProfilePageProps {
  onNavigate: (route: AppRoute, jobId?: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const {
    firebaseUser,
    profile,
    updateResearcherProfile,
    changePassword,
    resendVerificationEmail,
    refreshVerificationStatus,
  } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || firebaseUser?.displayName || '');
  const [organization, setOrganization] = useState(profile?.organization || '');
  const [researchFocus, setResearchFocus] = useState(profile?.researchFocus || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setOrganization(profile.organization || '');
      setResearchFocus(profile.researchFocus || '');
    }
  }, [profile]);

  const loadUserRecords = async () => {
    setLoadingRecords(true);
    try {
      const [ds, jobList, repList] = await Promise.all([fetchDatasets(), fetchAnalysisJobs(), fetchReports()]);
      setDatasets(ds);
      setJobs(jobList);
      setReports(repList);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    void loadUserRecords();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    if (fullName.trim().length < 2) {
      setProfileErr('Full name must be at least 2 characters.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateResearcherProfile({ fullName, organization, researchFocus });
      setProfileMsg('Researcher profile updated.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (newPw.length < 6) {
      setPwErr('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setPwMsg('Password updated successfully via Firebase Authentication.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const hasPasswordProvider = firebaseUser?.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Edit Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#061B14]">Researcher Profile</h2>
            <span className="text-xs font-mono text-slate-500">
              {firebaseUser?.emailVerified ? '● Email Verified' : '▲ Unverified'}
            </span>
          </div>

          {profileErr && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">{profileErr}</div>}
          {profileMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">{profileMsg}</div>}

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={firebaseUser?.email || ''}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Institution / Lab</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Marine & Freshwater Genomics Institute"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ecological Focus</label>
              <input
                type="text"
                value={researchFocus}
                onChange={(e) => setResearchFocus(e.target.value)}
                placeholder="Watershed fish metabarcoding & macroinvertebrate monitoring"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              >
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Save Profile</span>
              </button>

              {!firebaseUser?.emailVerified && (
                <>
                  <button
                    type="button"
                    onClick={() => void resendVerificationEmail()}
                    className="px-3 py-2 border border-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Send Verification Email
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshVerificationStatus()}
                    className="px-3 py-2 text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                  >
                    Refresh Status
                  </button>
                </>
              )}
            </div>
          </form>
        </section>

        {/* Password Security Card */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#061B14]">Account Security</h2>
          {hasPasswordProvider ? (
            <form onSubmit={handlePasswordChange} className="space-y-3.5">
              {pwErr && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">{pwErr}</div>}
              {pwMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">{pwMsg}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={savingPw}
                className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              >
                {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Change Password</span>
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account signs in via Google Identity (`{firebaseUser?.email}`). Password management is handled
              through your Google Account security settings.
            </p>
          )}
        </section>
      </div>

      {/* Researcher Datasets, Analyses & Reports Summary */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-[#061B14]">
            My Datasets, Analyses &amp; Reports
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {datasets.length} datasets · {jobs.length} analyses · {reports.length} reports
          </span>
        </div>

        {loadingRecords ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading researcher records...</span>
          </div>
        ) : datasets.length === 0 && reports.length === 0 ? (
          <p className="text-sm text-slate-500">No datasets or reports recorded yet.</p>
        ) : (
          <div className="space-y-6">
            {datasets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-medium">Dataset</th>
                      <th className="py-2 pr-4 font-medium">Format</th>
                      <th className="py-2 pr-4 font-medium">Uploaded</th>
                      <th className="py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datasets.map((ds) => {
                      const job = jobs.find((j) => j.dataset_id === ds.id);
                      return (
                        <tr key={ds.id}>
                          <td className="py-2.5 pr-4 font-medium text-[#061B14]">{ds.dataset_name}</td>
                          <td className="py-2.5 pr-4 font-mono">{ds.file_format}</td>
                          <td className="py-2.5 pr-4 font-mono text-slate-500">{ds.created_at.slice(0, 10)}</td>
                          <td className="py-2.5 text-right space-x-2">
                            {job && (
                              <button
                                type="button"
                                onClick={() => onNavigate('taxonomy', job.id)}
                                className="text-emerald-700 font-medium hover:underline cursor-pointer"
                              >
                                Results
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                void downloadProtectedFile(
                                  `/api/datasets/${encodeURIComponent(ds.id)}/download`,
                                  ds.file_name
                                )
                              }
                              className="inline-flex items-center gap-1 text-slate-700 hover:text-[#061B14] cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Raw</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDataset(ds.id);
                                await loadUserRecords();
                              }}
                              className="inline-flex items-center gap-1 text-rose-700 hover:underline cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {reports.length > 0 && (
              <div className="overflow-x-auto pt-2 border-t border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-medium">Report Title</th>
                      <th className="py-2 pr-4 font-medium">Format</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 font-medium text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-4 font-medium text-[#061B14]">{r.report_title}</td>
                        <td className="py-2.5 pr-4 font-mono">{r.export_format}</td>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{r.created_at.slice(0, 10)}</td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void downloadProtectedFile(
                                `/api/reports/${encodeURIComponent(r.id)}/download`,
                                `${r.report_title}.${r.export_format.toLowerCase()}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-emerald-700 font-medium hover:underline cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
