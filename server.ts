import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
  type AuthenticatedRequest,
  requireAdmin,
  requireAuth,
  setUidAdminRole,
  setUidSuspended,
  trySetFirebaseCustomClaims,
} from './server/middleware/auth.ts';
import { parseAndValidateDataset, runEdnaBioinformaticsPipeline } from './server/services/ednaEngine.ts';
import { generateScientificExplanation } from './server/services/geminiAssistant.ts';
import { buildSampleDataset } from './server/services/sampleGenerator.ts';
import { dbService } from './server/services/storageAndDb.ts';
import type { DatasetRecord, ReportRecord, SampleRecord } from './server/types.ts';

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_EXTENSIONS = new Set(['fasta', 'fa', 'fna', 'fastq', 'fq', 'csv']);

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function getSafeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Security headers compatible with iframe preview
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute before retrying.' },
  });

  const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for heavy upload/AI operations.' },
  });

  app.use('/api', apiLimiter);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // Hard ceiling; dynamic setting enforced inside handler
      files: 1,
    },
  });

  // Public system status endpoint (no secrets exposed)
  app.get('/api/health', (_req: Request, res: Response) => {
    const settings = dbService.getSystemSettings();
    res.json({
      status: 'ok',
      supabaseConfigured: dbService.isSupabaseConfigured(),
      analysisMode: process.env.NCBI_BLAST_ENABLED === 'true' ? 'NCBI_LIVE' : 'DEMO_MODE',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      maxFileSizeMb: settings.maxFileSizeMb,
      allowRegistration: settings.allowRegistration,
      maintenanceMode: settings.maintenanceMode,
      defaultConfidenceThreshold: settings.defaultConfidenceThreshold,
    });
  });

  // Public sample eDNA file download for testing the real pipeline
  app.get('/api/sample-files/:format', (req: Request, res: Response) => {
    const format = String(req.params.format || '').toLowerCase();
    if (format !== 'fasta' && format !== 'fastq' && format !== 'csv') {
      res.status(400).json({ error: 'Unsupported sample format. Use fasta, fastq, or csv.' });
      return;
    }
    const sample = buildSampleDataset(format);
    res.setHeader('Content-Type', sample.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${sample.filename}"`);
    res.send(sample.content);
  });

  // Sync authenticated researcher profile with backend registry & return verified RBAC role
  app.post('/api/profile/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const fullName = getSafeString(req.body?.fullName, 120) || user.name;
    const organization = getSafeString(req.body?.organization, 160);
    const now = new Date().toISOString();

    dbService.upsertUserRecord({
      uid: user.uid,
      email: user.email,
      fullName,
      organization,
      role: user.role,
      status: 'active',
      emailVerified: user.emailVerified,
      lastSeenAt: now,
      createdAt: now,
    });

    res.json({
      uid: user.uid,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
      emailVerified: user.emailVerified,
    });
  });

  // List datasets owned by authenticated user
  app.get('/api/datasets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const datasets = await dbService.listDatasetsByOwner(req.user!.uid);
      res.json({ datasets });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load datasets.' });
    }
  });

  // Upload eDNA dataset (FASTA, FASTQ, CSV)
  app.post(
    '/api/datasets/upload',
    requireAuth,
    heavyLimiter,
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const settings = dbService.getSystemSettings();
        if (settings.maintenanceMode && !req.user!.isAdmin) {
          res.status(503).json({ error: 'Platform is currently in maintenance mode for uploads.' });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'No dataset file provided.' });
          return;
        }

        const maxBytes = settings.maxFileSizeMb * 1024 * 1024;
        if (file.size > maxBytes) {
          res.status(400).json({ error: `File exceeds maximum allowed size of ${settings.maxFileSizeMb} MB.` });
          return;
        }

        const safeFileName = sanitizeFilename(file.originalname || 'dataset.fasta');
        const ext = safeFileName.split('.').pop()?.toLowerCase() ?? '';
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          res.status(400).json({
            error: 'Unsupported file format. Accepted formats: FASTA (.fasta, .fa, .fna), FASTQ (.fastq, .fq), or CSV (.csv).',
          });
          return;
        }

        const datasetName = getSafeString(req.body?.datasetName, 140);
        const sampleCode = getSafeString(req.body?.sampleCode, 80);
        const sampleLocation = getSafeString(req.body?.sampleLocation, 180);
        const sampleType = getSafeString(req.body?.sampleType, 80);
        const collectionDate = getSafeString(req.body?.collectionDate, 32);
        const environmentalDescription = getSafeString(req.body?.environmentalDescription, 800);
        const researchNotes = getSafeString(req.body?.researchNotes, 1000);

        if (!datasetName || !sampleCode || !sampleLocation || !sampleType || !collectionDate || !environmentalDescription) {
          res.status(400).json({
            error: 'Dataset name, sample ID, location, sample type, collection date, and environmental description are required.',
          });
          return;
        }

        const rawText = file.buffer.toString('utf-8');
        const parsed = parseAndValidateDataset(rawText, safeFileName);
        if (parsed.validationErrors.length > 0 && parsed.records.length === 0) {
          res.status(400).json({
            error: parsed.validationErrors.join(' '),
            qcSummary: parsed.qcSummary,
          });
          return;
        }

        const now = new Date().toISOString();
        const sampleId = randomUUID();
        const datasetId = randomUUID();
        const storagePath = `${req.user!.uid}/${datasetId}/${safeFileName}`;

        await dbService.uploadPrivateFile('edna-datasets', storagePath, file.buffer, file.mimetype || 'text/plain');

        const sample: SampleRecord = {
          id: sampleId,
          owner_uid: req.user!.uid,
          sample_code: sampleCode,
          sample_location: sampleLocation,
          sample_type: sampleType,
          collection_date: collectionDate,
          environmental_description: environmentalDescription,
          research_notes: researchNotes,
          created_at: now,
        };

        const dataset: DatasetRecord = {
          id: datasetId,
          owner_uid: req.user!.uid,
          sample_id: sampleId,
          dataset_name: datasetName,
          file_name: safeFileName,
          file_format: parsed.format,
          file_size_bytes: file.size,
          storage_bucket: 'edna-datasets',
          storage_path: storagePath,
          sequence_count: parsed.qcSummary.validReads,
          mean_quality_score: parsed.qcSummary.meanPhredScore,
          gc_content_percent: parsed.qcSummary.gcContentPercent,
          validation_status: parsed.qcSummary.rejectedReads > 0 ? 'validated_with_warnings' : 'validated',
          created_at: now,
        };

        await dbService.insertSampleAndDataset(sample, dataset);

        dbService.appendServerActivityLog({
          id: randomUUID(),
          userId: req.user!.uid,
          actorEmail: req.user!.email,
          action: 'DATASET_UPLOADED',
          resourceType: 'dataset',
          resourceId: datasetId,
          details: `Uploaded ${datasetName} (${parsed.format}, ${parsed.qcSummary.validReads} valid sequences)`,
          createdAt: now,
        });

        res.status(201).json({
          dataset: { ...dataset, sample },
          qcSummary: parsed.qcSummary,
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Dataset upload failed.' });
      }
    }
  );

  // Download own dataset raw file (strictly owner-verified)
  app.get('/api/datasets/:id/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dataset = await dbService.getDatasetById(String(req.params.id));
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found.' });
        return;
      }
      if (dataset.owner_uid !== req.user!.uid && !req.user!.isAdmin) {
        res.status(403).json({ error: 'Forbidden: You do not have access to this dataset.' });
        return;
      }
      const buffer = await dbService.downloadPrivateFile('edna-datasets', dataset.storage_path);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(dataset.file_name)}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to download dataset.' });
    }
  });

  // Delete own dataset & cascade records (strictly owner-verified)
  app.delete('/api/datasets/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dataset = await dbService.getDatasetById(String(req.params.id));
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found.' });
        return;
      }
      if (dataset.owner_uid !== req.user!.uid && !req.user!.isAdmin) {
        res.status(403).json({ error: 'Forbidden: Only the dataset owner can delete this record.' });
        return;
      }
      await dbService.deleteDatasetCascade(dataset.id);
      dbService.appendServerActivityLog({
        id: randomUUID(),
        userId: req.user!.uid,
        actorEmail: req.user!.email,
        action: 'DATASET_DELETED',
        resourceType: 'dataset',
        resourceId: dataset.id,
        details: `Deleted dataset ${dataset.dataset_name} and linked analyses/reports`,
        createdAt: new Date().toISOString(),
      });
      res.json({ deleted: true, datasetId: dataset.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete dataset.' });
    }
  });

  // Run eDNA bioinformatics analysis on an owned dataset
  app.post('/api/analysis/run', requireAuth, heavyLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = dbService.getSystemSettings();
      if (settings.maintenanceMode && !req.user!.isAdmin) {
        res.status(503).json({ error: 'Platform is currently in maintenance mode.' });
        return;
      }

      const datasetId = getSafeString(req.body?.datasetId, 128);
      if (!datasetId) {
        res.status(400).json({ error: 'datasetId is required.' });
        return;
      }

      const dataset = await dbService.getDatasetById(datasetId);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found.' });
        return;
      }
      if (dataset.owner_uid !== req.user!.uid) {
        res.status(403).json({ error: 'Forbidden: Cannot analyze another researcher’s dataset.' });
        return;
      }

      const fileBuffer = await dbService.downloadPrivateFile('edna-datasets', dataset.storage_path);
      const rawText = fileBuffer.toString('utf-8');
      const threshold =
        typeof req.body?.confidenceThreshold === 'number'
          ? Math.min(99, Math.max(50, req.body.confidenceThreshold))
          : settings.defaultConfidenceThreshold;

      const output = await runEdnaBioinformaticsPipeline({
        ownerUid: req.user!.uid,
        datasetId: dataset.id,
        rawFileText: rawText,
        fileName: dataset.file_name,
        confidenceThreshold: threshold,
      });

      await dbService.saveAnalysisOutput(output.job, output.taxonomyResults, output.biodiversityMetrics);

      dbService.appendServerActivityLog({
        id: randomUUID(),
        userId: req.user!.uid,
        actorEmail: req.user!.email,
        action: 'ANALYSIS_COMPLETED',
        resourceType: 'analysis',
        resourceId: output.job.id,
        details: `Completed ${output.job.analysis_mode} analysis on ${dataset.dataset_name}: ${output.job.matched_sequences}/${output.job.valid_sequences} matched`,
        createdAt: new Date().toISOString(),
      });

      res.status(201).json(output);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis pipeline failed.' });
    }
  });

  // List analysis jobs for current user
  app.get('/api/analysis/jobs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobs = await dbService.listAnalysisJobsByOwner(req.user!.uid);
      res.json({ jobs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load analysis jobs.' });
    }
  });

  // Get specific analysis job + metrics + taxonomy (ownership checked)
  app.get('/api/analysis/jobs/:jobId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const job = await dbService.getAnalysisJobById(String(req.params.jobId));
      if (!job) {
        res.status(404).json({ error: 'Analysis job not found.' });
        return;
      }
      if (job.owner_uid !== req.user!.uid && !req.user!.isAdmin) {
        res.status(403).json({ error: 'Forbidden: Cross-user access denied.' });
        return;
      }
      const [taxonomy, metricsList, dataset] = await Promise.all([
        dbService.listTaxonomyResultsByOwner(job.owner_uid, job.id),
        dbService.listBiodiversityMetricsByOwner(job.owner_uid, job.id),
        dbService.getDatasetById(job.dataset_id),
      ]);
      res.json({
        job,
        dataset,
        taxonomyResults: taxonomy,
        biodiversityMetrics: metricsList[0] ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch analysis details.' });
    }
  });

  // Paginated, searchable, filterable, sortable taxonomy results for current user
  app.get('/api/taxonomy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = getSafeString(req.query.jobId, 128) || undefined;
      const datasetId = getSafeString(req.query.datasetId, 128) || undefined;
      const search = getSafeString(req.query.search, 120).toLowerCase();
      const confidence = getSafeString(req.query.confidence, 32);
      const kingdom = getSafeString(req.query.kingdom, 60);
      const sortBy = getSafeString(req.query.sortBy, 32) || 'match_percentage';
      const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.min(100, Math.max(5, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20));

      let rows = await dbService.listTaxonomyResultsByOwner(req.user!.uid, jobId);
      if (datasetId) {
        rows = rows.filter((r) => r.dataset_id === datasetId);
      }
      if (confidence && confidence !== 'All') {
        rows = rows.filter((r) => r.confidence_level === confidence);
      }
      if (kingdom && kingdom !== 'All') {
        rows = rows.filter((r) => r.kingdom === kingdom);
      }
      if (search) {
        rows = rows.filter((r) =>
          [r.sequence_id, r.kingdom, r.phylum, r.class_name, r.order_name, r.family, r.genus, r.species, r.reference_accession]
            .join(' ')
            .toLowerCase()
            .includes(search)
        );
      }

      rows.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'match_percentage') cmp = a.match_percentage - b.match_percentage;
        else if (sortBy === 'read_abundance') cmp = a.read_abundance - b.read_abundance;
        else if (sortBy === 'species') cmp = a.species.localeCompare(b.species);
        else if (sortBy === 'sequence_id') cmp = a.sequence_id.localeCompare(b.sequence_id);
        else cmp = a.match_percentage - b.match_percentage;
        return sortDir === 'asc' ? cmp : -cmp;
      });

      const total = rows.length;
      const start = (page - 1) * pageSize;
      const items = rows.slice(start, start + pageSize);

      res.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load taxonomy results.' });
    }
  });

  // Biodiversity metrics for current user
  app.get('/api/biodiversity', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = getSafeString(req.query.jobId, 128) || undefined;
      const metrics = await dbService.listBiodiversityMetricsByOwner(req.user!.uid, jobId);
      res.json({ metrics });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch biodiversity metrics.' });
    }
  });

  // Reports list & archival
  app.get('/api/reports', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reports = await dbService.listReportsByOwner(req.user!.uid);
      res.json({ reports });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load reports.' });
    }
  });

  app.post('/api/reports/record', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const datasetId = getSafeString(req.body?.datasetId, 128);
      const jobId = getSafeString(req.body?.jobId, 128);
      const reportTitle = getSafeString(req.body?.reportTitle, 180);
      const exportFormat = req.body?.exportFormat === 'CSV' ? 'CSV' : 'PDF';
      const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : undefined;

      const dataset = await dbService.getDatasetById(datasetId);
      const job = await dbService.getAnalysisJobById(jobId);
      if (!dataset || !job) {
        res.status(404).json({ error: 'Referenced dataset or analysis job not found.' });
        return;
      }
      if (dataset.owner_uid !== req.user!.uid || job.owner_uid !== req.user!.uid) {
        res.status(403).json({ error: 'Forbidden: Cannot archive report for another researcher.' });
        return;
      }

      const reportId = randomUUID();
      const ext = exportFormat === 'CSV' ? 'csv' : 'pdf';
      const storagePath = `${req.user!.uid}/${datasetId}/${reportId}.${ext}`;
      const report: ReportRecord = {
        id: reportId,
        owner_uid: req.user!.uid,
        dataset_id: datasetId,
        job_id: jobId,
        report_title: reportTitle || `${dataset.dataset_name} (${exportFormat})`,
        export_format: exportFormat,
        storage_bucket: 'generated-reports',
        storage_path: storagePath,
        created_at: new Date().toISOString(),
      };

      const fileBuffer = contentBase64 ? Buffer.from(contentBase64, 'base64') : undefined;
      await dbService.saveReport(report, fileBuffer);

      dbService.appendServerActivityLog({
        id: randomUUID(),
        userId: req.user!.uid,
        actorEmail: req.user!.email,
        action: 'REPORT_EXPORTED',
        resourceType: 'report',
        resourceId: reportId,
        details: `Generated ${exportFormat} report "${report.report_title}"`,
        createdAt: report.created_at,
      });

      res.status(201).json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save report.' });
    }
  });

  app.get('/api/reports/:reportId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reportId = String(req.params.reportId);
      const reports = req.user!.isAdmin
        ? await dbService.adminListAllReports()
        : await dbService.listReportsByOwner(req.user!.uid);
      const report = reports.find((r) => r.id === reportId);
      if (!report) {
        res.status(404).json({ error: 'Report not found or access denied.' });
        return;
      }
      const buf = await dbService.downloadPrivateFile('generated-reports', report.storage_path);
      const contentType = report.export_format === 'CSV' ? 'text/csv' : 'application/pdf';
      const ext = report.export_format === 'CSV' ? 'csv' : 'pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(report.report_title)}.${ext}"`);
      res.send(buf);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to download report.' });
    }
  });

  // Gemini AI Research Assistant (server-side only, grounded in verified results)
  app.post('/api/ai/explain', requireAuth, heavyLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = getSafeString(req.body?.jobId, 128);
      const question = getSafeString(req.body?.question, 800);
      const modeRaw = req.body?.mode;
      const mode =
        modeRaw === 'explain_taxonomy' || modeRaw === 'summarize_report' || modeRaw === 'ecological_patterns'
          ? modeRaw
          : 'qa';

      if (!jobId) {
        res.status(400).json({ error: 'jobId is required for grounded AI interpretation.' });
        return;
      }

      const job = await dbService.getAnalysisJobById(jobId);
      if (!job) {
        res.status(404).json({ error: 'Analysis job not found.' });
        return;
      }
      if (job.owner_uid !== req.user!.uid && !req.user!.isAdmin) {
        res.status(403).json({ error: 'Forbidden: Cross-user access denied.' });
        return;
      }

      const [dataset, taxonomy, metricsList] = await Promise.all([
        dbService.getDatasetById(job.dataset_id),
        dbService.listTaxonomyResultsByOwner(job.owner_uid, job.id),
        dbService.listBiodiversityMetricsByOwner(job.owner_uid, job.id),
      ]);

      if (!dataset) {
        res.status(404).json({ error: 'Parent dataset not found.' });
        return;
      }

      const explanation = await generateScientificExplanation({
        question: question || 'Summarize key taxonomic findings and ecological biodiversity indicators.',
        mode,
        dataset,
        job,
        metrics: metricsList[0] ?? null,
        taxonomy,
      });

      dbService.appendServerActivityLog({
        id: randomUUID(),
        userId: req.user!.uid,
        actorEmail: req.user!.email,
        action: 'AI_INTERPRETATION',
        resourceType: 'analysis',
        resourceId: job.id,
        details: `Requested Gemini interpretation (${mode}) for ${dataset.dataset_name}`,
        createdAt: new Date().toISOString(),
      });

      res.json({ explanation, model: 'gemini-4-hydrogen', groundedOnJobId: job.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Research Assistant failed.' });
    }
  });

  // =========================================================================
  // PROTECTED ADMIN CONTROL CENTER ENDPOINTS (/api/control-center/*)
  // Every route requires valid Firebase ID token + verified Admin role
  // =========================================================================

  app.get('/api/control-center/overview', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const [datasets, analyses, reports] = await Promise.all([
        dbService.adminListAllDatasets(),
        dbService.adminListAllAnalyses(),
        dbService.adminListAllReports(),
      ]);
      const users = dbService.adminListUsers();
      const logs = dbService.adminListActivityLogs();
      const settings = dbService.getSystemSettings();

      res.json({
        stats: {
          totalUsers: users.length,
          totalDatasets: datasets.length,
          totalAnalyses: analyses.length,
          totalReports: reports.length,
          supabaseConfigured: dbService.isSupabaseConfigured(),
          analysisMode: process.env.NCBI_BLAST_ENABLED === 'true' ? 'NCBI_LIVE' : 'DEMO_MODE',
        },
        users,
        datasets,
        analyses,
        reports,
        logs,
        settings,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load control center.' });
    }
  });

  app.patch('/api/control-center/users/:uid', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const targetUid = String(req.params.uid);
    const status = req.body?.status === 'suspended' ? 'suspended' : req.body?.status === 'active' ? 'active' : undefined;
    const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'researcher' ? 'researcher' : undefined;

    if (targetUid === req.user!.uid && (status === 'suspended' || role === 'researcher')) {
      res.status(400).json({ error: 'Administrators cannot suspend or demote their own active session.' });
      return;
    }

    if (status !== undefined) {
      setUidSuspended(targetUid, status === 'suspended');
    }
    let claimsSynced = false;
    if (role !== undefined) {
      setUidAdminRole(targetUid, role === 'admin');
      claimsSynced = await trySetFirebaseCustomClaims(targetUid, role);
    }

    const updated = dbService.updateUserStatusOrRole(targetUid, {
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
    });

    dbService.appendServerActivityLog({
      id: randomUUID(),
      userId: req.user!.uid,
      actorEmail: req.user!.email,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'system',
      resourceId: targetUid,
      details: `Updated user ${targetUid} (status=${status ?? 'unchanged'}, role=${role ?? 'unchanged'}, claimsSynced=${claimsSynced})`,
      createdAt: new Date().toISOString(),
    });

    res.json({ user: updated, claimsSynced });
  });

  app.delete('/api/control-center/users/:uid', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const targetUid = String(req.params.uid);
    if (targetUid === req.user!.uid) {
      res.status(400).json({ error: 'Cannot delete your own administrator account.' });
      return;
    }

    const datasets = await dbService.listDatasetsByOwner(targetUid);
    for (const ds of datasets) {
      await dbService.deleteDatasetCascade(ds.id);
    }
    dbService.deleteUserRegistryAndData(targetUid);
    setUidSuspended(targetUid, true);

    dbService.appendServerActivityLog({
      id: randomUUID(),
      userId: req.user!.uid,
      actorEmail: req.user!.email,
      action: 'ADMIN_USER_DELETED',
      resourceType: 'system',
      resourceId: targetUid,
      details: `Removed user ${targetUid} and purged ${datasets.length} datasets`,
      createdAt: new Date().toISOString(),
    });

    res.json({ deleted: true, uid: targetUid });
  });

  app.delete('/api/control-center/datasets/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const datasetId = String(req.params.id);
    await dbService.deleteDatasetCascade(datasetId);
    dbService.appendServerActivityLog({
      id: randomUUID(),
      userId: req.user!.uid,
      actorEmail: req.user!.email,
      action: 'ADMIN_DATASET_DELETED',
      resourceType: 'dataset',
      resourceId: datasetId,
      details: `Administrator removed dataset ${datasetId}`,
      createdAt: new Date().toISOString(),
    });
    res.json({ deleted: true, datasetId });
  });

  app.put('/api/control-center/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const maxFileSizeMb = Math.min(100, Math.max(1, Number(req.body?.maxFileSizeMb ?? 10)));
    const defaultConfidenceThreshold = Math.min(99, Math.max(50, Number(req.body?.defaultConfidenceThreshold ?? 85)));
    const allowRegistration = Boolean(req.body?.allowRegistration ?? true);
    const maintenanceMode = Boolean(req.body?.maintenanceMode ?? false);

    const updated = dbService.updateSystemSettings({
      maxFileSizeMb,
      defaultConfidenceThreshold,
      allowRegistration,
      maintenanceMode,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.email,
    });

    dbService.appendServerActivityLog({
      id: randomUUID(),
      userId: req.user!.uid,
      actorEmail: req.user!.email,
      action: 'SYSTEM_SETTINGS_UPDATED',
      resourceType: 'system',
      resourceId: 'global',
      details: `Updated settings (maxMb=${maxFileSizeMb}, threshold=${defaultConfidenceThreshold}%, maintenance=${maintenanceMode})`,
      createdAt: new Date().toISOString(),
    });

    res.json({ settings: updated });
  });

  // Catch-all for unknown /api/* routes (never return HTML for API)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Frontend serving: Vite middleware in development, static dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Ensure data directory exists on boot
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoDNA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EcoDNA server:', err);
  process.exit(1);
});
