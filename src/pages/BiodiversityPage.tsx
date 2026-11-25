import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AiAssistantPanel } from '../components/AiAssistantPanel';
import { fetchAnalysisJobDetails, fetchAnalysisJobs, fetchDatasets } from '../lib/api';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  TaxonomyResultRecord,
} from '../types/ecodna';

interface BiodiversityPageProps {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

const CHART_PALETTE = ['#064E3B', '#059669', '#0D9488', '#14B8A6', '#34D399', '#6EE7B7', '#0F766E'];

export const BiodiversityPage: React.FC<BiodiversityPageProps> = ({ selectedJobId, onSelectJob }) => {
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [metrics, setMetrics] = useState<BiodiversityMetricsRecord | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const [jobList, dsList] = await Promise.all([fetchAnalysisJobs(), fetchDatasets()]);
        setJobs(jobList);
        setDatasets(dsList);
        if (!selectedJobId && jobList.length > 0) {
          onSelectJob(jobList[0].id);
        } else if (jobList.length === 0) {
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load analysis runs.');
        setLoading(false);
      }
    };
    void loadRuns();
  }, [selectedJobId, onSelectJob]);

  useEffect(() => {
    const targetId = selectedJobId || jobs[0]?.id;
    if (!targetId) return;
    let active = true;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const details = await fetchAnalysisJobDetails(targetId);
        if (!active) return;
        setMetrics(details.biodiversityMetrics);
        setTaxonomy(details.taxonomyResults);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load biodiversity metrics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDetails();
    return () => {
      active = false;
    };
  }, [selectedJobId, jobs]);

  const datasetMap = new Map(datasets.map((d) => [d.id, d]));
  const activeJob = jobs.find((j) => j.id === (selectedJobId || jobs[0]?.id)) ?? null;
  const activeDataset = activeJob ? datasetMap.get(activeJob.dataset_id) : undefined;

  const speciesAbundanceData = taxonomy
    .filter((t) => t.confidence_level !== 'Unassigned')
    .reduce<Array<{ taxon: string; abundance: number; identity: number }>>((acc, cur) => {
      const name = cur.species !== 'Unresolved' ? cur.species : `${cur.family} (${cur.sequence_id})`;
      const existing = acc.find((item) => item.taxon === name);
      if (existing) {
        existing.abundance += cur.read_abundance;
      } else {
        acc.push({ taxon: name, abundance: cur.read_abundance, identity: cur.match_percentage });
      }
      return acc;
    }, [])
    .sort((a, b) => b.abundance - a.abundance)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#061B14]">Biodiversity Assessment</h2>
          <p className="text-sm text-slate-600">
            Ecological diversity indices, phylum distribution, and species abundance derived from verified alignments.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <select
            value={selectedJobId || activeJob?.id || ''}
            onChange={(e) => onSelectJob(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {jobs.length === 0 ? (
              <option value="">No completed analyses</option>
            ) : (
              jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {datasetMap.get(j.dataset_id)?.dataset_name ?? j.dataset_id.slice(0, 8)} ({j.started_at.slice(0, 10)})
                </option>
              ))
            )}
          </select>
        </div>
      </section>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">{error}</div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Calculating biodiversity visualizations...</span>
        </div>
      ) : !metrics ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          No biodiversity metrics available yet. Upload a dataset and run the eDNA analysis pipeline first.
        </div>
      ) : (
        <>
          {/* Ecological Indices KPI Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs text-slate-500">Species Richness (S)</p>
              <p className="font-mono text-2xl font-bold text-[#061B14] tabular-nums">
                {metrics.species_richness}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs text-slate-500">Shannon Diversity (H&prime;)</p>
              <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {metrics.shannon_index.toFixed(4)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs text-slate-500">Simpson Index (1 &minus; D)</p>
              <p className="font-mono text-2xl font-bold text-teal-700 tabular-nums">
                {metrics.simpson_index.toFixed(4)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs text-slate-500">Pielou Evenness (J&prime;)</p>
              <p className="font-mono text-2xl font-bold text-[#061B14] tabular-nums">
                {metrics.pielou_evenness.toFixed(4)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">Total Assigned Reads (N)</p>
              <p className="font-mono text-2xl font-bold text-[#061B14] tabular-nums">
                {metrics.total_abundance}
              </p>
            </div>
          </section>

          {/* Interactive Recharts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Taxon Read Abundance Profile
                </h3>
                <p className="text-xs text-slate-500">Top assigned species and unresolved higher-rank taxa by read count</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={speciesAbundanceData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 30, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#334155' }} />
                    <YAxis
                      type="category"
                      dataKey="taxon"
                      width={140}
                      tick={{ fontSize: 11, fill: '#0B221A' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="abundance" name="Read Abundance" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Taxonomic Distribution by Phylum
                </h3>
                <p className="text-xs text-slate-500">Proportional read share across detected phyla</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.taxonomic_distribution}
                      dataKey="readAbundance"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {metrics.taxonomic_distribution.map((_, idx) => (
                        <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}

      <AiAssistantPanel jobId={activeJob?.id ?? null} datasetName={activeDataset?.dataset_name} />
    </div>
  );
};
