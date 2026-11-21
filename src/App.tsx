import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Menu,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { AgentView } from './components/AgentView.tsx';
import { BenchmarkView } from './components/BenchmarkView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { KnowledgeView } from './components/KnowledgeView.tsx';
import { QualityView } from './components/QualityView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import type {
  EmissionsDashboardSummary,
  ExecutiveReportData,
  NavSection,
  PeerBenchmarkResult,
  QualityAssessmentResult,
} from './types.ts';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Overview Dashboard', breadcrumb: 'Overview Dashboard', icon: BarChart3 },
  { id: 'agent', label: 'AI Emissions Agent', breadcrumb: 'AI Emissions Agent', icon: MessageSquare },
  { id: 'knowledge', label: 'GHG Protocol RAG', breadcrumb: 'GHG Protocol Knowledge Base', icon: BookOpen },
  { id: 'quality', label: 'Data Quality Audit', breadcrumb: 'Data Quality Assessment', icon: ShieldAlert },
  { id: 'benchmarks', label: 'Peer Benchmarking', breadcrumb: 'Peer Benchmarking', icon: GitCompare },
  { id: 'reports', label: 'Executive Reports', breadcrumb: 'Executive Reports', icon: FileText },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [dashboard, setDashboard] = useState<EmissionsDashboardSummary | null>(null);
  const [quality, setQuality] = useState<QualityAssessmentResult | null>(null);
  const [benchmark, setBenchmark] = useState<PeerBenchmarkResult | null>(null);
  const [report, setReport] = useState<ExecutiveReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  // Custom CSV upload states
  const [s1FileText, setS1FileText] = useState<string | null>(null);
  const [s2FileText, setS2FileText] = useState<string | null>(null);
  const [s3FileText, setS3FileText] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dashRes, qualRes, benchRes, repRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/quality'),
        fetch('/api/benchmarks'),
        fetch('/api/report'),
      ]);
      if (!dashRes.ok || !qualRes.ok || !benchRes.ok || !repRes.ok) {
        throw new Error('Failed to load analytical workspace endpoints.');
      }
      const [dashJson, qualJson, benchJson, repJson] = await Promise.all([
        dashRes.json(),
        qualRes.json(),
        benchRes.json(),
        repRes.json(),
      ]);
      setDashboard(dashJson);
      setQuality(qualJson);
      setBenchmark(benchJson);
      setReport(repJson);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllData();
  }, [fetchAllData]);

  const handleAskPrompt = (prompt: string) => {
    setQueuedPrompt(prompt);
    setActiveSection('agent');
    setMobileMenuOpen(false);
  };

  const handleFileRead = (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setter(reader.result);
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s1FileText && !s2FileText && !s3FileText) {
      setUploadError('Select at least one CSV file (Scope 1, Scope 2, or Scope 3) to replace.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(s1FileText ? { scope1Csv: s1FileText } : {}),
          ...(s2FileText ? { scope2Csv: s2FileText } : {}),
          ...(s3FileText ? { scope3Csv: s3FileText } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'CSV upload failed');
      setUploadOpen(false);
      setS1FileText(null);
      setS2FileText(null);
      setS3FileText(null);
      await fetchAllData();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleResetDataset = async () => {
    setUploading(true);
    try {
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      setUploadOpen(false);
      await fetchAllData();
    } finally {
      setUploading(false);
    }
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];

  const SidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-800 font-display text-[13px] font-bold text-white">
          CL
        </div>
        <div>
          <div className="font-display text-[14px] font-bold tracking-tight text-slate-900">
            CarbonLens
          </div>
          <div className="text-[11px] text-slate-500">Emissions Insights Agent</div>
        </div>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-950 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-300' : 'text-slate-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3.5 text-[12px]">
        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
          <div className="font-medium text-slate-800">Active Data Sources</div>
          <div className="mt-1 font-mono text-[11px] text-slate-600">
            {dashboard?.datasetSource === 'custom' ? 'Custom CSV Upload' : 'Default 6 Source Files'}
          </div>
          {dashboard && (
            <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
              {dashboard.totalRecords.toLocaleString()} inventory rows
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Custom CSVs
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] border-r border-slate-200 lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[264px] border-r border-slate-200 bg-white">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3.5 right-3 rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-[252px]">
        {/* Top Bar Contract: Breadcrumb on left, max 2 primary actions on right */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate text-[13px] text-slate-500">
              <span className="hidden sm:inline">CarbonLens</span>
              <span className="mx-2 hidden text-slate-300 sm:inline">/</span>
              <span className="font-display font-semibold text-slate-900">
                {activeNavMeta.breadcrumb}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('agent')}
              className="whitespace-nowrap shrink-0 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-800 hover:bg-slate-50 sm:px-3"
            >
              Ask <span className="hidden sm:inline">AI </span>Agent
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('reports')}
              className="whitespace-nowrap shrink-0 rounded bg-emerald-800 px-2.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-900 sm:px-3"
            >
              Export<span className="hidden sm:inline"> Report</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="h-28 animate-pulse rounded-md border border-slate-200 bg-white p-4" />
                ))}
              </div>
              <div className="h-72 animate-pulse rounded-md border border-slate-200 bg-white" />
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-5 text-[13.5px] text-red-900">
              <div className="font-semibold">Unable to load emissions workspace</div>
              <p className="mt-1">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchAllData()}
                className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-[12px] font-medium text-red-900 hover:bg-red-100"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              {activeSection === 'dashboard' && dashboard && (
                <DashboardView
                  summary={dashboard}
                  onNavigate={setActiveSection}
                  onAskPrompt={handleAskPrompt}
                />
              )}
              {activeSection === 'agent' && (
                <AgentView
                  queuedPrompt={queuedPrompt}
                  onClearQueuedPrompt={() => setQueuedPrompt(null)}
                />
              )}
              {activeSection === 'knowledge' && <KnowledgeView />}
              {activeSection === 'quality' && quality && (
                <QualityView quality={quality} onAskAgent={handleAskPrompt} />
              )}
              {activeSection === 'benchmarks' && benchmark && (
                <BenchmarkView benchmark={benchmark} onAskAgent={handleAskPrompt} />
              )}
              {activeSection === 'reports' && report && <ReportsView report={report} />}
            </>
          )}
        </main>
      </div>

      {/* Custom CSV Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-md border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-slate-900">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                Upload Custom Emissions CSVs
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setUploadOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-3 text-[13px]">
              <p className="text-[12.5px] text-slate-600">
                Upload replacement Scope 1, Scope 2, or Scope 3 CSV files matching the inventory schema, or reset back to the default assignment dataset.
              </p>

              <label className="block rounded border border-slate-200 p-3">
                <span className="block text-[12px] font-semibold text-slate-800">
                  Scope 1 CSV (Direct Emissions)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileRead(e.target.files?.[0], setS1FileText)}
                  className="mt-1.5 block w-full text-[12px] text-slate-600"
                />
              </label>

              <label className="block rounded border border-slate-200 p-3">
                <span className="block text-[12px] font-semibold text-slate-800">
                  Scope 2 CSV (Purchased Energy)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileRead(e.target.files?.[0], setS2FileText)}
                  className="mt-1.5 block w-full text-[12px] text-slate-600"
                />
              </label>

              <label className="block rounded border border-slate-200 p-3">
                <span className="block text-[12px] font-semibold text-slate-800">
                  Scope 3 CSV (Value Chain)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileRead(e.target.files?.[0], setS3FileText)}
                  className="mt-1.5 block w-full text-[12px] text-slate-600"
                />
              </label>

              {uploadError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">
                  {uploadError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleResetDataset()}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Default
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadOpen(false)}
                    className="rounded border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded bg-emerald-800 px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
                  >
                    {uploading ? 'Applying…' : 'Apply Dataset'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
