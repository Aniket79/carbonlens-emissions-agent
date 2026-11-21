import React, { useState } from 'react';
import type { MonthlyTrendPoint, PeerBenchmarkResult, RankedEmissionBucket, ScopeSummaryItem } from '../types.ts';

const SCOPE_COLORS: Record<string, string> = {
  'Scope 1': '#047857',
  'Scope 2': '#0284C7',
  'Scope 3': '#475569',
};

export function ScopeDonutChart({
  scopes,
  operationalOnly = false,
}: {
  scopes: ScopeSummaryItem[];
  operationalOnly?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const items = operationalOnly ? scopes.filter((s) => s.scope !== 'Scope 3') : scopes;
  const total = items.reduce((acc, s) => acc + s.totalCo2eTonnes, 0);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative h-36 w-36 shrink-0 self-center">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="22" />
          {items.map((item) => {
            const pct = total > 0 ? item.totalCo2eTonnes / total : 0;
            const dash = pct * circumference;
            const currentOffset = offset;
            offset += dash;
            const isActive = hovered === item.scope;
            return (
              <circle
                key={item.scope}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={SCOPE_COLORS[item.scope] ?? '#64748B'}
                strokeWidth={isActive ? 26 : 22}
                strokeDasharray={`${Math.max(dash, pct > 0 ? 3 : 0)} ${circumference}`}
                strokeDashoffset={-currentOffset}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHovered(item.scope)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {hovered ?? (operationalOnly ? 'S1 + S2 (Q1)' : 'Total')}
          </span>
          <span className="font-mono text-[13.5px] font-semibold text-slate-900 tabular-nums">
            {(hovered
              ? items.find((i) => i.scope === hovered)?.totalCo2eTonnes ?? total
              : total
            ).toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
          <span className="text-[10px] text-slate-500">tCO2e</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {items.map((item) => {
          const share = total > 0 ? ((item.totalCo2eTonnes / total) * 100).toFixed(2) : '0.00';
          return (
            <div
              key={item.scope}
              onMouseEnter={() => setHovered(item.scope)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 transition-colors ${
                hovered === item.scope
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: SCOPE_COLORS[item.scope] ?? '#64748B' }}
                />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-slate-900">{item.scope}</div>
                  <div className="whitespace-nowrap text-[11px] text-slate-500">
                    {item.recordCount.toLocaleString()} rows · {item.monthsCovered}m
                  </div>
                </div>
              </div>
              <div className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums">
                <div className="text-[12.5px] font-semibold text-slate-900">
                  {item.totalCo2eTonnes.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-[11px] font-normal text-slate-500">t</span>
                </div>
                <div className="text-[11px] text-slate-500">{share}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorizontalBarChart({
  items,
  color = '#047857',
  maxItems = 8,
  valueUnit = 'tCO2e',
}: {
  items: RankedEmissionBucket[];
  color?: string;
  maxItems?: number;
  valueUnit?: string;
}) {
  const sliced = items.slice(0, maxItems);
  const maxVal = Math.max(...sliced.map((i) => i.co2eTonnes), 1);

  if (sliced.length === 0) {
    return <p className="py-6 text-center text-[13px] text-slate-500">No records match the current filter.</p>;
  }

  return (
    <div className="space-y-2.5">
      {sliced.map((item) => {
        const widthPct = Math.max(2, (item.co2eTonnes / maxVal) * 100);
        return (
          <div key={item.name} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
              <span className="truncate font-medium text-slate-800" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-mono text-slate-700 tabular-nums">
                {item.co2eTonnes.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {valueUnit}{' '}
                <span className="text-slate-400">({item.shareOfScopePercent}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
              <div
                className="h-full rounded-sm transition-all duration-300 group-hover:opacity-85"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlyTrendChart({
  trends,
  scopeFilter,
}: {
  trends: MonthlyTrendPoint[];
  scopeFilter: 'All' | 'Scope 1' | 'Scope 2' | 'Scope 3';
}) {
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyTrendPoint | null>(null);

  if (trends.length === 0) {
    return <p className="py-8 text-center text-[13px] text-slate-500">No monthly trend data available.</p>;
  }

  const getValue = (pt: MonthlyTrendPoint) => {
    if (scopeFilter === 'Scope 1') return pt.scope1;
    if (scopeFilter === 'Scope 2') return pt.scope2;
    if (scopeFilter === 'Scope 3') return pt.scope3;
    return pt.total;
  };

  const maxVal = Math.max(...trends.map(getValue), 1);
  const chartW = 720;
  const chartH = 210;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const barSlot = plotW / Math.max(1, trends.length);
  const barW = Math.min(34, barSlot * 0.62);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

  return (
    <div>
      <div className="mb-2 flex min-h-[22px] items-center justify-between text-[12px] text-slate-600">
        {hoveredMonth ? (
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <span className="font-semibold text-slate-900">{hoveredMonth.month}</span>
            <span>S1: {hoveredMonth.hasScope1 ? `${hoveredMonth.scope1.toLocaleString()} t` : 'Missing'}</span>
            <span>S2: {hoveredMonth.hasScope2 ? `${hoveredMonth.scope2.toLocaleString()} t` : 'Missing'}</span>
            <span>S3: {hoveredMonth.hasScope3 ? `${hoveredMonth.scope3.toLocaleString()} t` : 'Missing'}</span>
          </div>
        ) : (
          <span>Hover a month bar to inspect Scope 1, Scope 2, and Scope 3 values</span>
        )}
      </div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full overflow-visible">
        {ticks.map((t, idx) => {
          const y = padT + plotH - (t / maxVal) * plotH;
          return (
            <g key={idx}>
              <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[10px]"
              >
                {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
              </text>
            </g>
          );
        })}

        {trends.map((pt, idx) => {
          const val = getValue(pt);
          const h = (val / maxVal) * plotH;
          const x = padL + idx * barSlot + (barSlot - barW) / 2;
          const y = padT + plotH - h;
          const isQ1 = pt.hasScope1 && pt.hasScope2;
          const fill =
            scopeFilter === 'Scope 1'
              ? '#047857'
              : scopeFilter === 'Scope 2'
                ? '#0284C7'
                : isQ1
                  ? '#047857'
                  : '#64748B';

          return (
            <g
              key={pt.month}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredMonth(pt)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <rect
                x={x}
                y={Math.max(padT, y)}
                width={barW}
                height={Math.max(2, h)}
                rx="2"
                fill={fill}
                opacity={hoveredMonth && hoveredMonth.month !== pt.month ? 0.55 : 1}
              />
              <text
                x={x + barW / 2}
                y={chartH - 12}
                textAnchor="middle"
                className="fill-slate-600 font-mono text-[10px]"
              >
                {pt.month.slice(5)}
              </text>
              {!isQ1 && scopeFilter === 'All' && (
                <text
                  x={x + barW / 2}
                  y={chartH - 1}
                  textAnchor="middle"
                  className="fill-amber-700 font-sans text-[8px]"
                >
                  S3 only
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PeerGroupedBarChart({ benchmark }: { benchmark: PeerBenchmarkResult }) {
  const rows = [
    {
      name: 'Our Company (Q1 2024)',
      scope1: benchmark.company.scope1Co2e,
      scope2Location: benchmark.company.scope2LocationBasedCo2e ?? 0,
      scope2Market: null as number | null,
    },
    ...benchmark.peers.map((p) => ({
      name: p.companyName.replace(', Inc.', '').replace(' Inc.', '') + (p.id === 'peer1-docusign' ? ' (FY25)' : ' (2024)'),
      scope1: p.scope1Co2e,
      scope2Location: p.scope2LocationBasedCo2e ?? 0,
      scope2Market: p.scope2MarketBasedCo2e,
    })),
  ];

  const maxVal = Math.max(
    ...rows.flatMap((r) => [r.scope1, r.scope2Location, r.scope2Market ?? 0]),
    100
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#047857]" /> Scope 1 (Direct)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#0284C7]" /> Scope 2 (Location / Gross)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#D97706]" /> Scope 2 (Market-Based, where disclosed)
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.name} className="rounded border border-slate-200 bg-slate-50/50 p-3">
            <div className="mb-2 text-[13px] font-semibold text-slate-900">{row.name}</div>
            <div className="space-y-2">
              {[
                { label: 'Scope 1', val: row.scope1, color: '#047857' },
                { label: 'Scope 2 (LB/Gross)', val: row.scope2Location, color: '#0284C7' },
                ...(row.scope2Market !== null
                  ? [{ label: 'Scope 2 (MB)', val: row.scope2Market, color: '#D97706' }]
                  : []),
              ].map((bar) => (
                <div key={bar.label} className="grid grid-cols-[135px_1fr_92px] items-center gap-3 text-[12px]">
                  <span className="text-slate-600">{bar.label}</span>
                  <div className="h-2.5 overflow-hidden rounded-sm bg-slate-200/70">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.max(bar.val > 0 ? 1.5 : 0, (bar.val / maxVal) * 100)}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono font-medium text-slate-900 tabular-nums">
                    {bar.val.toLocaleString(undefined, { maximumFractionDigits: 1 })} t
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
