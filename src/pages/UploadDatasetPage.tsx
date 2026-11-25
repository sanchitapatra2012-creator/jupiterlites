import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  Loader2,
  Play,
  UploadCloud,
} from 'lucide-react';
import type { AppRoute } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { runAnalysisPipeline, uploadDatasetWithProgress } from '../lib/api';
import type { DatasetRecord, HealthStatus, QcSummary } from '../types/ecodna';

interface UploadDatasetPageProps {
  health: HealthStatus | null;
  onNavigate: (route: AppRoute, jobId?: string) => void;
}

const ALLOWED_EXTS = ['fasta', 'fa', 'fna', 'fastq', 'fq', 'csv'];

export const UploadDatasetPage: React.FC<UploadDatasetPageProps> = ({ health, onNavigate }) => {
  const { logActivity, pushNotification } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preValidationInfo, setPreValidationInfo] = useState<string | null>(null);
  const [form, setForm] = useState({
    datasetName: '',
    sampleCode: '',
    sampleLocation: '',
    sampleType: 'Freshwater Stream',
    collectionDate: new Date().toISOString().slice(0, 10),
    environmentalDescription: '',
    researchNotes: '',
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedResult, setUploadedResult] = useState<{
    dataset: DatasetRecord;
    qcSummary: QcSummary;
  } | null>(null);

  const maxMb = health?.maxFileSizeMb ?? 10;

  const handleSelectFile = (selected: File | null) => {
    setError(null);
    setUploadedResult(null);
    setPreValidationInfo(null);
    if (!selected) {
      setFile(null);
      return;
    }

    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTS.includes(ext)) {
      setError('Invalid file extension. Accepted formats: FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), or CSV (.csv).');
      return;
    }
    if (selected.size > maxMb * 1024 * 1024) {
      setError(`File size (${(selected.size / (1024 * 1024)).toFixed(2)} MB) exceeds the ${maxMb} MB limit.`);
      return;
    }

    setFile(selected);
    if (!form.datasetName) {
      const base = selected.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      setForm((prev) => ({ ...prev, datasetName: base }));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const preview = String(reader.result || '').slice(0, 8192);
      if (ext === 'fastq' || ext === 'fq') {
        const reads = (preview.match(/^@/gm) || []).length;
        setPreValidationInfo(`FASTQ detected · ${(selected.size / 1024).toFixed(1)} KB · ~${reads}+ header lines sampled`);
      } else if (ext === 'csv') {
        const rows = preview.trim().split('\n').length - 1;
        setPreValidationInfo(`CSV table detected · ${(selected.size / 1024).toFixed(1)} KB · ~${Math.max(0, rows)} rows sampled`);
      } else {
        const seqs = (preview.match(/^>/gm) || []).length;
        setPreValidationInfo(`FASTA detected · ${(selected.size / 1024).toFixed(1)} KB · ~${seqs} sequence headers sampled`);
      }
    };
    reader.readAsText(selected.slice(0, 16384));
  };

  const handleUseSampleFile = async (format: 'fasta' | 'fastq' | 'csv') => {
    setError(null);
    try {
      const res = await fetch(`/api/sample-files/${format}`);
      if (!res.ok) throw new Error('Unable to load sample file.');
      const text = await res.text();
      const ext = format;
      const sampleFile = new File([text], `ecodna_freshwater_sample.${ext}`, {
        type: format === 'csv' ? 'text/csv' : 'text/plain',
      });
      handleSelectFile(sampleFile);
      setForm((prev) => ({
        ...prev,
        datasetName: prev.datasetName || `Freshwater Transect A (${format.toUpperCase()})`,
        sampleCode: prev.sampleCode || 'FW-TR-2026-01',
        sampleLocation: prev.sampleLocation || 'Upper Cedar River Basin (47.42°N, 121.78°W)',
        sampleType: 'Freshwater Stream',
        environmentalDescription:
          prev.environmentalDescription ||
          'Cold oligotrophic mountain river water filtered through 0.45 µm Sterivex capsule (2L volume, 9.4 °C, pH 7.2).',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample dataset.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select or drop a FASTA, FASTQ, or CSV file first.');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('datasetName', form.datasetName.trim());
    fd.append('sampleCode', form.sampleCode.trim());
    fd.append('sampleLocation', form.sampleLocation.trim());
    fd.append('sampleType', form.sampleType.trim());
    fd.append('collectionDate', form.collectionDate);
    fd.append('environmentalDescription', form.environmentalDescription.trim());
    fd.append('researchNotes', form.researchNotes.trim());

    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadDatasetWithProgress(fd, setUploadProgress);
      setUploadedResult(res);
      await logActivity(
        'DATASET_UPLOADED',
        'dataset',
        `Uploaded ${res.dataset.dataset_name} (${res.dataset.file_format}, ${res.qcSummary.validReads} valid sequences)`,
        res.dataset.id
      );
      await pushNotification(
        'Dataset Validated & Stored',
        `${res.dataset.dataset_name} passed sequence validation (${res.qcSummary.validReads} valid reads). Ready for analysis.`,
        'success'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunAnalysisNow = async () => {
    if (!uploadedResult) return;
    setAnalyzing(true);
    setError(null);
    try {
      const output = await runAnalysisPipeline(uploadedResult.dataset.id);
      await logActivity(
        'ANALYSIS_COMPLETED',
        'analysis',
        `Completed taxonomic alignment on ${uploadedResult.dataset.dataset_name} (${output.job.matched_sequences} matched)`,
        output.job.id
      );
      await pushNotification(
        'eDNA Analysis Complete',
        `${uploadedResult.dataset.dataset_name}: ${output.job.matched_sequences}/${output.job.valid_sequences} sequences assigned. Shannon H' = ${output.biodiversityMetrics.shannon_index}.`,
        'success'
      );
      onNavigate('taxonomy', output.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis execution failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#061B14]">Upload Environmental DNA Dataset</h2>
            <p className="text-sm text-slate-600">
              Accepted formats: FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), and ASV CSV (.csv) · Max {maxMb} MB
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Quick test files:</span>
            {(['fasta', 'fastq', 'csv'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => void handleUseSampleFile(fmt)}
                className="px-2.5 py-1.5 text-xs font-mono bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer inline-flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                <span>Sample .{fmt}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const dropped = e.dataTransfer.files?.[0] ?? null;
              handleSelectFile(dropped);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-emerald-600 bg-emerald-50/70'
                : file
                  ? 'border-emerald-500 bg-[#F7FAF9]'
                  : 'border-slate-300 bg-[#F7FAF9] hover:border-emerald-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".fasta,.fa,.fna,.fastq,.fq,.csv"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col items-center gap-2">
              {file ? (
                <FileCode2 className="h-9 w-9 text-emerald-700" />
              ) : (
                <UploadCloud className="h-9 w-9 text-slate-400" />
              )}
              {file ? (
                <>
                  <p className="text-sm font-semibold text-[#061B14]">{file.name}</p>
                  <p className="text-xs font-mono text-emerald-800">{preValidationInfo}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#061B14]">
                    Drag and drop sequence file here, or click to browse
                  </p>
                  <p className="text-xs text-slate-500">
                    Sequences undergo IUPAC validation, length filtering (&ge;30 bp), and private storage encryption
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Sample & Dataset Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dataset Name *</label>
              <input
                type="text"
                required
                value={form.datasetName}
                onChange={(e) => setForm((f) => ({ ...f, datasetName: e.target.value }))}
                placeholder="Cedar River Autumn COI Survey"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample ID *</label>
              <input
                type="text"
                required
                value={form.sampleCode}
                onChange={(e) => setForm((f) => ({ ...f, sampleCode: e.target.value }))}
                placeholder="SMP-2026-042A"
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample Location *</label>
              <input
                type="text"
                required
                value={form.sampleLocation}
                onChange={(e) => setForm((f) => ({ ...f, sampleLocation: e.target.value }))}
                placeholder="Upper Watershed Basin (47.42°N, 121.78°W)"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type *</label>
              <select
                value={form.sampleType}
                onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="Freshwater Stream">Freshwater Stream</option>
                <option value="Marine / Coastal Water">Marine / Coastal Water</option>
                <option value="Estuarine Sediment">Estuarine Sediment</option>
                <option value="Forest Soil Core">Forest Soil Core</option>
                <option value="Wetland / Lake Column">Wetland / Lake Column</option>
                <option value="Air / Bioaerosol Filter">Air / Bioaerosol Filter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Collection Date *</label>
              <input
                type="date"
                required
                value={form.collectionDate}
                onChange={(e) => setForm((f) => ({ ...f, collectionDate: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Optional Research Notes
              </label>
              <input
                type="text"
                value={form.researchNotes}
                onChange={(e) => setForm((f) => ({ ...f, researchNotes: e.target.value }))}
                placeholder="Sterivex 0.45 µm filter, MiFish-U primers"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Environmental Description *</label>
            <textarea
              rows={3}
              required
              value={form.environmentalDescription}
              onChange={(e) => setForm((f) => ({ ...f, environmentalDescription: e.target.value }))}
              placeholder="Describe habitat conditions, water temperature, turbidity, substrate, and filtration volume..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono text-slate-600">
                <span>Uploading and validating sequences...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={uploading || analyzing}
              className="px-5 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Validate &amp; Store Dataset</span>
            </button>
          </div>
        </form>
      </div>

      {/* Post-Upload QC Confirmation + Direct Analysis Trigger */}
      {uploadedResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-display text-base font-semibold text-[#061B14]">
                  Dataset Stored: {uploadedResult.dataset.dataset_name}
                </h3>
                <p className="text-xs font-mono text-emerald-900 mt-1">
                  Valid Reads: {uploadedResult.qcSummary.validReads} / {uploadedResult.qcSummary.totalReads} · Mean
                  Length: {uploadedResult.qcSummary.meanLengthBp} bp · GC: {uploadedResult.qcSummary.gcContentPercent}%
                  {uploadedResult.qcSummary.meanPhredScore !== null
                    ? ` · Mean Phred Q: ${uploadedResult.qcSummary.meanPhredScore}`
                    : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={analyzing}
              onClick={() => void handleRunAnalysisNow()}
              className="px-4 py-2.5 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap"
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span>{analyzing ? 'Running Bioinformatics Engine...' : 'Run eDNA Analysis Now'}</span>
            </button>
          </div>

          {uploadedResult.qcSummary.warnings.length > 0 && (
            <div className="p-3 bg-white border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Quality Control Warnings:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {uploadedResult.qcSummary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
