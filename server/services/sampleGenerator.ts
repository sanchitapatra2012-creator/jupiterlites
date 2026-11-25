import { CURATED_REFERENCE_LIBRARY } from './referenceDatabase.ts';

function mutateTail(seq: string, mutations: number): string {
  const bases = ['A', 'C', 'G', 'T'];
  const chars = seq.split('');
  for (let i = 0; i < mutations; i += 1) {
    const pos = (i * 17 + 12) % chars.length;
    const current = chars[pos];
    chars[pos] = bases.find((b) => b !== current) ?? 'A';
  }
  return chars.join('');
}

export function buildSampleDataset(format: 'fasta' | 'fastq' | 'csv'): {
  filename: string;
  mimeType: string;
  content: string;
} {
  const entries = [
    { id: 'ENV_STREAM_01', seq: CURATED_REFERENCE_LIBRARY[0].sequence, marker: 'COI', abundance: 42 },
    { id: 'ENV_STREAM_02', seq: mutateTail(CURATED_REFERENCE_LIBRARY[3].sequence, 4), marker: 'COI', abundance: 68 },
    { id: 'ENV_STREAM_03', seq: CURATED_REFERENCE_LIBRARY[4].sequence, marker: 'COI', abundance: 31 },
    { id: 'ENV_STREAM_04', seq: mutateTail(CURATED_REFERENCE_LIBRARY[2].sequence, 10), marker: '12S_rRNA', abundance: 19 },
    { id: 'ENV_STREAM_05', seq: CURATED_REFERENCE_LIBRARY[8].sequence, marker: '16S_rRNA', abundance: 55 },
    { id: 'ENV_STREAM_06', seq: CURATED_REFERENCE_LIBRARY[11].sequence, marker: '12S_rRNA', abundance: 12 },
    {
      id: 'ENV_UNKNOWN_CTRL',
      seq: 'GATCGTAGCTAGCTGATCGATCGTACGATCGTAGCTAGCTGATCGATCGATCGATAGCTAGCTGATCGTAGCTAGCTGATCGATCGATCGTAGCTAGCTAGCTGATCGATCGTAGCTAGCTGATCGATCGATGCTAGCTGATCGATCGATCGTAGCTA',
      marker: 'COI',
      abundance: 7,
    },
  ];

  if (format === 'fasta') {
    const content = entries
      .map((e) => `>${e.id} marker=${e.marker} sample=FRESHWATER_TRANSECT_A\n${e.seq}`)
      .join('\n');
    return { filename: 'ecodna_freshwater_sample.fasta', mimeType: 'text/plain', content };
  }

  if (format === 'fastq') {
    const content = entries
      .map((e) => {
        const qual = 'I'.repeat(e.seq.length); // Phred Q=40 high quality
        return `@${e.id} marker=${e.marker}\n${e.seq}\n+\n${qual}`;
      })
      .join('\n');
    return { filename: 'ecodna_freshwater_sample.fastq', mimeType: 'text/plain', content };
  }

  const header = 'sequence_id,marker_gene,read_count,sequence';
  const rows = entries.map((e) => `${e.id},${e.marker},${e.abundance},${e.seq}`);
  return {
    filename: 'ecodna_freshwater_asv_table.csv',
    mimeType: 'text/csv',
    content: [header, ...rows].join('\n'),
  };
}
