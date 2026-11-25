import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  ManagedUserRecord,
  ReportRecord,
  SampleRecord,
  ServerActivityLog,
  SystemSettingsRecord,
  TaxonomyResultRecord,
} from '../types.ts';

interface LocalStoreSchema {
  samples: SampleRecord[];
  datasets: DatasetRecord[];
  analysis_jobs: AnalysisJobRecord[];
  taxonomy_results: TaxonomyResultRecord[];
  biodiversity_metrics: BiodiversityMetricsRecord[];
  reports: ReportRecord[];
  users: ManagedUserRecord[];
  activity_logs: ServerActivityLog[];
  system_settings: SystemSettingsRecord;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'ecodna-store.json');
const STORAGE_ROOT = path.resolve(DATA_DIR, 'storage');

const DEFAULT_SETTINGS: SystemSettingsRecord = {
  maxFileSizeMb: 10,
  allowRegistration: true,
  maintenanceMode: false,
  defaultConfidenceThreshold: 85,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

function ensureLocalDirectories(): void {
  for (const dir of [
    DATA_DIR,
    STORAGE_ROOT,
    path.resolve(STORAGE_ROOT, 'edna-datasets'),
    path.resolve(STORAGE_ROOT, 'analysis-results'),
    path.resolve(STORAGE_ROOT, 'generated-reports'),
  ]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function readLocalStore(): LocalStoreSchema {
  ensureLocalDirectories();
  if (!fs.existsSync(STORE_FILE)) {
    const empty: LocalStoreSchema = {
      samples: [],
      datasets: [],
      analysis_jobs: [],
      taxonomy_results: [],
      biodiversity_metrics: [],
      reports: [],
      users: [],
      activity_logs: [],
      system_settings: DEFAULT_SETTINGS,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreSchema>;
    return {
      samples: parsed.samples ?? [],
      datasets: parsed.datasets ?? [],
      analysis_jobs: parsed.analysis_jobs ?? [],
      taxonomy_results: parsed.taxonomy_results ?? [],
      biodiversity_metrics: parsed.biodiversity_metrics ?? [],
      reports: parsed.reports ?? [],
      users: parsed.users ?? [],
      activity_logs: parsed.activity_logs ?? [],
      system_settings: parsed.system_settings ?? DEFAULT_SETTINGS,
    };
  } catch {
    return {
      samples: [],
      datasets: [],
      analysis_jobs: [],
      taxonomy_results: [],
      biodiversity_metrics: [],
      reports: [],
      users: [],
      activity_logs: [],
      system_settings: DEFAULT_SETTINGS,
    };
  }
}

function writeLocalStore(store: LocalStoreSchema): void {
  ensureLocalDirectories();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function resolveConfinedStoragePath(bucket: 'edna-datasets' | 'analysis-results' | 'generated-reports', objectPath: string): string {
  const bucketDir = path.resolve(STORAGE_ROOT, bucket);
  const sanitizedRel = objectPath.replace(/^\/+/, '');
  const resolved = path.resolve(bucketDir, sanitizedRel);
  if (!resolved.startsWith(bucketDir + path.sep)) {
    throw new Error('Invalid storage path traversal detected.');
  }
  return resolved;
}

class StorageAndDbService {
  private supabase: SupabaseClient | null = null;
  private bucketsChecked = false;

  constructor() {
    const url = process.env.SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url && serviceKey) {
      this.supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  public isSupabaseConfigured(): boolean {
    return this.supabase !== null;
  }

  private async ensureBuckets(): Promise<void> {
    if (!this.supabase || this.bucketsChecked) return;
    const buckets = ['edna-datasets', 'analysis-results', 'generated-reports'];
    for (const bucket of buckets) {
      try {
        const { data } = await this.supabase.storage.getBucket(bucket);
        if (!data) {
          await this.supabase.storage.createBucket(bucket, { public: false });
        }
      } catch {
        // Bucket creation may require SQL migration if storage admin is restricted
      }
    }
    this.bucketsChecked = true;
  }

  public async uploadPrivateFile(
    bucket: 'edna-datasets' | 'analysis-results' | 'generated-reports',
    objectPath: string,
    content: Buffer | string,
    contentType: string
  ): Promise<void> {
    if (this.supabase) {
      await this.ensureBuckets();
      const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
      const { error } = await this.supabase.storage.from(bucket).upload(objectPath, body, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(`Supabase Storage upload failed (${bucket}): ${error.message}`);
      }
      return;
    }

    const fullPath = resolveConfinedStoragePath(bucket, objectPath);
    const parent = path.dirname(fullPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    if (typeof content === 'string') {
      fs.writeFileSync(fullPath, content, 'utf-8');
    } else {
      fs.writeFileSync(fullPath, content);
    }
  }

  public async downloadPrivateFile(
    bucket: 'edna-datasets' | 'analysis-results' | 'generated-reports',
    objectPath: string
  ): Promise<Buffer> {
    if (this.supabase) {
      const { data, error } = await this.supabase.storage.from(bucket).download(objectPath);
      if (error || !data) {
        throw new Error(`Supabase Storage download failed (${bucket}): ${error?.message ?? 'Missing file'}`);
      }
      const arrayBuf = await data.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    const fullPath = resolveConfinedStoragePath(bucket, objectPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Stored file not found.');
    }
    return fs.readFileSync(fullPath);
  }

  public async deletePrivateFile(
    bucket: 'edna-datasets' | 'analysis-results' | 'generated-reports',
    objectPath: string
  ): Promise<void> {
    if (this.supabase) {
      await this.supabase.storage.from(bucket).remove([objectPath]);
      return;
    }

    try {
      const fullPath = resolveConfinedStoragePath(bucket, objectPath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      // Ignore already-deleted files
    }
  }

  public async insertSampleAndDataset(sample: SampleRecord, dataset: DatasetRecord): Promise<void> {
    if (this.supabase) {
      const { error: sampleErr } = await this.supabase.from('samples').insert(sample);
      if (sampleErr) throw new Error(`Supabase insert sample error: ${sampleErr.message}`);
      const { error: dsErr } = await this.supabase.from('datasets').insert(dataset);
      if (dsErr) throw new Error(`Supabase insert dataset error: ${dsErr.message}`);
      return;
    }

    const store = readLocalStore();
    store.samples.push(sample);
    store.datasets.push(dataset);
    writeLocalStore(store);
  }

  public async listDatasetsByOwner(ownerUid: string): Promise<DatasetRecord[]> {
    if (this.supabase) {
      const { data: datasets, error } = await this.supabase
        .from('datasets')
        .select('*, sample:samples(*)')
        .eq('owner_uid', ownerUid)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Supabase list datasets error: ${error.message}`);
      return (datasets ?? []) as DatasetRecord[];
    }

    const store = readLocalStore();
    const sampleMap = new Map(store.samples.map((s) => [s.id, s]));
    return store.datasets
      .filter((d) => d.owner_uid === ownerUid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((d) => ({ ...d, sample: sampleMap.get(d.sample_id) }));
  }

  public async getDatasetById(datasetId: string): Promise<DatasetRecord | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('datasets')
        .select('*, sample:samples(*)')
        .eq('id', datasetId)
        .maybeSingle();
      if (error) throw new Error(`Supabase get dataset error: ${error.message}`);
      return (data as DatasetRecord | null) ?? null;
    }

    const store = readLocalStore();
    const ds = store.datasets.find((d) => d.id === datasetId);
    if (!ds) return null;
    const sample = store.samples.find((s) => s.id === ds.sample_id);
    return { ...ds, sample };
  }

  public async deleteDatasetCascade(datasetId: string): Promise<void> {
    const dataset = await this.getDatasetById(datasetId);
    if (!dataset) return;

    await this.deletePrivateFile('edna-datasets', dataset.storage_path);

    const jobs = await this.listAnalysisJobsByDataset(datasetId);
    for (const job of jobs) {
      if (job.result_storage_path) {
        await this.deletePrivateFile('analysis-results', job.result_storage_path);
      }
    }

    if (this.supabase) {
      const { data: reports } = await this.supabase.from('reports').select('*').eq('dataset_id', datasetId);
      for (const rep of (reports ?? []) as ReportRecord[]) {
        await this.deletePrivateFile('generated-reports', rep.storage_path);
      }
      await this.supabase.from('datasets').delete().eq('id', datasetId);
      await this.supabase.from('samples').delete().eq('id', dataset.sample_id);
      return;
    }

    const store = readLocalStore();
    for (const rep of store.reports.filter((r) => r.dataset_id === datasetId)) {
      await this.deletePrivateFile('generated-reports', rep.storage_path);
    }
    store.reports = store.reports.filter((r) => r.dataset_id !== datasetId);
    store.biodiversity_metrics = store.biodiversity_metrics.filter((m) => m.dataset_id !== datasetId);
    store.taxonomy_results = store.taxonomy_results.filter((t) => t.dataset_id !== datasetId);
    store.analysis_jobs = store.analysis_jobs.filter((j) => j.dataset_id !== datasetId);
    store.datasets = store.datasets.filter((d) => d.id !== datasetId);
    store.samples = store.samples.filter((s) => s.id !== dataset.sample_id);
    writeLocalStore(store);
  }

  public async saveAnalysisOutput(
    job: AnalysisJobRecord,
    taxonomyResults: TaxonomyResultRecord[],
    biodiversityMetrics: BiodiversityMetricsRecord
  ): Promise<void> {
    if (job.result_storage_path) {
      await this.uploadPrivateFile(
        'analysis-results',
        job.result_storage_path,
        JSON.stringify({ job, biodiversityMetrics, taxonomyResults }, null, 2),
        'application/json'
      );
    }

    if (this.supabase) {
      const { error: jobErr } = await this.supabase.from('analysis_jobs').insert(job);
      if (jobErr) throw new Error(`Supabase insert analysis_job error: ${jobErr.message}`);

      if (taxonomyResults.length > 0) {
        const { error: taxErr } = await this.supabase.from('taxonomy_results').insert(taxonomyResults);
        if (taxErr) throw new Error(`Supabase insert taxonomy_results error: ${taxErr.message}`);
      }

      const { error: bioErr } = await this.supabase.from('biodiversity_metrics').insert(biodiversityMetrics);
      if (bioErr) throw new Error(`Supabase insert biodiversity_metrics error: ${bioErr.message}`);
      return;
    }

    const store = readLocalStore();
    store.analysis_jobs.push(job);
    store.taxonomy_results.push(...taxonomyResults);
    store.biodiversity_metrics.push(biodiversityMetrics);
    writeLocalStore(store);
  }

  public async listAnalysisJobsByOwner(ownerUid: string): Promise<AnalysisJobRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .eq('owner_uid', ownerUid)
        .order('started_at', { ascending: false });
      if (error) throw new Error(`Supabase list analysis_jobs error: ${error.message}`);
      return (data ?? []) as AnalysisJobRecord[];
    }

    const store = readLocalStore();
    return store.analysis_jobs
      .filter((j) => j.owner_uid === ownerUid)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  public async listAnalysisJobsByDataset(datasetId: string): Promise<AnalysisJobRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('started_at', { ascending: false });
      if (error) throw new Error(`Supabase list dataset jobs error: ${error.message}`);
      return (data ?? []) as AnalysisJobRecord[];
    }

    const store = readLocalStore();
    return store.analysis_jobs
      .filter((j) => j.dataset_id === datasetId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  public async getAnalysisJobById(jobId: string): Promise<AnalysisJobRecord | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw new Error(`Supabase get analysis_job error: ${error.message}`);
      return (data as AnalysisJobRecord | null) ?? null;
    }

    const store = readLocalStore();
    return store.analysis_jobs.find((j) => j.id === jobId) ?? null;
  }

  public async listTaxonomyResultsByOwner(ownerUid: string, jobId?: string): Promise<TaxonomyResultRecord[]> {
    if (this.supabase) {
      let query = this.supabase.from('taxonomy_results').select('*').eq('owner_uid', ownerUid);
      if (jobId) query = query.eq('job_id', jobId);
      const { data, error } = await query.order('match_percentage', { ascending: false });
      if (error) throw new Error(`Supabase list taxonomy_results error: ${error.message}`);
      return (data ?? []) as TaxonomyResultRecord[];
    }

    const store = readLocalStore();
    return store.taxonomy_results
      .filter((t) => t.owner_uid === ownerUid && (!jobId || t.job_id === jobId))
      .sort((a, b) => b.match_percentage - a.match_percentage);
  }

  public async listBiodiversityMetricsByOwner(ownerUid: string, jobId?: string): Promise<BiodiversityMetricsRecord[]> {
    if (this.supabase) {
      let query = this.supabase.from('biodiversity_metrics').select('*').eq('owner_uid', ownerUid);
      if (jobId) query = query.eq('job_id', jobId);
      const { data, error } = await query.order('calculated_at', { ascending: false });
      if (error) throw new Error(`Supabase list biodiversity_metrics error: ${error.message}`);
      return (data ?? []) as BiodiversityMetricsRecord[];
    }

    const store = readLocalStore();
    return store.biodiversity_metrics
      .filter((m) => m.owner_uid === ownerUid && (!jobId || m.job_id === jobId))
      .sort((a, b) => b.calculated_at.localeCompare(a.calculated_at));
  }

  public async saveReport(report: ReportRecord, fileContent?: Buffer | string): Promise<void> {
    if (fileContent !== undefined) {
      const contentType = report.export_format === 'CSV' ? 'text/csv' : 'application/pdf';
      await this.uploadPrivateFile('generated-reports', report.storage_path, fileContent, contentType);
    }

    if (this.supabase) {
      const { error } = await this.supabase.from('reports').insert(report);
      if (error) throw new Error(`Supabase insert report error: ${error.message}`);
      return;
    }

    const store = readLocalStore();
    store.reports.push(report);
    writeLocalStore(store);
  }

  public async listReportsByOwner(ownerUid: string): Promise<ReportRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('reports')
        .select('*')
        .eq('owner_uid', ownerUid)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Supabase list reports error: ${error.message}`);
      return (data ?? []) as ReportRecord[];
    }

    const store = readLocalStore();
    return store.reports
      .filter((r) => r.owner_uid === ownerUid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  // User registry & admin control-center helpers
  public upsertUserRecord(user: ManagedUserRecord): void {
    const store = readLocalStore();
    const idx = store.users.findIndex((u) => u.uid === user.uid);
    if (idx >= 0) {
      store.users[idx] = { ...store.users[idx], ...user };
    } else {
      store.users.push(user);
    }
    writeLocalStore(store);
  }

  public updateUserStatusOrRole(
    uid: string,
    updates: { role?: 'researcher' | 'admin'; status?: 'active' | 'suspended' }
  ): ManagedUserRecord | null {
    const store = readLocalStore();
    const idx = store.users.findIndex((u) => u.uid === uid);
    if (idx === -1) return null;
    store.users[idx] = { ...store.users[idx], ...updates };
    writeLocalStore(store);
    return store.users[idx];
  }

  public deleteUserRegistryAndData(uid: string): void {
    const store = readLocalStore();
    store.users = store.users.filter((u) => u.uid !== uid);
    store.reports = store.reports.filter((r) => r.owner_uid !== uid);
    store.biodiversity_metrics = store.biodiversity_metrics.filter((m) => m.owner_uid !== uid);
    store.taxonomy_results = store.taxonomy_results.filter((t) => t.owner_uid !== uid);
    store.analysis_jobs = store.analysis_jobs.filter((j) => j.owner_uid !== uid);
    store.datasets = store.datasets.filter((d) => d.owner_uid !== uid);
    store.samples = store.samples.filter((s) => s.owner_uid !== uid);
    writeLocalStore(store);
  }

  public appendServerActivityLog(log: ServerActivityLog): void {
    const store = readLocalStore();
    store.activity_logs.unshift(log);
    store.activity_logs = store.activity_logs.slice(0, 500);
    writeLocalStore(store);
  }

  public getSystemSettings(): SystemSettingsRecord {
    return readLocalStore().system_settings;
  }

  public updateSystemSettings(settings: SystemSettingsRecord): SystemSettingsRecord {
    const store = readLocalStore();
    store.system_settings = settings;
    writeLocalStore(store);
    return store.system_settings;
  }

  // Admin-only full inventory reads
  public async adminListAllDatasets(): Promise<DatasetRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('datasets')
        .select('*, sample:samples(*)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as DatasetRecord[];
    }
    const store = readLocalStore();
    const sampleMap = new Map(store.samples.map((s) => [s.id, s]));
    return [...store.datasets]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((d) => ({ ...d, sample: sampleMap.get(d.sample_id) }));
  }

  public async adminListAllAnalyses(): Promise<AnalysisJobRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .order('started_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AnalysisJobRecord[];
    }
    const store = readLocalStore();
    return [...store.analysis_jobs].sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  public async adminListAllReports(): Promise<ReportRecord[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportRecord[];
    }
    const store = readLocalStore();
    return [...store.reports].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public adminListUsers(): ManagedUserRecord[] {
    return readLocalStore().users;
  }

  public adminListActivityLogs(): ServerActivityLog[] {
    return readLocalStore().activity_logs;
  }
}

export const dbService = new StorageAndDbService();
