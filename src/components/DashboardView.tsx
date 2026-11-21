import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Filter } from 'lucide-react';
import type { EmissionsDashboardSummary, NavSection } from '../types.ts';
import { HorizontalBarChart, MonthlyTrendChart, ScopeDonutChart } from './Charts.tsx';

export function DashboardView({
  summary,
  onNavigate,
  onAskPrompt,
}: {
  summary: EmissionsDashboardSummary;
  onNavigate: (section: NavSection) => void;
  onAskPrompt: (prompt: string) => void;
}) {
  const [scopeFilter, setScopeFilter] = useState<'All' | 'Scope 1' | 'Scope 2' | 'Scope 3'>('All');
  const [donutMode, setDonutMode] = useState<'all' | 'operational'>('all');
  const [driverTab, setDriverTab] = useState<'categories' | 'activities' | 'suppliers'>('categories');

  const filteredActivities =
    scopeFilter === 'All'
      ? summary.topActivities
      : summary.topActivities.filter((a) => a.scope === scopeFilter);

  const driverItems =
    driverTab === 'categories'
      ? scopeFilter === 'Scope 1'
        ? summary.scope1Breakdown
        : scopeFilter === 'Scope 2'
          ? summary.scope2Breakdown
          : summary.scope3Categories
      : driverTab === 'activities'
        ? filteredActivities
        : summary.topSuppliers;

  return (
    <div className="space-y-6">
      {/* Coverage Asymmetry Notice */}
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-[13px] text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>{summary.coverageNotice}</div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('quality')}
          className="inline-flex shrink-0 items-center gap-1 self-start rounded border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-100/60 sm:self-center"
        >
          Inspect Audit
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scope Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-slate-600">
          <Filter className="h-3.5 w-3.5" />
          <span>Active Inventory View:</span>
          <div className="inline-flex rounded border border-slate-200 bg-white p-0.5">
            {(['All', 'Scope 1', 'Scope 2', 'Scope 3'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`whitespace-nowrap rounded-sm px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  scopeFilter === s
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[12px] text-slate-500">
          Total Verified Rows:{' '}
          <span className="font-mono font-semibold text-slate-800 tabular-nums">
            {summary.totalRecords.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Top 4 KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="text-[12px] font-medium text-slate-500">Combined Reported Footprint</div>
          <div className="mt-1.5 font-mono text-[26px] font-semibold tracking-tight text-slate-900 tabular-nums">
            {summary.totalCombinedCo2eTonnes.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1 text-[12px] text-slate-600">
            tCO2e across {summary.totalRecords.toLocaleString()} records (S1–S2 Q1 + S3 FY24)
          </div>
        </div>

        {summary.scopes.map((s) => (
          <div key={s.scope} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-slate-500">{s.scope}</span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {s.sharePercent}% share
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[26px] font-semibold tracking-tight text-slate-900 tabular-nums">
              {s.totalCo2eTonnes.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 text-[12px] text-slate-600">
              {s.monthsCovered} mos ({s.dateStart} – {s.dateEnd}) · {s.recordCount} rows
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-md border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-slate-900">
                Scope Contribution Share
              </h2>
              <p className="text-[12px] text-slate-500">
                Toggle Scope 1 vs. 2 operational view to inspect Q1 direct/energy split
              </p>
            </div>
            <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDonutMode('all')}
                className={`rounded-sm px-2 py-1 font-medium ${
                  donutMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                All Scopes
              </button>
              <button
                type="button"
                onClick={() => setDonutMode('operational')}
                className={`rounded-sm px-2 py-1 font-medium ${
                  donutMode === 'operational' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                S1 &amp; S2 Only
              </button>
            </div>
          </div>
          <ScopeDonutChart scopes={summary.scopes} operationalOnly={donutMode === 'operational'} />
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-slate-900">
                Highest-Emitting Drivers ({scopeFilter})
              </h2>
              <p className="text-[12px] text-slate-500">
                Deterministic Pandas-equivalent aggregation by category, activity, or supplier
              </p>
            </div>
            <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              {(
                [
                  { id: 'categories', label: 'Categories' },
                  { id: 'activities', label: 'Activities' },
                  { id: 'suppliers', label: 'Suppliers' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDriverTab(t.id)}
                  className={`rounded-sm px-2.5 py-1 font-medium ${
                    driverTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <HorizontalBarChart
            items={driverItems}
            color={
              scopeFilter === 'Scope 2'
                ? '#0284C7'
                : driverTab === 'suppliers'
                  ? '#334155'
                  : '#047857'
            }
            maxItems={8}
          />
        </div>
      </div>

      {/* Monthly Trend + Operational Facility Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-md border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-slate-900">
                2024 Monthly Emissions Timeline ({scopeFilter})
              </h2>
              <p className="text-[12px] text-slate-500">
                Months 01–03 include all 3 scopes; Months 04–12 reflect Scope 3 only
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onAskPrompt('What is our highest emitting Scope 3 category and what specific activities contribute to it?')
              }
              className="text-[12px] font-medium text-emerald-700 hover:underline"
            >
              Ask Agent about drivers →
            </button>
          </div>
          <MonthlyTrendChart trends={summary.monthlyTrends} scopeFilter={scopeFilter} />
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-slate-900">
                Facility Operational Footprint (Q1 2024)
              </h2>
              <p className="text-[12px] text-slate-500">
                Scope 1 &amp; Scope 2 combined by physical site
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2 font-medium">Facility</th>
                  <th className="py-2 px-2 text-right font-medium">CO2e (t)</th>
                  <th className="py-2 pl-2 text-right font-medium">S1+S2 Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.facilities.map((fac) => (
                  <tr key={fac.name} className="hover:bg-slate-50/70">
                    <td className="py-2 pr-2 font-medium text-slate-900">{fac.name}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-800 tabular-nums">
                      {fac.co2eTonnes.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-slate-600 tabular-nums">
                      {fac.shareOfScopePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Supplier Engagement Snapshot Table */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-slate-900">
              Scope 3 Supplier Ranking &amp; Spend Summary
            </h2>
            <p className="text-[12px] text-slate-500">
              Note: Data Quality Audit flagged supplier-to-activity ledger mismatches requiring ERP verification before supplier engagement.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onAskPrompt('Which suppliers should I prioritise to engage for emissions reduction efforts?')
            }
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Analyze Supplier Priorities with AI
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[12px] text-slate-600">
                <th className="px-3 py-2 font-semibold">Supplier</th>
                <th className="px-3 py-2 text-right font-semibold">Emissions (tCO2e)</th>
                <th className="px-3 py-2 text-right font-semibold">Scope 3 Share</th>
                <th className="px-3 py-2 text-right font-semibold">Spend (USD)</th>
                <th className="px-3 py-2 text-right font-semibold">Records</th>
                <th className="px-3 py-2 font-semibold">Top Listed Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.topSuppliers.map((sup) => (
                <tr key={sup.name} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{sup.name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                    {sup.co2eTonnes.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                    {sup.shareOfScopePercent}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                    ${sup.totalActivityOrSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                    {sup.recordCount}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-600">
                    {(sup.topActivities ?? []).slice(0, 3).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
