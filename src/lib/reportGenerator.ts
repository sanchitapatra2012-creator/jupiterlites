import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  TaxonomyResultRecord,
  UserProfile,
} from '../types/ecodna';

export interface ReportExportContext {
  researcher: UserProfile | null;
  dataset: DatasetRecord;
  job: AnalysisJobRecord;
  metrics: BiodiversityMetricsRecord | null;
  taxonomy: TaxonomyResultRecord[];
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvReportContent(ctx: ReportExportContext): { filename: string; content: string; base64: string } {
  const lines: string[] = [];
  lines.push('# EcoDNA – Biodiversity Intelligence Platform Report');
  lines.push(`# Problem Statement ID: 25042 (Identifying Taxonomy and Assessing Biodiversity from eDNA Datasets)`);
  lines.push(`# Researcher: ${ctx.researcher?.fullName ?? 'Researcher'} (${ctx.researcher?.email ?? ''})`);
  lines.push(`# Dataset: ${ctx.dataset.dataset_name} (${ctx.dataset.file_name}, ${ctx.dataset.file_format})`);
  lines.push(`# Sample Code: ${ctx.dataset.sample?.sample_code ?? 'N/A'} | Location: ${ctx.dataset.sample?.sample_location ?? 'N/A'} | Type: ${ctx.dataset.sample?.sample_type ?? 'N/A'} | Date: ${ctx.dataset.sample?.collection_date ?? 'N/A'}`);
  lines.push(`# Analysis Mode: ${ctx.job.analysis_mode} | Reference Database: ${ctx.job.reference_database}`);
  lines.push(`# Analysis Completed: ${ctx.job.completed_at ?? ctx.job.started_at}`);
  if (ctx.metrics) {
    lines.push(
      `# Biodiversity Metrics: Species Richness=${ctx.metrics.species_richness} | Total Abundance=${ctx.metrics.total_abundance} | Shannon H'=${ctx.metrics.shannon_index} | Simpson (1-D)=${ctx.metrics.simpson_index} | Pielou Evenness J'=${ctx.metrics.pielou_evenness}`
    );
  }
  lines.push(
    '# Limitations: Assignments reflect sequence similarity against the configured reference database. Low-confidence and unassigned reads are retained conservatively without species-level fabrication.'
  );
  lines.push('');

  const headers = [
    'Sequence ID',
    'Marker Gene',
    'Length (bp)',
    'Read Abundance',
    'Kingdom',
    'Phylum',
    'Class',
    'Order',
    'Family',
    'Genus',
    'Species',
    'Match %',
    'Confidence',
    'Reference Database',
    'Accession',
    'Uncertainty Note',
  ];
  lines.push(headers.map(escapeCsvCell).join(','));

  for (const row of ctx.taxonomy) {
    lines.push(
      [
        row.sequence_id,
        row.marker_gene,
        row.sequence_length,
        row.read_abundance,
        row.kingdom,
        row.phylum,
        row.class_name,
        row.order_name,
        row.family,
        row.genus,
        row.species,
        row.match_percentage.toFixed(2),
        row.confidence_level,
        row.reference_database,
        row.reference_accession,
        row.uncertainty_note,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  const content = lines.join('\n');
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const safeName = ctx.dataset.dataset_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    filename: `EcoDNA_Report_${safeName}_${ctx.job.id.slice(0, 8)}.csv`,
    content,
    base64,
  };
}

export function buildPdfReportDocument(ctx: ReportExportContext): {
  filename: string;
  doc: jsPDF;
  base64: string;
} {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band (Dark Forest Green)
  doc.setFillColor(6, 27, 20);
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Vector EcoDNA Helix Emblem in PDF
  doc.setDrawColor(45, 212, 191);
  doc.setLineWidth(0.9);
  doc.circle(16, 17, 6.5, 'S');
  doc.setDrawColor(16, 185, 129);
  doc.line(12.5, 13.5, 19.5, 20.5);
  doc.line(19.5, 13.5, 12.5, 20.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('EcoDNA – Biodiversity Intelligence Platform', 27, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(167, 243, 208);
  doc.text(
    'Scientific eDNA Taxonomic Identification & Biodiversity Assessment Report · Problem Statement ID: 25042',
    27,
    22
  );
  doc.setTextColor(204, 251, 241);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, 27, 28);

  let y = 42;

  // Mode disclosure banner if DEMO_MODE
  if (ctx.job.analysis_mode === 'DEMO_MODE') {
    doc.setFillColor(254, 243, 199);
    doc.rect(14, y, pageWidth - 28, 11, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      'DEMO MODE NOTICE: Alignments executed against EcoDNA curated local reference barcode subset (not live external NCBI/BOLD servers).',
      17,
      y + 7
    );
    y += 16;
  }

  // Researcher & Sample Metadata Grid
  doc.setTextColor(11, 34, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('1. Researcher, Sample & Dataset Metadata', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [20, 40, 32] },
    headStyles: { fillColor: [13, 59, 46], textColor: [255, 255, 255] },
    head: [['Attribute', 'Recorded Value', 'Attribute', 'Recorded Value']],
    body: [
      [
        'Researcher',
        ctx.researcher?.fullName ?? 'Verified Researcher',
        'Researcher Email',
        ctx.researcher?.email ?? 'N/A',
      ],
      [
        'Organization',
        ctx.researcher?.organization || 'Independent / Academic',
        'Analysis Date',
        (ctx.job.completed_at ?? ctx.job.started_at).slice(0, 10),
      ],
      [
        'Dataset Name',
        ctx.dataset.dataset_name,
        'Source File',
        `${ctx.dataset.file_name} (${ctx.dataset.file_format})`,
      ],
      [
        'Sample Code',
        ctx.dataset.sample?.sample_code ?? 'N/A',
        'Sample Type',
        ctx.dataset.sample?.sample_type ?? 'N/A',
      ],
      [
        'Sample Location',
        ctx.dataset.sample?.sample_location ?? 'N/A',
        'Collection Date',
        ctx.dataset.sample?.collection_date ?? 'N/A',
      ],
      [
        'Valid / Total Reads',
        `${ctx.job.valid_sequences} / ${ctx.job.total_sequences} (GC ${ctx.dataset.gc_content_percent}%)`,
        'Reference Source',
        ctx.job.reference_database,
      ],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Biodiversity Metrics Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(11, 34, 26);
  doc.text('2. Quantitative Biodiversity Indices', 14, y);
  y += 4;

  if (ctx.metrics) {
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      head: [
        [
          'Species Richness (S)',
          'Total Abundance (N)',
          "Shannon Index (H')",
          'Simpson Index (1 - D)',
          "Pielou Evenness (J')",
        ],
      ],
      body: [
        [
          String(ctx.metrics.species_richness),
          String(ctx.metrics.total_abundance),
          ctx.metrics.shannon_index.toFixed(4),
          ctx.metrics.simpson_index.toFixed(4),
          ctx.metrics.pielou_evenness.toFixed(4),
        ],
      ],
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Visual Taxonomic Distribution Bar Chart inside PDF
    if (ctx.metrics.taxonomic_distribution.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Phylum Abundance Distribution Chart', 14, y + 2);
      y += 6;
      const topPhyla = ctx.metrics.taxonomic_distribution.slice(0, 6);
      for (const item of topPhyla) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 50, 42);
        doc.text(`${item.name} (${item.percentage}%)`, 14, y + 3.5);
        doc.setFillColor(232, 244, 240);
        doc.rect(62, y, 110, 4.5, 'F');
        doc.setFillColor(13, 148, 136);
        doc.rect(62, y, Math.max(2, (item.percentage / 100) * 110), 4.5, 'F');
        doc.text(`${item.readAbundance} reads`, 175, y + 3.5);
        y += 6.5;
      }
      y += 4;
    }
  }

  // Taxonomy Assignments Table
  if (y > 230) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(11, 34, 26);
  doc.text('3. Taxonomic Identification Results', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [6, 27, 20], textColor: [255, 255, 255] },
    head: [['Seq ID', 'Phylum', 'Family', 'Species / Taxon', 'Match %', 'Confidence', 'Reference']],
    body: ctx.taxonomy.slice(0, 120).map((t) => [
      t.sequence_id,
      t.phylum,
      t.family,
      t.species,
      `${t.match_percentage.toFixed(1)}%`,
      t.confidence_level,
      `${t.reference_database} (${t.reference_accession})`,
    ]),
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > 245) {
    doc.addPage();
    y = 18;
  }

  // Methodology & Limitations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(11, 34, 26);
  doc.text('4. Methodology, Reference Sources & Limitations', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 75, 68);
  const notes = [
    `• Bioinformatics Workflow: Sequences were validated for IUPAC nucleotide composition (>=30 bp), evaluated for GC% and Phred quality (FASTQ Q>=15), and aligned via 8-mer containment and base-identity scoring against ${ctx.job.reference_database}.`,
    '• Confidence Thresholds: High (>=97.0% species-level assignment), Medium (92.0–96.9% conservative genus-level assignment), Low (85.0–91.9% family-level assignment), Unassigned (<85.0% or insufficient overlap).',
    '• Biodiversity Indices: Computed strictly from assigned taxonomic abundance profiles using Shannon-Wiener (H\'), Simpson (1-D), and Pielou evenness (J\') formulas.',
    '• Limitations: eDNA read counts reflect PCR/sequencing abundance and may be influenced by primer bias, shedding rates, and reference database coverage. Unassigned sequences are preserved to avoid false species claims.',
  ];
  const splitNotes = doc.splitTextToSize(notes.join('\n'), pageWidth - 28);
  doc.text(splitNotes, 14, y);

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] ?? '';
  const safeName = ctx.dataset.dataset_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    filename: `EcoDNA_Report_${safeName}_${ctx.job.id.slice(0, 8)}.pdf`,
    doc,
    base64,
  };
}
