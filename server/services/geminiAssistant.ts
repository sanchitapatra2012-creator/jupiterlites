import { GoogleGenAI } from '@google/genai';
import type {
  AnalysisJobRecord,
  BiodiversityMetricsRecord,
  DatasetRecord,
  TaxonomyResultRecord,
} from '../types.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings -> Secrets to enable the AI Research Assistant.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateScientificExplanation(params: {
  question: string;
  mode: 'explain_taxonomy' | 'summarize_report' | 'ecological_patterns' | 'qa';
  dataset: DatasetRecord;
  job: AnalysisJobRecord;
  metrics: BiodiversityMetricsRecord | null;
  taxonomy: TaxonomyResultRecord[];
}): Promise<string> {
  const ai = getGeminiClient();
  const { question, mode, dataset, job, metrics, taxonomy } = params;

  const compactTaxa = taxonomy.slice(0, 40).map((t) => ({
    sequenceId: t.sequence_id,
    marker: t.marker_gene,
    species: t.species,
    genus: t.genus,
    family: t.family,
    phylum: t.phylum,
    kingdom: t.kingdom,
    matchPct: t.match_percentage,
    confidence: t.confidence_level,
    abundance: t.read_abundance,
    reference: `${t.reference_database} (${t.reference_accession})`,
    note: t.uncertainty_note,
  }));

  const groundedContext = {
    dataset: {
      name: dataset.dataset_name,
      fileFormat: dataset.file_format,
      sampleCode: dataset.sample?.sample_code ?? 'N/A',
      location: dataset.sample?.sample_location ?? 'Unknown',
      sampleType: dataset.sample?.sample_type ?? 'Unknown',
      collectionDate: dataset.sample?.collection_date ?? 'Unknown',
      environmentalDescription: dataset.sample?.environmental_description ?? '',
    },
    analysisJob: {
      id: job.id,
      analysisMode: job.analysis_mode,
      referenceDatabase: job.reference_database,
      totalSequences: job.total_sequences,
      validSequences: job.valid_sequences,
      matchedSequences: job.matched_sequences,
      unassignedSequences: job.unassigned_sequences,
      qcSummary: job.qc_summary,
    },
    biodiversityMetrics: metrics
      ? {
          speciesRichness: metrics.species_richness,
          totalAbundance: metrics.total_abundance,
          shannonIndex: metrics.shannon_index,
          simpsonIndex: metrics.simpson_index,
          pielouEvenness: metrics.pielou_evenness,
          taxonomicDistribution: metrics.taxonomic_distribution,
        }
      : null,
    taxonomyResultsSample: compactTaxa,
  };

  const taskInstruction =
    mode === 'summarize_report'
      ? 'Generate a concise, structured scientific executive summary of the verified analysis report, citing exact biodiversity indices, confidence distribution, and explicit limitations.'
      : mode === 'ecological_patterns'
        ? 'Interpret the observed ecological patterns across the verified phyla, habitat indicators, and diversity indices without extrapolating beyond the data.'
        : mode === 'explain_taxonomy'
          ? 'Explain the taxonomic assignments in clear scientific prose, explicitly highlighting High vs Medium/Low/Unassigned confidence levels and why conservative rank assignments were made.'
          : `Answer the researcher's question accurately using only the verified computational results provided below. Question: ${question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `${taskInstruction}\n\nVerified Computational Output (JSON):\n${JSON.stringify(groundedContext, null, 2)}`,
    config: {
      systemInstruction:
        'You are the EcoDNA Scientific Interpretation Assistant. Explain verified bioinformatics outputs clearly for ecologists and researchers. STRICT RULES: (1) Base every factual claim strictly on the supplied JSON computational outputs. (2) NEVER invent species identifications, match percentages, or unsupported ecological claims. (3) If analysisMode is DEMO_MODE, explicitly note that reference alignments were generated against the local curated reference subset rather than live external NCBI/BOLD servers. (4) Always cite uncertainty for Low or Unassigned sequences. Keep responses structured with concise headings and bullet points.',
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}
