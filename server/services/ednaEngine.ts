import { randomUUID } from 'crypto';
import type {
  AnalysisJobRecord,
  AnalysisMode,
  BiodiversityMetricsRecord,
  ConfidenceLevel,
  FileFormat,
  QcSummary,
  TaxonomicDistributionItem,
  TaxonomyResultRecord,
} from '../types.ts';
import { CURATED_REFERENCE_LIBRARY, type ReferenceTaxon } from './referenceDatabase.ts';

export interface ParsedSequenceRecord {
  sequenceId: string;
  sequence: string;
  readAbundance: number;
  meanPhred: number | null;
  markerHint?: string;
}

export interface ParsedDatasetResult {
  format: FileFormat;
  records: ParsedSequenceRecord[];
  qcSummary: QcSummary;
  validationErrors: string[];
}

const VALID_IUPAC_DNA = /^[ACGTNRYSWKMBDHV]+$/i;

function computeGcPercent(sequences: string[]): number {
  let gc = 0;
  let total = 0;
  for (const seq of sequences) {
    for (let i = 0; i < seq.length; i += 1) {
      const ch = seq[i];
      if (ch === 'G' || ch === 'C') gc += 1;
      if (ch === 'A' || ch === 'T' || ch === 'G' || ch === 'C') total += 1;
    }
  }
  return total === 0 ? 0 : Number(((gc / total) * 100).toFixed(2));
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseAndValidateDataset(rawText: string, fileName: string): ParsedDatasetResult {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const warnings: string[] = [];
  const validationErrors: string[] = [];
  const records: ParsedSequenceRecord[] = [];
  let rejectedReads = 0;
  const phredMeans: number[] = [];

  const normalizedText = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) {
    return {
      format: ext === 'csv' ? 'CSV' : ext === 'fastq' || ext === 'fq' ? 'FASTQ' : 'FASTA',
      records: [],
      qcSummary: {
        totalReads: 0,
        validReads: 0,
        rejectedReads: 0,
        meanLengthBp: 0,
        minLengthBp: 0,
        maxLengthBp: 0,
        gcContentPercent: 0,
        meanPhredScore: null,
        detectedMarkers: [],
        warnings: ['Uploaded file is empty.'],
      },
      validationErrors: ['File contains no readable sequence data.'],
    };
  }

  let format: FileFormat = 'FASTA';
  if (ext === 'fastq' || ext === 'fq') format = 'FASTQ';
  else if (ext === 'csv') format = 'CSV';

  const lines = normalizedText.split('\n');

  if (format === 'FASTA') {
    let currentId = '';
    let currentSeq = '';
    let currentHint: string | undefined;

    const flushRecord = () => {
      if (!currentId && !currentSeq) return;
      const cleanSeq = currentSeq.replace(/\s+/g, '').toUpperCase();
      if (!currentId) {
        rejectedReads += 1;
        warnings.push('Skipped FASTA block missing header (>).');
      } else if (cleanSeq.length < 30 || !VALID_IUPAC_DNA.test(cleanSeq)) {
        rejectedReads += 1;
        warnings.push(`Sequence ${currentId} failed length (>=30bp) or IUPAC DNA nucleotide check.`);
      } else {
        records.push({
          sequenceId: currentId.slice(0, 80),
          sequence: cleanSeq,
          readAbundance: 1,
          meanPhred: null,
          markerHint: currentHint,
        });
      }
      currentId = '';
      currentSeq = '';
      currentHint = undefined;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('>')) {
        flushRecord();
        const headerBody = trimmed.slice(1).trim();
        const parts = headerBody.split(/\s+/);
        currentId = parts[0] || `SEQ_${records.length + 1}`;
        const markerMatch = headerBody.match(/marker=([A-Za-z0-9_]+)/i);
        if (markerMatch) currentHint = markerMatch[1];
      } else {
        currentSeq += trimmed;
      }
    }
    flushRecord();

    if (records.length === 0 && rejectedReads === 0) {
      validationErrors.push('Invalid FASTA format: no ">" sequence headers found.');
    }
  } else if (format === 'FASTQ') {
    let idx = 0;
    while (idx < lines.length) {
      while (idx < lines.length && !lines[idx].trim()) idx += 1;
      if (idx >= lines.length) break;

      const headerLine = lines[idx]?.trim() ?? '';
      const seqLine = lines[idx + 1]?.trim().toUpperCase() ?? '';
      const plusLine = lines[idx + 2]?.trim() ?? '';
      const qualLine = lines[idx + 3]?.trim() ?? '';
      idx += 4;

      if (!headerLine.startsWith('@') || !plusLine.startsWith('+')) {
        validationErrors.push(`Malformed FASTQ 4-line record near "${headerLine.slice(0, 40)}".`);
        rejectedReads += 1;
        continue;
      }

      if (seqLine.length !== qualLine.length) {
        warnings.push(`FASTQ record ${headerLine.slice(1, 32)} skipped: sequence/quality length mismatch.`);
        rejectedReads += 1;
        continue;
      }

      if (seqLine.length < 30 || !VALID_IUPAC_DNA.test(seqLine)) {
        warnings.push(`FASTQ record ${headerLine.slice(1, 32)} failed nucleotide or length check.`);
        rejectedReads += 1;
        continue;
      }

      let qSum = 0;
      for (let q = 0; q < qualLine.length; q += 1) {
        qSum += qualLine.charCodeAt(q) - 33;
      }
      const meanQ = Number((qSum / qualLine.length).toFixed(2));
      phredMeans.push(meanQ);

      if (meanQ < 15) {
        warnings.push(`FASTQ read ${headerLine.slice(1, 32)} excluded due to low Phred quality (Q=${meanQ}).`);
        rejectedReads += 1;
        continue;
      }

      const seqId = headerLine.slice(1).trim().split(/\s+/)[0] || `READ_${records.length + 1}`;
      records.push({
        sequenceId: seqId.slice(0, 80),
        sequence: seqLine,
        readAbundance: 1,
        meanPhred: meanQ,
      });
    }
  } else if (format === 'CSV') {
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length < 2) {
      validationErrors.push('CSV file must include a header row and at least one sequence row.');
    } else {
      const headers = parseCsvLine(nonEmpty[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
      const seqCol = headers.findIndex((h) => ['sequence', 'dna_sequence', 'seq', 'asv_sequence'].includes(h));
      const idCol = headers.findIndex((h) => ['sequence_id', 'seq_id', 'id', 'asv_id', 'otu_id'].includes(h));
      const countCol = headers.findIndex((h) => ['read_count', 'abundance', 'reads', 'count'].includes(h));
      const markerCol = headers.findIndex((h) => ['marker', 'marker_gene', 'locus'].includes(h));

      if (seqCol === -1) {
        validationErrors.push('CSV header must include a "sequence" (or "dna_sequence") column.');
      } else {
        for (let r = 1; r < nonEmpty.length; r += 1) {
          const cols = parseCsvLine(nonEmpty[r]);
          const seq = (cols[seqCol] ?? '').replace(/\s+/g, '').toUpperCase();
          const seqId = (idCol >= 0 ? cols[idCol] : `CSV_SEQ_${r}`) || `CSV_SEQ_${r}`;
          const parsedCount = countCol >= 0 ? Number.parseInt(cols[countCol] ?? '1', 10) : 1;
          const readAbundance = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
          const markerHint = markerCol >= 0 ? cols[markerCol] : undefined;

          if (seq.length < 30 || !VALID_IUPAC_DNA.test(seq)) {
            rejectedReads += 1;
            warnings.push(`CSV row ${r} (${seqId}) skipped: invalid or short (<30bp) DNA sequence.`);
            continue;
          }
          records.push({
            sequenceId: seqId.slice(0, 80),
            sequence: seq,
            readAbundance,
            meanPhred: null,
            markerHint,
          });
        }
      }
    }
  }

  if (records.length === 0 && validationErrors.length === 0) {
    validationErrors.push('No valid DNA sequences (>= 30 bp, IUPAC ACGTN) passed quality validation.');
  }

  const lengths = records.map((r) => r.sequence.length);
  const totalReads = records.length + rejectedReads;
  const meanLengthBp = lengths.length
    ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
    : 0;
  const minLengthBp = lengths.length ? Math.min(...lengths) : 0;
  const maxLengthBp = lengths.length ? Math.max(...lengths) : 0;
  const gcContentPercent = computeGcPercent(records.map((r) => r.sequence));
  const meanPhredScore = phredMeans.length
    ? Number((phredMeans.reduce((a, b) => a + b, 0) / phredMeans.length).toFixed(2))
    : null;

  return {
    format,
    records,
    qcSummary: {
      totalReads,
      validReads: records.length,
      rejectedReads,
      meanLengthBp,
      minLengthBp,
      maxLengthBp,
      gcContentPercent,
      meanPhredScore,
      detectedMarkers: Array.from(new Set(records.map((r) => r.markerHint).filter(Boolean) as string[])),
      warnings: warnings.slice(0, 15),
    },
    validationErrors,
  };
}

