import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import { AiAssistantPanel } from '../components/AiAssistantPanel';
import { fetchAnalysisJobs, fetchDatasets, fetchTaxonomyResults } from '../lib/api';
import type { AnalysisJobRecord, DatasetRecord, TaxonomyResultRecord } from '../types/ecodna';

interface TaxonomyResultsPageProps {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

export const TaxonomyResultsPage: React.FC<TaxonomyResultsPageProps> = ({ selectedJobId, onSelectJob }) => {
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [rows, setRows] = useState<TaxonomyResultRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [confidence, setConfidence] = useState('All');
  const [kingdom, setKingdom] = useState('All');
  const [sortBy, setSortBy] = useState('match_percentage');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [jobList, dsList] = await Promise.all([fetchAnalysisJobs(), fetchDatasets()]);
        setJobs(jobList);
        setDatasets(dsList);
        if (!selectedJobId && jobList.length > 0) {
          onSelectJob(jobList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load analysis list.');
      }
    };
    void loadInitial();
  }, [selectedJobId, onSelectJob]);

  useEffect(() => {
    let active = true;
    const loadRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTaxonomyResults({
          jobId: selectedJobId || undefined,
          search,
          confidence,
          kingdom,
          sortBy,
          sortDir,
          page,
          pageSize: 15,
        });
        if (!active) return;
        setRows(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to fetch taxonomy results.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadRows();
    return () => {
      active = false;
    };
  }, [selectedJobId, search, confidence, kingdom, sortBy, sortDir, page]);

  const activeJob = jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;
  const datasetMap = new Map(datasets.map((d) => [d.id, d]));
  const activeDataset = activeJob ? datasetMap.get(activeJob.dataset_id) : undefined;

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* DEMO MODE Scientific Integrity Banner */}
      {activeJob?.analysis_mode === 'DEMO_MODE' && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-950">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-semibold">
              DEMO MODE ACTIVE — Curated Local Reference Barcode Alignment
            </p>
            <p className="text-amber-900/90 leading-relaxed">
              No live external sequence-matching engine (NCBI BLAST / BOLD batch API) is currently enabled. Alignments
              below represent deterministic k-mer and base-identity matching against EcoDNA’s curated NCBI/BOLD
              reference subset; sequences below 85% identity remain conservatively Unassigned.
            </p>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Analysis Run</label>
            <select
              value={selectedJobId || ''}
              onChange={(e) => {
                onSelectJob(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {jobs.length === 0 ? (
                <option value="">No analyses available</option>
              ) : (
                jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {datasetMap.get(j.dataset_id)?.dataset_name ?? j.dataset_id.slice(0, 8)} ({j.started_at.slice(0, 10)})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search Taxa / Seq ID</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Salmo, Arthropoda, SEQ_01..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Confidence Tier</label>
            <select
              value={confidence}
              onChange={(e) => {
                setConfidence(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="All">All Confidence Tiers</option>
              <option value="High">High (&ge;97% Species)</option>
              <option value="Medium">Medium (92–96.9% Genus)</option>
              <option value="Low">Low (85–91.9% Family)</option>
              <option value="Unassigned">Unassigned (&lt;85%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kingdom</label>
            <select
              value={kingdom}
              onChange={(e) => {
                setKingdom(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="All">All Kingdoms</option>
              <option value="Animalia">Animalia</option>
              <option value="Plantae">Plantae</option>
              <option value="Fungi">Fungi</option>
              <option value="Chromista">Chromista</option>
              <option value="Bacteria">Bacteria</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</div>
        )}

        {/* Taxonomy Table */}
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading taxonomic assignments...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No taxonomic assignment rows match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('sequence_id')}
                      className="inline-flex items-center gap-1 hover:text-[#061B14] cursor-pointer"
                    >
                      <span>Sequence ID</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 pr-3 font-medium">Kingdom</th>
                  <th className="py-2.5 pr-3 font-medium">Phylum</th>
                  <th className="py-2.5 pr-3 font-medium">Class</th>
                  <th className="py-2.5 pr-3 font-medium">Order</th>
                  <th className="py-2.5 pr-3 font-medium">Family</th>
                  <th className="py-2.5 pr-3 font-medium">Genus</th>
                  <th className="py-2.5 pr-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('species')}
                      className="inline-flex items-center gap-1 hover:text-[#061B14] cursor-pointer"
                    >
                      <span>Species</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 pr-3 font-medium text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('match_percentage')}
                      className="inline-flex items-center gap-1 hover:text-[#061B14] cursor-pointer"
                    >
                      <span>Match %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2.5 pr-3 font-medium">Confidence</th>
                  <th className="py-2.5 font-medium">Reference DB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3 pr-3 font-mono font-medium text-[#061B14] whitespace-nowrap">
                      {r.sequence_id}
                      <div className="text-[11px] font-normal text-slate-400 tabular-nums">
                        {r.sequence_length} bp · {r.read_abundance}x
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-700">{r.kingdom}</td>
                    <td className="py-3 pr-3 text-slate-700">{r.phylum}</td>
                    <td className="py-3 pr-3 text-slate-700">{r.class_name}</td>
                    <td className="py-3 pr-3 text-slate-700">{r.order_name}</td>
                    <td className="py-3 pr-3 text-slate-700">{r.family}</td>
                    <td className="py-3 pr-3 italic text-slate-700">{r.genus}</td>
                    <td className="py-3 pr-3 italic font-medium text-[#061B14]">{r.species}</td>
                    <td className="py-3 pr-3 font-mono text-right tabular-nums font-semibold">
                      {r.match_percentage.toFixed(2)}%
                    </td>
                    <td className="py-3 pr-3 min-w-[170px]">
                      <span
                        className={`font-medium ${
                          r.confidence_level === 'High'
                            ? 'text-emerald-700'
                            : r.confidence_level === 'Medium'
                              ? 'text-teal-700'
                              : r.confidence_level === 'Low'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                        }`}
                      >
                        {r.confidence_level === 'High'
                          ? '● High'
                          : r.confidence_level === 'Medium'
                            ? '◆ Medium'
                            : r.confidence_level === 'Low'
                              ? '▲ Low'
                              : '○ Unassigned'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{r.uncertainty_note}</p>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>{r.reference_database}</div>
                      <div className="text-slate-400">{r.reference_accession}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            Showing {rows.length} of {total} sequences · Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* AI Research Assistant grounded on this Analysis Run */}
      <AiAssistantPanel jobId={activeJob?.id ?? null} datasetName={activeDataset?.dataset_name} />
    </div>
  );
};
