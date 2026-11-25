import React, { useEffect, useState } from 'react';
import {
  Database,
  Download,
  Loader2,
  Play,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { AppRoute } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import {
  deleteDataset,
  downloadProtectedFile,
  fetchAnalysisJobs,
  fetchDatasets,
  runAnalysisPipeline,
} from '../lib/api';
import type { AnalysisJobRecord, DatasetRecord } from '../types/ecodna';

interface DatasetsPageProps {
  onNavigate: (route: AppRoute, jobId?: string) => void;
}

export const DatasetsPage: React.FC<DatasetsPageProps> = ({ onNavigate }) => {
  const { logActivity, pushNotification } = useAuth();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, jobList] = await Promise.all([fetchDatasets(), fetchAnalysisJobs()]);
      setDatasets(ds);
      setJobs(jobList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleRunAnalysis = async (ds: DatasetRecord) => {
    setBusyId(ds.id);
    setError(null);
    try {
      const out = await runAnalysisPipeline(ds.id);
      await logActivity(
        'ANALYSIS_COMPLETED',
        'analysis',
        `Analyzed ${ds.dataset_name}: ${out.job.matched_sequences}/${out.job.valid_sequences} assigned`,
        out.job.id
      );
      await pushNotification(
        'Analysis Completed',
        `${ds.dataset_name} finished processing (${out.job.analysis_mode}).`,
        'success'
      );
      onNavigate('taxonomy', out.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (ds: DatasetRecord) => {
    setBusyId(ds.id);
    setError(null);
    try {
      await deleteDataset(ds.id);
      await logActivity('DATASET_DELETED', 'dataset', `Deleted dataset ${ds.dataset_name}`, ds.id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#061B14]">My eDNA Datasets</h2>
          <p className="text-sm text-slate-600">
            Manage privately stored FASTA, FASTQ, and CSV files, launch analyses, or inspect linked results.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="px-4 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload New Dataset</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">{error}</div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading your datasets...</span>
        </div>
      ) : datasets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Database className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-[#061B14]">No Datasets Uploaded Yet</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Upload a FASTA, FASTQ, or CSV environmental DNA dataset (or load a sample dataset) to run taxonomic
            assignment and biodiversity indexing.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Go to Upload
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {datasets.map((ds) => {
            const latestJob = jobs.find((j) => j.dataset_id === ds.id);
            const isBusy = busyId === ds.id;
            return (
              <div
                key={ds.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-[#061B14]">{ds.dataset_name}</h3>
                    <span className="text-xs font-mono text-emerald-800">
                      · {ds.file_format} · {(ds.file_size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sample: <span className="font-mono">{ds.sample?.sample_code ?? 'N/A'}</span> ·{' '}
                    {ds.sample?.sample_location ?? 'Unknown location'} · {ds.sample?.sample_type ?? ''} · Collected{' '}
                    {ds.sample?.collection_date ?? ''}
                  </p>
                  <p className="text-xs font-mono text-slate-500 tabular-nums">
                    Valid Sequences: {ds.sequence_count} · GC Content: {ds.gc_content_percent}%
                    {ds.mean_quality_score !== null ? ` · Mean Phred Q: ${ds.mean_quality_score}` : ''}
                    {latestJob ? ` · Last Run: ${latestJob.matched_sequences}/${latestJob.valid_sequences} matched` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleRunAnalysis(ds)}
                    className="px-3.5 py-2 bg-[#061B14] text-white text-xs font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{latestJob ? 'Re-run Analysis' : 'Run Analysis'}</span>
                  </button>

                  {latestJob && (
                    <button
                      type="button"
                      onClick={() => onNavigate('taxonomy', latestJob.id)}
                      className="px-3.5 py-2 bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View Results
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void downloadProtectedFile(`/api/datasets/${encodeURIComponent(ds.id)}/download`, ds.file_name)
                    }
                    className="px-3 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
                    title="Download original file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Raw File</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(ds)}
                    className="p-2 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                    aria-label={`Delete ${ds.dataset_name}`}
                    title="Delete dataset and linked records"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