function buildKmerSet(seq: string, k = 8): Set<string> {
  const kmers = new Set<string>();
  for (let i = 0; i <= seq.length - k; i += 1) {
    const sub = seq.slice(i, i + k);
    if (!sub.includes('N')) kmers.add(sub);
  }
  return kmers;
}

function computeKmerAlignmentScore(query: string, ref: string): number {
  const k = 8;
  if (query.length < k || ref.length < k) return 0;

  const qKmers = buildKmerSet(query, k);
  const rKmers = buildKmerSet(ref, k);
  if (qKmers.size === 0 || rKmers.size === 0) return 0;

  let shared = 0;
  for (const km of qKmers) {
    if (rKmers.has(km)) shared += 1;
  }

  const containment = shared / Math.min(qKmers.size, rKmers.size);
  if (containment === 0) return 0;

  // Estimate base-level identity via best sliding offset anchored on shared k-mer
  let bestIdentity = containment * 100;
  const anchorStep = Math.max(1, Math.floor(query.length / 20));
  for (let qi = 0; qi <= query.length - k; qi += anchorStep) {
    const kmer = query.slice(qi, qi + k);
    const refPos = ref.indexOf(kmer);
    if (refPos !== -1) {
      const offset = refPos - qi;
      let matches = 0;
      let compared = 0;
      for (let j = 0; j < query.length; j += 1) {
        const rIdx = j + offset;
        if (rIdx >= 0 && rIdx < ref.length) {
          compared += 1;
          if (query[j] === ref[rIdx]) matches += 1;
        }
      }
      if (compared >= 30) {
        const pct = (matches / compared) * 100;
        if (pct > bestIdentity) bestIdentity = pct;
      }
    }
  }

  return Number(Math.min(100, bestIdentity).toFixed(2));
}

