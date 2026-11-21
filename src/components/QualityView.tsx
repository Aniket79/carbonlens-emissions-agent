import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { IssueSeverity, QualityAssessmentResult } from '../types.ts';

const SEVERITY_STYLE: Record<IssueSeverity, string> = {
  Critical: 'bg-red-50 text-red-800 border-red-200',
  High: 'bg-amber-50 text-amber-800 border-amber-200',
  Medium: 'bg-sky-50 text-sky-800 border-sky-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-200',
  Pass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function QualityView({
  quality,
  onAskAgent,
}: {
  quality: QualityAssessmentResult;
  onAskAgent: (prompt: string) => void;
}) {
  const [severityFilter, setSeverityFilter] = useState<'All' | IssueSeverity>('All');
  const [expandedIssue, setExpandedIssue] = useState<Record<string, boolean>>({});

  const filteredIssues =
    severityFilter === 'All'
      ? quality.issues
      : quality.issues.filter((i) => i.severity === severityFilter);

  return (
    <div className="space-y-6">
      {/* Compliance Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div>
          <span className="font-semibold text-slate-900">Automated Audit Boundary: </span>
          {quality.complianceDisclaimer}
        </div>
      </div>

      {/* Top Score Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-[12px] font-medium text-slate-500">Data Completeness Score</div>
          <div className="mt-1.5 font-mono text-[30px] font-semibold text-slate-900 tabular-nums">
            {quality.completenessScore}%
          </div>
          <div className="mt-1 text-[12px] text-slate-600">
            100% field fill across {quality.totalRowsAudited.toLocaleString()} rows; 24/36 scope-months covered
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-slate-500">Composite Data Quality Score</span>
            <span className="font-mono font-semibold text-amber-800">{quality.qualityRating}</span>
          </div>
          <div className="mt-1.5 font-mono text-[30px] font-semibold text-slate-900 tabular-nums">
            {quality.qualityScore} <span className="text-[16px] font-normal text-slate-500">/ 100</span>
          </div>
          <div className="mt-1 text-[12px] text-slate-600">
            Weighted across 4 deterministic audit dimensions
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="text-[12px] font-medium text-slate-500">Detected Findings Breakdown</div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[12.5px] tabular-nums">
            <div className="flex justify-between">
              <span className="text-red-700">Critical</span>
              <span className="font-semibold text-slate-900">{quality.summaryCounts.Critical}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700">High</span>
              <span className="font-semibold text-slate-900">{quality.summaryCounts.High}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sky-700">Medium</span>
              <span className="font-semibold text-slate-900">{quality.summaryCounts.Medium}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Pass / Low</span>
              <span className="font-semibold text-slate-900">
                {quality.summaryCounts.Pass + quality.summaryCounts.Low}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Documented Scoring Methodology */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-slate-900">
              Documented Scoring Methodology
            </h2>
            <p className="mt-0.5 font-mono text-[11.5px] text-slate-600">
              {quality.scoringMethodology.qualityFormula}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onAskAgent('Are my scope 2 emissions calculation valid according to the Greenhouse Gas Protocol?')
            }
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-100"
          >
            Explain Scope 2 Validity with Agent
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 font-semibold">Dimension</th>
                <th className="px-3 py-2 text-right font-semibold">Weight</th>
                <th className="px-3 py-2 text-right font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Deterministic Audit Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quality.scoringMethodology.components.map((c) => (
                <tr key={c.dimension}>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{c.dimension}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                    {c.weightPercent}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {c.score}/100
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{c.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter & Issue List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">
            Validation Rules &amp; Detected Issues ({filteredIssues.length})
          </h2>
          <div className="inline-flex rounded border border-slate-200 bg-white p-0.5 text-[12px]">
            {(['All', 'Critical', 'High', 'Medium', 'Low', 'Pass'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`rounded-sm px-2.5 py-1 font-medium ${
                  severityFilter === sev
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const isOpen = Boolean(expandedIssue[issue.id]);
            return (
              <div key={issue.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          SEVERITY_STYLE[issue.severity]
                        }`}
                      >
                        {issue.severity === 'Pass' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {issue.severity}
                      </span>
                      <span className="font-mono text-[11.5px] text-slate-500">
                        {issue.scope} · {issue.id}
                      </span>
                    </div>
                    <h3 className="font-display text-[14px] font-semibold text-slate-900">
                      {issue.checkName}
                    </h3>
                  </div>

                  <div className="text-right font-mono text-[12px] text-slate-600 tabular-nums">
                    <div>
                      Affected: <span className="font-semibold text-slate-900">{issue.affectedRows}</span> /{' '}
                      {issue.totalRowsInScope} rows
                    </div>
                  </div>
                </div>

                <p className="mt-2.5 text-[13px] leading-relaxed text-slate-700">{issue.explanation}</p>
                <div className="mt-2.5 rounded border border-slate-100 bg-slate-50/80 px-3 py-2 text-[12.5px] text-slate-800">
                  <span className="font-semibold text-emerald-900">Recommended Action: </span>
                  {issue.correctiveAction}
                </div>

                {issue.samples.length > 0 && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIssue((prev) => ({ ...prev, [issue.id]: !prev[issue.id] }))
                      }
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-950"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      {isOpen ? 'Hide' : 'Inspect'} {issue.samples.length} sample row
                      {issue.samples.length > 1 ? 's' : ''}
                    </button>

                    {isOpen && (
                      <div className="mt-2 divide-y divide-slate-100 rounded border border-slate-200 bg-slate-50/50 text-[12px]">
                        {issue.samples.map((s, idx) => (
                          <div key={idx} className="px-3 py-1.5 text-slate-700">
                            <span className="font-mono font-semibold text-slate-900">
                              {s.sourceFile}:L{s.rowNumber}
                            </span>{' '}
                            — {s.summary}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
