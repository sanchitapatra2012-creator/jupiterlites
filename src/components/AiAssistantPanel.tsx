import React, { useState } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';
import { askAiResearchAssistant } from '../lib/api';

interface AiAssistantPanelProps {
  jobId: string | null;
  datasetName?: string;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ jobId, datasetName }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPrompt = async (mode: 'explain_taxonomy' | 'summarize_report' | 'ecological_patterns' | 'qa', customQ?: string) => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await askAiResearchAssistant({
        jobId,
        mode,
        question: customQ ?? question,
      });
      setAnswer(res.explanation);
      setModelUsed(res.model);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI interpretation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-[#061B14]">
              AI Research Interpretation Assistant
            </h3>
            <p className="text-xs text-slate-500">
              Grounded strictly on verified computational outputs {datasetName ? `· ${datasetName}` : ''}
            </p>
          </div>
        </div>
        {modelUsed && (
          <span className="text-xs font-mono text-slate-500">Model: {modelUsed}</span>
        )}
      </div>

      {!jobId ? (
        <p className="text-sm text-slate-500 py-4">
          Select a completed analysis run to ask scientific interpretation questions or generate an executive summary.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runPrompt('explain_taxonomy')}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Explain Taxonomy & Confidence
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runPrompt('ecological_patterns')}
              className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Interpret Ecological Patterns
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runPrompt('summarize_report')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              Summarize Analysis Report
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!question.trim()) return;
              void runPrompt('qa', question.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about Shannon diversity, dominant phyla, or uncertain assignments..."
              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-4 py-2 bg-[#061B14] text-white text-sm font-medium rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Ask Assistant</span>
            </button>
          </form>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              {error}
            </div>
          )}

          {loading && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
              <span>Synthesizing verified bioinformatics outputs...</span>
            </div>
          )}

          {answer && !loading && (
            <div className="p-4 bg-[#F7FAF9] border border-emerald-200/80 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </>
      )}
    </section>
  );
};
