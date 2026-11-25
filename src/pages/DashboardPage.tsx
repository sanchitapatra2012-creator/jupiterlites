import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Dna,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AppRoute } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { fetchAnalysisJobs, fetchBiodiversityMetrics, fetchDatasets, fetchTaxonomyResults } from '../lib/api';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
} from '../types/ecodna';

interface DashboardPageProps {
  onNavigate: (route: AppRoute, jobId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { profile, firebaseUser, activityLogs } = useAuth();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [metrics, setMetrics] = useState<BiodiversityMetricsRecord[]>([]);
  const [candidateTaxaCount, setCandidateTaxaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ds, jobList, bioList, taxRes] = await Promise.all([
          fetchDatasets(),
          fetchAnalysisJobs(),
          fetchBiodiversityMetrics(),
          fetchTaxonomyResults({ page: 1, pageSize: 100 }),
        ]);
        if (!mounted) return;
        setDatasets(ds);
        setJobs(jobList);
        setMetrics(bioList);
        const uniqueTaxa = new Set(
          taxRes.items
            .filter((t) => t.confidence_level !== 'Unassigned' && t.species !== 'Unassigned')
            .map((t) => t.species)
        );
        setCandidateTaxaCount(uniqueTaxa.size);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load dashboard telemetry.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const avgShannon =
    metrics.length > 0
      ? (metrics.reduce((acc, m) => acc + Number(m.shannon_index), 0) / metrics.length).toFixed(3)
      : '0.000';
  const latestMetrics = metrics[0] ?? null;

  const chartData = (latestMetrics?.taxonomic_distribution ?? []).slice(0, 7).map((item) => ({
    phylum: item.name,
    abundance: item.readAbundance,
    taxa: item.taxonCount,
  }));

  const datasetMap = new Map(datasets.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="bg-[#061B14] text-white rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-mono text-teal-300">Researcher Workspace · Problem Statement ID 25042</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Welcome back, {profile?.fullName || firebaseUser?.displayName || 'Researcher'}
          </h2>
          <p className="text-sm text-emerald-100/80 max-w-2xl">
            Monitor uploaded eDNA sequence runs, review taxonomic assignments, and inspect Shannon and Simpson
            biodiversity metrics across your environmental samples.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="px-5 py-3 bg-emerald-500 text-[#061B14] font-semibold text-sm rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Dataset</span>
        </button>
      </section>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">{error}</div>
      )}

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Uploaded Datasets</span>
            <Database className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="font-mono text-3xl font-bold text-[#061B14] tabular-nums">
            {loading ? '—' : datasets.length}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Candidate Taxa Identified</span>
            <Dna className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="font-mono text-3xl font-bold text-[#061B14] tabular-nums">
            {loading ? '—' : candidateTaxaCount}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Completed Analyses</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="font-mono text-3xl font-bold text-[#061B14] tabular-nums">
            {loading ? '—' : completedJobs.length}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Mean Shannon Diversity (H&prime;)</span>
            <BarChart3 className="h-4 w-4 text-teal-700" />
          </div>
          <p className="font-mono text-3xl font-bold text-[#061B14] tabular-nums">
            {loading ? '—' : avgShannon}
          </p>
        </div>
      </section>

      {/* Main Grid: Biodiversity Statistics Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-[#061B14]">
                Latest Phylum Abundance Distribution
              </h3>
              <p className="text-xs text-slate-500">
                {latestMetrics
                  ? `Richness S=${latestMetrics.species_richness} · Shannon H'=${latestMetrics.shannon_index} · Simpson 1-D=${latestMetrics.simpson_index}`
                  : 'Run an eDNA analysis to visualize taxonomic abundance'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('biodiversity')}
              className="text-xs font-medium text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Full Analytics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading biodiversity distribution...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-[#F7FAF9] border border-dashed border-slate-300 rounded-lg p-6 space-y-3">
              <p className="text-sm text-slate-600">No biodiversity metrics computed yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="px-4 py-2 bg-[#061B14] text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                Upload &amp; Analyze Sample
              </button>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="phylum" tick={{ fontSize: 11, fill: '#334155' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#334155' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="abundance" name="Read Abundance" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Recent Activity (Firestore activity_logs) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-[#061B14]">Recent Activity</h3>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Your uploads, analyses, and report exports will appear here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {activityLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-medium text-emerald-800">{log.action}</span>
                    <span className="text-slate-400">{log.resourceType}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{log.details}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Analysis History */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-base font-semibold text-[#061B14]">Recent Analysis History</h3>
          <button
            type="button"
            onClick={() => onNavigate('datasets')}
            className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
          >
            Manage Datasets
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading analysis history...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No bioinformatics runs yet. Upload a FASTA, FASTQ, or CSV dataset to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Dataset</th>
                  <th className="py-2.5 pr-4 font-medium">Mode</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Valid / Total</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Matched</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.slice(0, 6).map((job) => {
                  const ds = datasetMap.get(job.dataset_id);
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4 font-medium text-[#061B14]">
                        {ds?.dataset_name ?? job.dataset_id.slice(0, 8)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-600">{job.analysis_mode}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-right tabular-nums">
                        {job.valid_sequences} / {job.total_sequences}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-right tabular-nums">
                        {job.matched_sequences}
                      </td>
                      <td className="py-3 pr-4 text-xs font-medium text-emerald-700">
                        {job.status === 'completed' ? '● Completed' : `▲ ${job.status}`}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigate('taxonomy', job.id)}
                          className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                        >
                          View Taxonomy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
