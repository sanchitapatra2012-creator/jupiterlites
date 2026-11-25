import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { EcoDnaLogo } from '../components/EcoDnaLogo';
import { useAuth } from '../context/AuthContext';
import {
  downloadProtectedFile,
  fetchAnalysisJobDetails,
  fetchAnalysisJobs,
  fetchDatasets,
  fetchReports,
  saveGeneratedReport,
} from '../lib/api';
import { buildCsvReportContent, buildPdfReportDocument } from '../lib/reportGenerator';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  ReportRecord,
  TaxonomyResultRecord,
} from '../types/ecodna';

interface ReportsPageProps {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ selectedJobId, onSelectJob }) => {
  const { profile, logActivity, pushNotification } = useAuth();
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetRecord | null>(null);
  const [activeJob, setActiveJob] = useState<AnalysisJobRecord | null>(null);
  const [activeMetrics, setActiveMetrics] = useState<BiodiversityMetricsRecord | null>(null);
  const [activeTaxonomy, setActiveTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'PDF' | 'CSV' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [jobList, dsList, repList] = await Promise.all([
        fetchAnalysisJobs(),
        fetchDatasets(),
        fetchReports(),
      ]);
      setJobs(jobList);
      setDatasets(dsList);
      setReports(repList);
      const targetId = selectedJobId || jobList[0]?.id;
      if (targetId) {
        if (!selectedJobId) onSelectJob(targetId);
        const det = await fetchAnalysisJobDetails(targetId);
        setActiveJob(det.job);
        setActiveDataset(det.dataset);
        setActiveMetrics(det.biodiversityMetrics);
        setActiveTaxonomy(det.taxonomyResults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load report workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [selectedJobId]);

  const handleExport = async (format: 'PDF' | 'CSV') => {
    if (!activeDataset || !activeJob) return;
    setExporting(format);
    setError(null);
    setSuccessMsg(null);
    try {
      const ctx = {
        researcher: profile,
        dataset: activeDataset,
        job: activeJob,
        metrics: activeMetrics,
        taxonomy: activeTaxonomy,
      };

      if (format === 'PDF') {
        const { filename, doc, base64 } = buildPdfReportDocument(ctx);
        doc.save(filename);
        await saveGeneratedReport({
          datasetId: activeDataset.id,
          jobId: activeJob.id,
          reportTitle: `${activeDataset.dataset_name} Biodiversity Report`,
          exportFormat: 'PDF',
          contentBase64: base64,
        });
      } else {
        const { filename, content, base64 } = buildCsvReportContent(ctx);
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        await saveGeneratedReport({
          datasetId: activeDataset.id,
          jobId: activeJob.id,
          reportTitle: `${activeDataset.dataset_name} Taxonomy Table`,
          exportFormat: 'CSV',
          contentBase64: base64,
        });
      }

      await logActivity('REPORT_EXPORTED', 'report', `Exported ${format} report for ${activeDataset.dataset_name}`, activeJob.id);
      await pushNotification('Report Exported', `${format} report for ${activeDataset.dataset_name} archived to private storage.`, 'success');
      setSuccessMsg(`${format} report generated, downloaded, and archived to your report history.`);
      const updatedReports = await fetchReports();
      setReports(updatedReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format} report.`);
    } finally {
      setExporting(null);
    }
  };

  const datasetMap = new Map(datasets.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#061B14]">Scientific Report Generation</h2>
            <p className="text-sm text-slate-600">
              Generate complete PDF and CSV biodiversity reports including researcher metadata, QC, charts, methodology,
              and confidence caveats.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedJobId || activeJob?.id || ''}
              onChange={(e) => onSelectJob(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {jobs.length === 0 ? (
                <option value="">No completed runs</option>
              ) : (
                jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {datasetMap.get(j.dataset_id)?.dataset_name ?? j.dataset_id.slice(0, 8)} ({j.started_at.slice(0, 10)})
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              disabled={!activeJob || exporting !== null}
              onClick={() => void handleExport('PDF')}
              className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {exporting === 'PDF' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              disabled={!activeJob || exporting !== null}
              onClick={() => void handleExport('CSV')}
              className="px-4 py-2 bg-emerald-700 text-white text-sm font-medium rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {exporting === 'CSV' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</div>}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
            {successMsg}
          </div>
        )}
      </section>

      {/* Report Preview Sheet */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Preparing report preview...</span>
        </div>
      ) : activeJob && activeDataset ? (
        <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="space-y-1">
              <EcoDnaLogo variant="dark" size="md" />
              <p className="text-xs text-slate-500">
                Problem Statement ID: 25042 · Analysis Date: {(activeJob.completed_at ?? activeJob.started_at).slice(0, 10)}
              </p>
            </div>
            <div className="text-xs font-mono text-right text-slate-600">
              <div>Mode: {activeJob.analysis_mode}</div>
              <div>Reference: {activeJob.reference_database}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1.5">
              <h3 className="font-display font-semibold text-[#061B14]">Researcher &amp; Sample Info</h3>
              <p className="text-slate-600">Researcher: {profile?.fullName ?? 'Verified Researcher'} ({profile?.email})</p>
              <p className="text-slate-600">Sample Code: {activeDataset.sample?.sample_code ?? 'N/A'}</p>
              <p className="text-slate-600">Location: {activeDataset.sample?.sample_location ?? 'N/A'}</p>
              <p className="text-slate-600">Sample Type: {activeDataset.sample?.sample_type ?? 'N/A'}</p>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-display font-semibold text-[#061B14]">Dataset &amp; Biodiversity Summary</h3>
              <p className="text-slate-600">Dataset: {activeDataset.dataset_name} ({activeDataset.file_format})</p>
              <p className="text-slate-600 font-mono text-xs tabular-nums">
                Valid Reads: {activeJob.valid_sequences}/{activeJob.total_sequences} · Matched: {activeJob.matched_sequences}
              </p>
              {activeMetrics && (
                <p className="text-slate-600 font-mono text-xs tabular-nums">
                  Richness S={activeMetrics.species_richness} · Shannon H&prime;={activeMetrics.shannon_index} · Simpson 1-D={activeMetrics.simpson_index}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#F7FAF9] border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-[#061B14]">Methodology &amp; Limitations</p>
            <p>
              Sequences are filtered for IUPAC integrity (&ge;30 bp) and Phred quality, aligned via k-mer containment
              against {activeJob.reference_database}, and graded conservatively (High &ge;97%, Medium 92–96.9%, Low
              85–91.9%, Unassigned &lt;85%). Relative read counts reflect amplicon abundance and are subject to primer
              and reference database coverage biases.
            </p>
          </div>
        </section>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Complete an analysis run first to preview and export PDF/CSV reports.
        </div>
      )}

      {/* Archived Reports Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-base font-semibold text-[#061B14]">Archived Report History</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500">No reports generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4 font-medium">Report Title</th>
                  <th className="py-2 pr-4 font-medium">Format</th>
                  <th className="py-2 pr-4 font-medium">Generated Date</th>
                  <th className="py-2 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <tr key={rep.id}>
                    <td className="py-3 pr-4 font-medium text-[#061B14]">{rep.report_title}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-emerald-800">{rep.export_format}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">{rep.created_at.slice(0, 10)}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          void downloadProtectedFile(
                            `/api/reports/${encodeURIComponent(rep.id)}/download`,
                            `${rep.report_title}.${rep.export_format.toLowerCase()}`
                          )
                        }
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
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
      </section>
    </div>
  );
};
