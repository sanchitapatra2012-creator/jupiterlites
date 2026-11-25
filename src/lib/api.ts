import { auth } from './firebase';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  HealthStatus,
  QcSummary,
  ReportRecord,
  TaxonomyResultRecord,
} from '../types/ecodna';

async function getIdTokenOrThrow(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }
  return user.getIdToken();
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdTokenOrThrow();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const errJson = (await res.json()) as { error?: string };
      throw new Error(errJson.error || `Request failed (${res.status})`);
    }
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error('Unable to reach EcoDNA backend health endpoint.');
  }
  return (await res.json()) as HealthStatus;
}

export async function syncProfileWithBackend(payload: { fullName?: string; organization?: string }): Promise<{
  uid: string;
  email: string;
  role: 'researcher' | 'admin';
  isAdmin: boolean;
  emailVerified: boolean;
}> {
  return apiRequest('/api/profile/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDatasets(): Promise<DatasetRecord[]> {
  const data = await apiRequest<{ datasets: DatasetRecord[] }>('/api/datasets');
  return data.datasets;
}

export async function uploadDatasetWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ dataset: DatasetRecord; qcSummary: QcSummary }> {
  const token = await getIdTokenOrThrow();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/datasets/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as {
          dataset?: DatasetRecord;
          qcSummary?: QcSummary;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && parsed.dataset && parsed.qcSummary) {
          onProgress(100);
          resolve({ dataset: parsed.dataset, qcSummary: parsed.qcSummary });
        } else {
          reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during dataset upload.'));
    xhr.send(formData);
  });
}

export async function downloadProtectedFile(url: string, filename: string): Promise<void> {
  const token = await getIdTokenOrThrow();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Download failed.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function deleteDataset(datasetId: string): Promise<void> {
  await apiRequest(`/api/datasets/${encodeURIComponent(datasetId)}`, { method: 'DELETE' });
}

export async function runAnalysisPipeline(datasetId: string, confidenceThreshold?: number): Promise<{
  job: AnalysisJobRecord;
  taxonomyResults: TaxonomyResultRecord[];
  biodiversityMetrics: BiodiversityMetricsRecord;
}> {
  return apiRequest('/api/analysis/run', {
    method: 'POST',
    body: JSON.stringify({ datasetId, confidenceThreshold }),
  });
}

export async function fetchAnalysisJobs(): Promise<AnalysisJobRecord[]> {
  const data = await apiRequest<{ jobs: AnalysisJobRecord[] }>('/api/analysis/jobs');
  return data.jobs;
}

export async function fetchAnalysisJobDetails(jobId: string): Promise<{
  job: AnalysisJobRecord;
  dataset: DatasetRecord | null;
  taxonomyResults: TaxonomyResultRecord[];
  biodiversityMetrics: BiodiversityMetricsRecord | null;
}> {
  return apiRequest(`/api/analysis/jobs/${encodeURIComponent(jobId)}`);
}

export async function fetchTaxonomyResults(params: {
  jobId?: string;
  datasetId?: string;
  search?: string;
  confidence?: string;
  kingdom?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<{
  items: TaxonomyResultRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const qs = new URLSearchParams();
  if (params.jobId) qs.set('jobId', params.jobId);
  if (params.datasetId) qs.set('datasetId', params.datasetId);
  if (params.search) qs.set('search', params.search);
  if (params.confidence) qs.set('confidence', params.confidence);
  if (params.kingdom) qs.set('kingdom', params.kingdom);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  return apiRequest(`/api/taxonomy?${qs.toString()}`);
}

export async function fetchBiodiversityMetrics(jobId?: string): Promise<BiodiversityMetricsRecord[]> {
  const qs = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const data = await apiRequest<{ metrics: BiodiversityMetricsRecord[] }>(`/api/biodiversity${qs}`);
  return data.metrics;
}

export async function fetchReports(): Promise<ReportRecord[]> {
  const data = await apiRequest<{ reports: ReportRecord[] }>('/api/reports');
  return data.reports;
}

export async function saveGeneratedReport(payload: {
  datasetId: string;
  jobId: string;
  reportTitle: string;
  exportFormat: 'PDF' | 'CSV';
  contentBase64?: string;
}): Promise<ReportRecord> {
  const data = await apiRequest<{ report: ReportRecord }>('/api/reports/record', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.report;
}

export async function askAiResearchAssistant(payload: {
  jobId: string;
  mode: 'explain_taxonomy' | 'summarize_report' | 'ecological_patterns' | 'qa';
  question?: string;
}): Promise<{ explanation: string; model: string; groundedOnJobId: string }> {
  return apiRequest('/api/ai/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Protected Control Center Admin API
export async function fetchAdminOverview() {
  return apiRequest<{
    stats: {
      totalUsers: number;
      totalDatasets: number;
      totalAnalyses: number;
      totalReports: number;
      supabaseConfigured: boolean;
      analysisMode: string;
    };
    users: Array<{
      uid: string;
      email: string;
      fullName: string;
      organization: string;
      role: 'researcher' | 'admin';
      status: 'active' | 'suspended';
      emailVerified: boolean;
      lastSeenAt: string;
      createdAt: string;
    }>;
    datasets: DatasetRecord[];
    analyses: AnalysisJobRecord[];
    reports: ReportRecord[];
    logs: Array<{
      id: string;
      userId: string;
      actorEmail: string;
      action: string;
      resourceType: string;
      resourceId: string;
      details: string;
      createdAt: string;
    }>;
    settings: {
      maxFileSizeMb: number;
      allowRegistration: boolean;
      maintenanceMode: boolean;
      defaultConfidenceThreshold: number;
      updatedAt: string;
      updatedBy: string;
    };
  }>('/api/control-center/overview');
}

export async function adminUpdateUser(uid: string, updates: { status?: 'active' | 'suspended'; role?: 'researcher' | 'admin' }) {
  return apiRequest(`/api/control-center/users/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function adminDeleteUser(uid: string) {
  return apiRequest(`/api/control-center/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
}

export async function adminDeleteDataset(datasetId: string) {
  return apiRequest(`/api/control-center/datasets/${encodeURIComponent(datasetId)}`, { method: 'DELETE' });
}

export async function adminUpdateSettings(settings: {
  maxFileSizeMb: number;
  allowRegistration: boolean;
  maintenanceMode: boolean;
  defaultConfidenceThreshold: number;
}) {
  return apiRequest('/api/control-center/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
