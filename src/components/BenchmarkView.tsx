import React from 'react';
import { AlertTriangle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { PeerBenchmarkResult } from '../types.ts';
import { PeerGroupedBarChart } from './Charts.tsx';

export function BenchmarkView({
  benchmark,
  onAskAgent,
}: {
  benchmark: PeerBenchmarkResult;
  onAskAgent: (prompt: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Comparability Limitation Banner */}
      <div className="rounded-md border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-[14px] font-semibold text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            Mandatory Comparability Caveats (Do Not Compare Raw Totals Without Context)
          </div>
          <button
            type="button"
            onClick={() =>
              onAskAgent(
                'How do my scope 1 & 2 emissions compare with other companies (refer to peer reports in the data sources) in my industry, and what insights can I derive from this comparison?'
              )
            }
            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-100/60"
          >
            Analyze with Agent
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-amber-950">
          {benchmark.methodologyLimitations.map((lim, idx) => (
            <li key={idx}>{lim}</li>
          ))}
        </ul>
      </div>

      {/* Grouped Chart + Rankings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-md border border-slate-200 bg-white p-5 lg:col-span-7">
          <h2 className="font-display text-[15px] font-semibold text-slate-900">
            Scope 1 &amp; Scope 2 Peer Comparison
          </h2>
          <p className="mb-4 text-[12px] text-slate-500">
            Our Q1 2024 reported figures vs. Docusign FY25 and Shopify CY 2024 full-year disclosures
          </p>
          <PeerGroupedBarChart benchmark={benchmark} />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="font-display text-[14px] font-semibold text-slate-900">
              Scope 1 Absolute Ranking (Lowest → Highest)
            </h3>
            <div className="mt-2.5 divide-y divide-slate-100 text-[12.5px]">
              {benchmark.scope1Ranking.map((r) => (
                <div key={r.companyName} className="flex items-center justify-between py-2">
                  <div>
                    <span className="mr-2 font-mono font-semibold text-slate-500">#{r.rank}</span>
                    <span className="font-medium text-slate-900">{r.companyName}</span>
                    <div className="pl-6 text-[11px] text-slate-500">{r.period}</div>
                  </div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums">
                    {r.scope1Co2e.toLocaleString()} t
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h3 className="font-display text-[14px] font-semibold text-slate-900">
              Scope 2 Location-Based / Gross Ranking
            </h3>
            <div className="mt-2.5 divide-y divide-slate-100 text-[12.5px]">
              {benchmark.scope2LocationRanking.map((r) => (
                <div key={r.companyName} className="flex items-center justify-between py-2">
                  <div>
                    <span className="mr-2 font-mono font-semibold text-slate-500">#{r.rank}</span>
                    <span className="font-medium text-slate-900">{r.companyName}</span>
                    <div className="pl-6 text-[11px] text-slate-500">
                      {r.method} · {r.period}
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums">
                    {r.scope2Co2e.toLocaleString()} t
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Comparison Matrix */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-display text-[15px] font-semibold text-slate-900">
          Boundary, Methodology &amp; Difference Matrix
        </h2>
        <p className="mb-3 text-[12px] text-slate-500">
          Extracted from peer1_emissions_report.pdf (Docusign FY25) &amp; peer2_emissions_report.pdf (Shopify 2024)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 font-semibold">Entity</th>
                <th className="px-3 py-2 font-semibold">Reporting Period</th>
                <th className="px-3 py-2 text-right font-semibold">Scope 1 (tCO2e)</th>
                <th className="px-3 py-2 text-right font-semibold">Scope 2 LB / Gross</th>
                <th className="px-3 py-2 text-right font-semibold">Scope 2 MB</th>
                <th className="px-3 py-2 font-semibold">Assurance &amp; Boundary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[benchmark.company, ...benchmark.peers].map((entity) => (
                <tr key={entity.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900">{entity.companyName}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {entity.sourceDocument} ({entity.sourcePages})
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{entity.reportingPeriod}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {entity.scope1Co2e.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-800 tabular-nums">
                    {entity.scope2LocationBasedCo2e !== null
                      ? entity.scope2LocationBasedCo2e.toLocaleString()
                      : 'N/A'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-800 tabular-nums">
                    {entity.scope2MarketBasedCo2e !== null
                      ? entity.scope2MarketBasedCo2e.toLocaleString()
                      : 'Not split'}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-600">
                    <div>{entity.assuranceStatus}</div>
                    {entity.intensityMetric && (
                      <div className="mt-1 font-mono text-[11px] text-slate-700">
                        Intensity: {entity.intensityMetric}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Absolute & % Diffs */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {benchmark.comparisons.map((cmp) => (
            <div key={cmp.peerId} className="rounded border border-slate-200 bg-slate-50/60 p-4">
              <div className="font-display text-[13.5px] font-semibold text-slate-900">
                Our Company (Q1 2024) vs. {cmp.companyName}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-[12px] tabular-nums">
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] text-slate-500">Scope 1 Diff</div>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    +{cmp.scope1AbsDiffVsCompany.toLocaleString()} t (
                    {cmp.scope1PctDiffVsCompany !== null ? `+${cmp.scope1PctDiffVsCompany}%` : 'N/A'})
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] text-slate-500">Scope 2 LB Diff</div>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {cmp.scope2AbsDiffVsCompany !== null
                      ? `${cmp.scope2AbsDiffVsCompany >= 0 ? '+' : ''}${cmp.scope2AbsDiffVsCompany.toLocaleString()} t (${
                          cmp.scope2PctDiffVsCompany !== null ? `${cmp.scope2PctDiffVsCompany >= 0 ? '+' : ''}${cmp.scope2PctDiffVsCompany}%` : 'N/A'
                        })`
                      : 'N/A'}
                  </div>
                </div>
              </div>
              <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[12px] text-slate-600">
                {cmp.comparabilityWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Insights */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          Strategic Insights &amp; Improvement Opportunities
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {benchmark.improvementInsights.map((insight, idx) => (
            <div key={idx} className="rounded border border-slate-200 bg-slate-50/50 p-3.5 text-[13px] leading-relaxed text-slate-700">
              {insight}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
