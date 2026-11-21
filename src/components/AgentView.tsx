import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Send, Wrench } from 'lucide-react';
import type { AgentChatResponse } from '../types.ts';
import { MarkdownView } from './MarkdownView.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  response?: AgentChatResponse;
  error?: string;
}

const TEST_PROMPTS = [
  {
    group: 'Core Q1',
    text: 'Should employee business travel be classified as Scope 1 or Scope 3? Explain the reasoning and describe how I can calculate my business travel emissions?',
  },
  {
    group: 'Core Q2',
    text: 'Are my scope 2 emissions calculation valid according to the Greenhouse Gas Protocol?',
  },
  {
    group: 'Core Q3',
    text: 'How do my scope 1 & 2 emissions compare with other companies (refer to peer reports in the data sources) in my industry, and what insights can I derive from this comparison?',
  },
  {
    group: 'Bonus Q1',
    text: 'What is our highest emitting Scope 3 category and what specific activities contribute to it?',
  },
  {
    group: 'Bonus Q2',
    text: 'Which suppliers should I prioritise to engage for emissions reduction efforts?',
  },
  {
    group: 'Bonus Q3',
    text: 'Generate a summary report of our total emissions by scope with key insights',
  },
];

export function AgentView({
  queuedPrompt,
  onClearQueuedPrompt,
}: {
  queuedPrompt: string | null;
  onClearQueuedPrompt: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: nextHistory }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with HTTP ${res.status}`);
      }
      const modelMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.answerMarkdown,
        response: data,
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'model',
          text: '',
          error: (err as Error).message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queuedPrompt) {
      const p = queuedPrompt;
      onClearQueuedPrompt();
      void sendPrompt(p);
    }
  }, [queuedPrompt]);

  const toggleTrace = (id: string) => {
    setExpandedTraces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Evaluation Prompt Library */}
      <div className="space-y-4 lg:col-span-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="font-display text-[14px] font-semibold text-slate-900">
            Evaluation &amp; Discovery Prompts
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Invoke the Groq (openai/gpt-oss-120b) tool-calling agent across deterministic CSV analytics, validation checks, peer PDFs, and GHG Protocol RAG.
          </p>
          <div className="mt-3 space-y-2">
            {TEST_PROMPTS.map((item) => (
              <button
                key={item.group}
                type="button"
                disabled={loading}
                onClick={() => void sendPrompt(item.text)}
                className="w-full rounded border border-slate-200 bg-slate-50/70 p-2.5 text-left transition-colors hover:border-emerald-600/40 hover:bg-emerald-50/40 disabled:opacity-50"
              >
                <div className="font-mono text-[11px] font-semibold text-emerald-800">
                  {item.group}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-slate-700">{item.text}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Conversation Thread */}
      <div className="flex min-h-[600px] flex-col rounded-md border border-slate-200 bg-white lg:col-span-8">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">
            AI Emissions Insights Agent
          </h2>
          <p className="text-[12px] text-slate-500">
            Backed by 8 deterministic tools — numerical calculations never rely on LLM arithmetic.
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
              <div className="font-display text-[14px] font-semibold text-slate-800">
                Ask any sustainability, Scope 1–3, GHG Protocol, or peer benchmarking question
              </div>
              <p className="mx-auto mt-1 max-w-lg text-[13px] text-slate-600">
                Select one of the evaluation questions on the left or enter your own query below. Every response displays the exact deterministic tools executed and source page citations.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' ? (
                <div className="ml-auto max-w-2xl rounded-md border border-emerald-800/20 bg-emerald-950 px-4 py-3 text-[13.5px] leading-relaxed text-white">
                  {msg.text}
                </div>
              ) : msg.error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
                  <span className="font-semibold">Agent Error: </span>
                  {msg.error}
                </div>
              ) : (
                <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/40 p-4">
                  {/* Tool Trace Disclosure */}
                  {msg.response && msg.response.toolTraces.length > 0 && (
                    <div className="rounded border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleTrace(msg.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-emerald-700" />
                          Executed {msg.response.toolTraces.length} deterministic tool
                          {msg.response.toolTraces.length > 1 ? 's' : ''}:{' '}
                          <span className="font-mono text-slate-900">
                            {msg.response.toolTraces.map((t) => t.toolName).join(', ')}
                          </span>
                        </span>
                        {expandedTraces[msg.id] ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </button>

                      {expandedTraces[msg.id] && (
                        <div className="divide-y divide-slate-100 border-t border-slate-200 px-3 py-2 text-[12px]">
                          {msg.response.toolTraces.map((t, idx) => (
                            <div key={idx} className="py-1.5">
                              <div className="font-mono font-semibold text-slate-900">
                                {t.toolName}({JSON.stringify(t.args)})
                              </div>
                              <div className="text-slate-600">{t.summary}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Markdown Response */}
                  <div className="rounded border border-slate-200 bg-white p-4">
                    <MarkdownView content={msg.text} />
                  </div>

                  {/* Evidence Data Table */}
                  {msg.response?.evidenceTable && (
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="mb-2 text-[12px] font-semibold text-slate-800">
                        {msg.response.evidenceTable.title}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[12px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                              {msg.response.evidenceTable.columns.map((c) => (
                                <th key={c} className="px-2.5 py-1.5 font-semibold">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {msg.response.evidenceTable.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-2.5 py-1.5 ${
                                      cIdx > 0 ? 'font-mono tabular-nums text-slate-800' : 'font-medium text-slate-900'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Retrieved Document Citations */}
                  {msg.response && msg.response.citations.length > 0 && (
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
                        Retrieved Document Citations
                      </div>
                      <div className="space-y-1.5">
                        {msg.response.citations.slice(0, 5).map((cit, idx) => (
                          <div key={idx} className="text-[12px] text-slate-600">
                            <span className="font-mono font-semibold text-slate-900">
                              {cit.source} ({cit.page}):
                            </span>{' '}
                            {cit.excerpt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600">
              Executing deterministic analytics &amp; synthesizing grounded insights with Groq (openai/gpt-oss-120b)…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendPrompt(input);
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-3.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Scope 1–3 emissions, GHG Protocol compliance, suppliers, or peer benchmarks…"
            aria-label="Ask the Emissions Insights Agent"
            className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-emerald-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
