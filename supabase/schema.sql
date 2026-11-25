-- EcoDNA – Biodiversity Intelligence Platform
-- Supabase PostgreSQL Schema & Private Storage Buckets
-- Problem Statement ID: 25042

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Environmental Samples
CREATE TABLE IF NOT EXISTS public.samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  sample_code TEXT NOT NULL,
  sample_location TEXT NOT NULL,
  sample_type TEXT NOT NULL,
  collection_date DATE NOT NULL,
  environmental_description TEXT NOT NULL,
  research_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samples_owner_uid ON public.samples(owner_uid);

-- 2. Uploaded eDNA Datasets
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  dataset_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK (file_format IN ('FASTA', 'FASTQ', 'CSV')),
  file_size_bytes BIGINT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'edna-datasets',
  storage_path TEXT NOT NULL,
  sequence_count INTEGER NOT NULL DEFAULT 0,
  mean_quality_score NUMERIC(6,2),
  gc_content_percent NUMERIC(5,2),
  validation_status TEXT NOT NULL DEFAULT 'validated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasets_owner_uid ON public.datasets(owner_uid);
CREATE INDEX IF NOT EXISTS idx_datasets_sample_id ON public.datasets(sample_id);

-- 3. eDNA Bioinformatics Analysis Jobs
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  analysis_mode TEXT NOT NULL CHECK (analysis_mode IN ('DEMO_MODE', 'NCBI_LIVE', 'BOLD_LIVE')),
  reference_database TEXT NOT NULL,
  total_sequences INTEGER NOT NULL DEFAULT 0,
  valid_sequences INTEGER NOT NULL DEFAULT 0,
  matched_sequences INTEGER NOT NULL DEFAULT 0,
  unassigned_sequences INTEGER NOT NULL DEFAULT 0,
  qc_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_storage_path TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_owner_uid ON public.analysis_jobs(owner_uid);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dataset_id ON public.analysis_jobs(dataset_id);

-- 4. Taxonomic Assignments (7-rank Linnaean hierarchy + confidence)
CREATE TABLE IF NOT EXISTS public.taxonomy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  job_id UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL,
  sequence_length INTEGER NOT NULL,
  read_abundance INTEGER NOT NULL DEFAULT 1,
  marker_gene TEXT NOT NULL,
  kingdom TEXT NOT NULL,
  phylum TEXT NOT NULL,
  class_name TEXT NOT NULL,
  order_name TEXT NOT NULL,
  family TEXT NOT NULL,
  genus TEXT NOT NULL,
  species TEXT NOT NULL,
  match_percentage NUMERIC(5,2) NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('High', 'Medium', 'Low', 'Unassigned')),
  uncertainty_note TEXT NOT NULL,
  reference_database TEXT NOT NULL,
  reference_accession TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_results_owner_uid ON public.taxonomy_results(owner_uid);
CREATE INDEX IF NOT EXISTS idx_taxonomy_results_job_id ON public.taxonomy_results(job_id);

-- 5. Biodiversity Metrics
CREATE TABLE IF NOT EXISTS public.biodiversity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  job_id UUID NOT NULL UNIQUE REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  species_richness INTEGER NOT NULL,
  total_abundance INTEGER NOT NULL,
  shannon_index NUMERIC(6,4) NOT NULL,
  simpson_index NUMERIC(6,4) NOT NULL,
  pielou_evenness NUMERIC(6,4) NOT NULL,
  taxonomic_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_metrics_owner_uid ON public.biodiversity_metrics(owner_uid);

-- 6. Generated Scientific Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  export_format TEXT NOT NULL CHECK (export_format IN ('PDF', 'CSV')),
  storage_bucket TEXT NOT NULL DEFAULT 'generated-reports',
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_owner_uid ON public.reports(owner_uid);

-- Row-Level Security (defense-in-depth; backend accesses via verified Firebase UID + service_role)
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biodiversity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Private Storage Buckets (run via Supabase Dashboard or backend ensureBuckets)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('edna-datasets', 'edna-datasets', false),
  ('analysis-results', 'analysis-results', false),
  ('generated-reports', 'generated-reports', false)
ON CONFLICT (id) DO NOTHING;
