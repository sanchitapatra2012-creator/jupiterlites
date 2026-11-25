export type FileFormat = 'FASTA' | 'FASTQ' | 'CSV';
export type AnalysisStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AnalysisMode = 'DEMO_MODE' | 'NCBI_LIVE' | 'BOLD_LIVE';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low' | 'Unassigned';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  organization?: string;
  researchFocus?: string;
  role: 'researcher' | 'admin';
  status: 'active' | 'suspended';
  emailVerified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt?: unknown;
}

export interface ActivityLogItem {
  id: string;
  userId: string;
  actorEmail?: string;
  action: string;
  resourceType: 'auth' | 'dataset' | 'analysis' | 'report' | 'profile' | 'system';
  resourceId?: string;
  details: string;
  createdAt?: unknown;
}

export interface SampleRecord {
  id: string;
  owner_uid: string;
  sample_code: string;
  sample_location: string;
  sample_type: string;
  collection_date: string;
  environmental_description: string;
  research_notes: string;
  created_at: string;
}

export interface DatasetRecord {
  id: string;
  owner_uid: string;
  sample_id: string;
  dataset_name: string;
  file_name: string;
  file_format: FileFormat;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  sequence_count: number;
  mean_quality_score: number | null;
  gc_content_percent: number;
  validation_status: string;
  created_at: string;
  sample?: SampleRecord;
}

export interface QcSummary {
  totalReads: number;
  validReads: number;
  rejectedReads: number;
  meanLengthBp: number;
  minLengthBp: number;
  maxLengthBp: number;
  gcContentPercent: number;
  meanPhredScore: number | null;
  detectedMarkers: string[];
  warnings: string[];
}

export interface AnalysisJobRecord {
  id: string;
  owner_uid: string;
  dataset_id: string;
  status: AnalysisStatus;
  analysis_mode: AnalysisMode;
  reference_database: string;
  total_sequences: number;
  valid_sequences: number;
  matched_sequences: number;
  unassigned_sequences: number;
  qc_summary: QcSummary;
  result_storage_path: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface TaxonomyResultRecord {
  id: string;
  owner_uid: string;
  job_id: string;
  dataset_id: string;
  sequence_id: string;
  sequence_length: number;
  read_abundance: number;
  marker_gene: string;
  kingdom: string;
  phylum: string;
  class_name: string;
  order_name: string;
  family: string;
  genus: string;
  species: string;
  match_percentage: number;
  confidence_level: ConfidenceLevel;
  uncertainty_note: string;
  reference_database: string;
  reference_accession: string;
  created_at: string;
}

export interface TaxonomicDistributionItem {
  name: string;
  rank: 'Phylum' | 'Class' | 'Kingdom';
  taxonCount: number;
  readAbundance: number;
  percentage: number;
}

export interface BiodiversityMetricsRecord {
  id: string;
  owner_uid: string;
  job_id: string;
  dataset_id: string;
  species_richness: number;
  total_abundance: number;
  shannon_index: number;
  simpson_index: number;
  pielou_evenness: number;
  taxonomic_distribution: TaxonomicDistributionItem[];
  calculated_at: string;
}

export interface ReportRecord {
  id: string;
  owner_uid: string;
  dataset_id: string;
  job_id: string;
  report_title: string;
  export_format: 'PDF' | 'CSV';
  storage_bucket: string;
  storage_path: string;
  created_at: string;
}

export interface HealthStatus {
  status: string;
  supabaseConfigured: boolean;
  analysisMode: AnalysisMode;
  geminiConfigured: boolean;
  maxFileSizeMb: number;
  allowRegistration: boolean;
  maintenanceMode: boolean;
  defaultConfidenceThreshold: number;
}