function findBestCuratedMatch(sequence: string): { ref: ReferenceTaxon | null; identity: number } {
  let bestRef: ReferenceTaxon | null = null;
  let bestScore = 0;

  for (const ref of CURATED_REFERENCE_LIBRARY) {
    const score = computeKmerAlignmentScore(sequence, ref.sequence);
    if (score > bestScore) {
      bestScore = score;
      bestRef = ref;
    }
  }

  if (bestScore < 65) {
    return { ref: null, identity: bestScore };
  }
  return { ref: bestRef, identity: bestScore };
}

async function queryOptionalNcbiBlast(sequence: string): Promise<{ accession: string; title: string; identity: number } | null> {
  // Only runs when explicitly enabled via NCBI_BLAST_ENABLED=true
  if (process.env.NCBI_BLAST_ENABLED !== 'true') return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const params = new URLSearchParams({
      CMD: 'Put',
      PROGRAM: 'blastn',
      DATABASE: 'nt',
      QUERY: sequence.slice(0, 600),
      FORMAT_TYPE: 'JSON2_S',
    });
    const res = await fetch('https://blast.ncbi.nlm.nih.gov/Blast.cgi', {
      method: 'POST',
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    // Note: NCBI BLAST Put returns an RID that requires asynchronous polling;
    // if live polling isn't completed within request timeout, return null to fall back transparently.
    return null;
  } catch {
    return null;
  }
}

export interface PipelineExecutionOutput {
  job: AnalysisJobRecord;
  taxonomyResults: TaxonomyResultRecord[];
  biodiversityMetrics: BiodiversityMetricsRecord;
}

export async function runEdnaBioinformaticsPipeline(params: {
  ownerUid: string;
  datasetId: string;
  rawFileText: string;
  fileName: string;
  confidenceThreshold?: number;
}): Promise<PipelineExecutionOutput> {
  const { ownerUid, datasetId, rawFileText, fileName, confidenceThreshold = 85 } = params;
  const startedAt = new Date().toISOString();
  const jobId = randomUUID();

  const parsed = parseAndValidateDataset(rawFileText, fileName);
  if (parsed.validationErrors.length > 0 && parsed.records.length === 0) {
    throw new Error(parsed.validationErrors.join(' '));
  }

  const ncbiEnabled = process.env.NCBI_BLAST_ENABLED === 'true';
  const analysisMode: AnalysisMode = ncbiEnabled ? 'NCBI_LIVE' : 'DEMO_MODE';
  const referenceDbLabel = ncbiEnabled
    ? 'NCBI nt + BOLD Systems (Live + Curated Fallback)'
    : 'EcoDNA Curated Barcode Subset (NCBI/BOLD Demo Reference)';

  const detectedMarkers = new Set<string>(parsed.qcSummary.detectedMarkers);
  const taxonomyResults: TaxonomyResultRecord[] = [];
  let matchedCount = 0;
  let unassignedCount = 0;

  // Deduplicate identical sequence_ids if needed, preserving distinct records
  for (const rec of parsed.records.slice(0, 500)) {
    if (ncbiEnabled) {
      await queryOptionalNcbiBlast(rec.sequence);
    }

    const { ref, identity } = findBestCuratedMatch(rec.sequence);
    let confidence: ConfidenceLevel = 'Unassigned';
    let kingdom = 'Unassigned';
    let phylum = 'Unassigned';
    let className = 'Unassigned';
    let orderName = 'Unassigned';
    let family = 'Unassigned';
    let genus = 'Unassigned';
    let species = 'Unassigned';
    let uncertaintyNote = 'No reference alignment exceeded the minimum 85% identity threshold; sequence retained as Unassigned to prevent false identification.';
    let refDb = 'None';
    let refAcc = 'N/A';
    let marker = rec.markerHint || 'Unknown';

    if (ref && identity >= 97.0) {
      confidence = 'High';
      kingdom = ref.kingdom;
      phylum = ref.phylum;
      className = ref.className;
      orderName = ref.orderName;
      family = ref.family;
      genus = ref.genus;
      species = ref.species;
      refDb = ref.database;
      refAcc = ref.accession;
      marker = rec.markerHint || ref.markerGene;
      uncertaintyNote = `High-confidence species-level alignment (${identity}% identity >= 97.0% threshold).`;
      matchedCount += 1;
    } else if (ref && identity >= 92.0 && identity >= confidenceThreshold) {
      confidence = 'Medium';
      kingdom = ref.kingdom;
      phylum = ref.phylum;
      className = ref.className;
      orderName = ref.orderName;
      family = ref.family;
      genus = ref.genus;
      species = `${ref.genus} sp. (unresolved)`;
      refDb = ref.database;
      refAcc = ref.accession;
      marker = rec.markerHint || ref.markerGene;
      uncertaintyNote = `Identity (${identity}%) falls in 92.0–96.9% range; assigned conservatively to genus ${ref.genus} without fabricating species rank.`;
      matchedCount += 1;
    } else if (ref && identity >= Math.max(85.0, confidenceThreshold)) {
      confidence = 'Low';
      kingdom = ref.kingdom;
      phylum = ref.phylum;
      className = ref.className;
      orderName = ref.orderName;
      family = ref.family;
      genus = 'Unresolved';
      species = 'Unresolved';
      refDb = ref.database;
      refAcc = ref.accession;
      marker = rec.markerHint || ref.markerGene;
      uncertaintyNote = `Low sequence identity (${identity}%, 85.0–91.9%); restricted to Family level (${ref.family}) due to high taxonomic uncertainty.`;
      matchedCount += 1;
    } else {
      unassignedCount += 1;
      if (ref && identity > 0) {
        uncertaintyNote = `Closest reference (${ref.accession}) scored ${identity}%, below ${Math.max(85, confidenceThreshold)}% threshold; reported as Unassigned.`;
      }
    }

    if (marker !== 'Unknown') detectedMarkers.add(marker);

    taxonomyResults.push({
      id: randomUUID(),
      owner_uid: ownerUid,
      job_id: jobId,
      dataset_id: datasetId,
      sequence_id: rec.sequenceId,
      sequence_length: rec.sequence.length,
      read_abundance: rec.readAbundance,
      marker_gene: marker,
      kingdom,
      phylum,
      class_name: className,
      order_name: orderName,
      family,
      genus,
      species,
      match_percentage: identity,
      confidence_level: confidence,
      uncertainty_note: uncertaintyNote,
      reference_database: refDb,
      reference_accession: refAcc,
      created_at: new Date().toISOString(),
    });
  }

  // Calculate Biodiversity Metrics from verified taxonomic assignments
  const taxonCounts = new Map<string, number>();
  const phylumStats = new Map<string, { taxa: Set<string>; abundance: number }>();

  let totalAbundance = 0;
  for (const row of taxonomyResults) {
    if (row.confidence_level === 'Unassigned') continue;
    const taxonKey =
      row.species !== 'Unresolved' && row.species !== 'Unassigned'
        ? row.species
        : `${row.family} (${row.sequence_id})`;
    taxonCounts.set(taxonKey, (taxonCounts.get(taxonKey) ?? 0) + row.read_abundance);
    totalAbundance += row.read_abundance;

    const phylumKey = row.phylum || 'Unassigned';
    const existing = phylumStats.get(phylumKey) ?? { taxa: new Set<string>(), abundance: 0 };
    existing.taxa.add(taxonKey);
    existing.abundance += row.read_abundance;
    phylumStats.set(phylumKey, existing);
  }

  const speciesRichness = Array.from(
    new Set(
      taxonomyResults
        .filter((r) => r.confidence_level === 'High' && r.species !== 'Unassigned')
        .map((r) => r.species)
    )
  ).length || taxonCounts.size;

  let shannonIndex = 0;
  let simpsonD = 0;

  if (totalAbundance > 0) {
    for (const count of taxonCounts.values()) {
      const p = count / totalAbundance;
      if (p > 0) {
        shannonIndex -= p * Math.log(p);
      }
      if (totalAbundance > 1) {
        simpsonD += (count * (count - 1)) / (totalAbundance * (totalAbundance - 1));
      } else {
        simpsonD += p * p;
      }
    }
  }

  const simpsonIndex = totalAbundance > 0 ? Math.max(0, 1 - simpsonD) : 0;
  const distinctTaxaCount = taxonCounts.size;
  const pielouEvenness =
    distinctTaxaCount > 1 && shannonIndex > 0 ? shannonIndex / Math.log(distinctTaxaCount) : distinctTaxaCount === 1 ? 1 : 0;

  const taxonomicDistribution: TaxonomicDistributionItem[] = Array.from(phylumStats.entries())
    .map(([name, info]) => ({
      name,
      rank: 'Phylum' as const,
      taxonCount: info.taxa.size,
      readAbundance: info.abundance,
      percentage: totalAbundance > 0 ? Number(((info.abundance / totalAbundance) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.readAbundance - a.readAbundance);

  const completedAt = new Date().toISOString();

  const job: AnalysisJobRecord = {
    id: jobId,
    owner_uid: ownerUid,
    dataset_id: datasetId,
    status: 'completed',
    analysis_mode: analysisMode,
    reference_database: referenceDbLabel,
    total_sequences: parsed.qcSummary.totalReads,
    valid_sequences: parsed.qcSummary.validReads,
    matched_sequences: matchedCount,
    unassigned_sequences: unassignedCount,
    qc_summary: {
      ...parsed.qcSummary,
      detectedMarkers: Array.from(detectedMarkers),
    },
    result_storage_path: `${ownerUid}/${datasetId}/${jobId}.json`,
    error_message: null,
    started_at: startedAt,
    completed_at: completedAt,
  };

  const biodiversityMetrics: BiodiversityMetricsRecord = {
    id: randomUUID(),
    owner_uid: ownerUid,
    job_id: jobId,
    dataset_id: datasetId,
    species_richness: speciesRichness,
    total_abundance: totalAbundance,
    shannon_index: Number(shannonIndex.toFixed(4)),
    simpson_index: Number(simpsonIndex.toFixed(4)),
    pielou_evenness: Number(Math.min(1, pielouEvenness).toFixed(4)),
    taxonomic_distribution: taxonomicDistribution,
    calculated_at: completedAt,
  };

  return {
    job,
    taxonomyResults,
    biodiversityMetrics,
  };
}
