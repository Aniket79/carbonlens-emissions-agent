import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import type { ProtocolSearchResult } from '../types.ts';
import { MarkdownView } from './MarkdownView.tsx';

const SUGGESTED_TOPICS = [
  'Employee business travel Scope 1 vs Scope 3 calculation',
  'Scope 2 purchased electricity and steam reporting requirements',
  'Organizational boundaries equity share vs control approach',
  'Materiality threshold 5 percent and verification',
  'Quality management and emission factor selection',
];

export function KnowledgeView() {
  const [query, setQuery] = useState('Employee business travel Scope 1 vs Scope 3');
  const [results, setResults] = useState<ProtocolSearchResult[]>([]);
  const [totalIndexed, setTotalIndexed] = useState<number>(0);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&topK=6`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Search failed');
      setResults(data.results ?? []);
      setTotalIndexed(data.totalChunksIndexed ?? 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const runAskRag = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAsking(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'RAG synthesis failed');
      setRagAnswer(data.answerMarkdown);
      if (Array.isArray(data.passages)) {
        setResults(data.passages);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    void runSearch(query);
  }, []);

  return (
    <div className="space-y-6">
      {/* Search & Ask Header Card */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-slate-900">
              GHG Protocol Corporate Standard Knowledge Base (RAG)
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-600">
              BM25 semantic lexical retrieval with Groq (<span className="font-mono text-[12px]">openai/gpt-oss-120b</span>) grounded synthesis over{' '}
              <span className="font-mono text-[12px]">ghg-protocol-revised.pdf</span> (116 pages,{' '}
              <span className="font-mono tabular-nums">{totalIndexed}</span> indexed chunks with page &amp; chapter metadata).
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GHG Protocol rules, scopes, business travel, Scope 2, emission factors…"
              aria-label="Search GHG Protocol"
              className="w-full rounded border border-slate-300 bg-white py-2 pr-3 pl-9 text-[13px] text-slate-900 focus:border-emerald-700 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Retrieve Passages'}
          </button>
          <button
            type="button"
            disabled={asking || !query.trim()}
            onClick={() => void runAskRag(query)}
            className="inline-flex items-center justify-center gap-1.5 rounded bg-emerald-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {asking ? 'Synthesizing…' : 'Synthesize RAG Answer'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => {
                setQuery(topic);
                void runSearch(topic);
              }}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] text-slate-700 hover:border-slate-300 hover:bg-slate-100"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
          {error}
        </div>
      )}

      {ragAnswer && (
        <div className="rounded-md border border-emerald-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 font-display text-[14px] font-semibold text-emerald-900">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Synthesized RAG Response (Grounded in Retrieved Passages)
            </div>
            <span className="font-mono text-[11px] text-slate-500">openai/gpt-oss-120b (Groq)</span>
          </div>
          <MarkdownView content={ragAnswer} />
        </div>
      )}

      {/* Retrieved Passages List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[14px] font-semibold text-slate-900">
            Retrieved Document Passages ({results.length})
          </h3>
          <span className="text-[12px] text-slate-500">
            Ordered by relevance score with preserved PDF &amp; printed page numbers
          </span>
        </div>

        {searching ? (
          <div className="space-y-3">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-md border border-slate-200 bg-white p-4" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {results.map((item) => (
              <div key={item.chunk.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-[12px]">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
                    <span>{item.chunk.sourceDocument}</span>
                    <span className="font-mono text-slate-600">
                      PDF p. {item.chunk.pdfPage}
                      {item.chunk.printedPage ? ` (doc p. ${item.chunk.printedPage})` : ''}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{item.chunk.chapter}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {item.matchType} score: {item.score.toFixed(3)}
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">{item.chunk.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
