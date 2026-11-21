import React, { useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { ExecutiveReportData } from '../types.ts';

function buildReportMarkdown(report: ExecutiveReportData): string {
  const lines: string[] = [
    `# Corporate GHG Emissions Executive Report`,
    `Generated: ${new Date(report.generatedAt).toUTCString()}`,
    ``,
    `## 1. Reporting Coverage & Total Footprint`,
    `- **Combined Reported Emissions:** ${report.totalCombinedCo2eTonnes.toLocaleString()} tCO2e`,
    `- **Coverage Notice:** ${report.coverageNotice}`,
    ``,
    `## 2. Emissions Breakdown by Scope`,
    ...report.scopeSummary.map(
      (s) =>
        `- **${s.scope}:** ${s.totalCo2eTonnes.toLocaleString()} tCO2e (${s.sharePercent}% of combined) — ${s.coverageLabel} (${s.recordCount} records)`
    ),
    ``,
    `## 3. Top Scope 3 Categories (As Reported)`,
    ...report.topScope3Categories.map(
      (c, i) => `${i + 1}. **${c.name}:** ${c.co2eTonnes.toLocaleString()} tCO2e (${c.shareOfScopePercent}% of Scope 3)`
    ),
    ``,
    `## 4. Highest-Emitting Activities`,
    ...report.topActivities.map(
      (a, i) => `${i + 1}. **${a.name}:** ${a.co2eTonnes.toLocaleString()} tCO2e`
    ),
    ``,
    `## 5. Data Quality Assessment`,
    `- **Completeness Score:** ${report.qualityOverview.completenessScore}%`,
    `- **Composite Quality Score:** ${report.qualityOverview.qualityScore}/100 (${report.qualityOverview.qualityRating})`,
    ...report.qualityOverview.criticalIssues.map(
      (i) => `- [${i.severity}] ${i.checkName} (${i.affectedRows} rows affected)`
    ),
    `- *Disclaimer:* ${report.qualityOverview.complianceDisclaimer}`,
    ``,
    `## 6. Prioritized Reduction & Governance Recommendations`,
    ...report.recommendations.map(
      (r, i) => `${i + 1}. **[${r.priority}] ${r.title}:** ${r.impact}`
    ),
  ];
  return lines.join('\n');
}

export function ReportsView({ report }: { report: ExecutiveReportData }) {
  const [copied, setCopied] = useState(false);

  const handleDownloadCsv = () => {
    window.location.assign('/api/export/csv');
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 48;
    const margin = 44;
    const maxWidth = 507;

    const addHeading = (text: string) => {
      if (y > 750) {
        doc.addPage();
        y = 48;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(text, margin, y);
      y += 18;
    };

    const addParagraph = (text: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const wrapped = doc.splitTextToSize(text, maxWidth) as string[];
      for (const line of wrapped) {
        if (y > 775) {
          doc.addPage();
          y = 48;
        }
        doc.text(line, margin, y);
        y += 13;
      }
      y += 4;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CarbonLens — Corporate GHG Emissions Executive Report', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date(report.generatedAt).toUTCString()}`, margin, y);
    y += 22;

    addHeading('1. Executive Summary & Period Coverage');
    addParagraph(
      `Combined Reported Emissions: ${report.totalCombinedCo2eTonnes.toLocaleString()} tCO2e. ${report.coverageNotice}`
    );

    addHeading('2. Scope Breakdown');
    for (const s of report.scopeSummary) {
      addParagraph(
        `${s.scope}: ${s.totalCo2eTonnes.toLocaleString()} tCO2e (${s.sharePercent}% share) — ${s.coverageLabel} [${s.recordCount} rows]`
      );
    }

    addHeading('3. Top Scope 3 Categories & Key Activity Drivers');
    for (const c of report.topScope3Categories) {
      addParagraph(`${c.name}: ${c.co2eTonnes.toLocaleString()} tCO2e (${c.shareOfScopePercent}% of Scope 3)`);
    }
    addParagraph(
      `Top Activities: ${report.topActivities
        .slice(0, 5)
        .map((a) => `${a.name} (${a.co2eTonnes.toLocaleString()} t)`)
        .join('; ')}`
    );

    addHeading('4. Data Quality Audit Summary');
    addParagraph(
      `Completeness Score: ${report.qualityOverview.completenessScore}% | Quality Score: ${report.qualityOverview.qualityScore}/100 (${report.qualityOverview.qualityRating}).`
    );
    for (const issue of report.qualityOverview.criticalIssues) {
      addParagraph(`[${issue.severity}] ${issue.checkName} (${issue.affectedRows} rows affected)`);
    }
    addParagraph(`Disclaimer: ${report.qualityOverview.complianceDisclaimer}`);

    addHeading('5. Prioritized Recommendations');
    for (const rec of report.recommendations) {
      addParagraph(`[${rec.priority}] ${rec.title} — ${rec.impact}`);
    }

    doc.save('carbonlens_executive_emissions_report.pdf');
  };

  const handleCopyMarkdown = async () => {
    const md = buildReportMarkdown(report);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Export Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-display text-[16px] font-semibold text-slate-900">
            Executive Emissions Summary Report
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-600">
            Deterministic inventory report compiled from Scope 1–3 CSVs, Quality Audit, and Peer Benchmarks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-800 hover:bg-slate-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied Markdown' : 'Copy Markdown'}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-800 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            Download Unified CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded bg-emerald-800 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-emerald-900"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Report Document Body */}
      <div className="space-y-6 rounded-md border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 font-mono text-[11.5px] text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            REPORT SNAPSHOT · {new Date(report.generatedAt).toLocaleString()}
          </div>
          <h3 className="mt-1 font-display text-[18px] font-bold text-slate-900">
            1. Total Emissions by Scope &amp; Period Coverage
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{report.coverageNotice}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[12px] text-slate-600">
                <th className="px-3 py-2 font-semibold">Scope</th>
                <th className="px-3 py-2 text-right font-semibold">Total CO2e (t)</th>
                <th className="px-3 py-2 text-right font-semibold">Share of Combined</th>
                <th className="px-3 py-2 text-right font-semibold">Records</th>
                <th className="px-3 py-2 font-semibold">Coverage Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.scopeSummary.map((s) => (
                <tr key={s.scope}>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{s.scope}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {s.totalCo2eTonnes.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                    {s.sharePercent}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                    {s.recordCount}
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-slate-600">{s.coverageLabel}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2.5 text-slate-900">Combined Reported Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                  {report.totalCombinedCo2eTonnes.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-900 tabular-nums">100%</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                  {report.scopeSummary.reduce((a, s) => a + s.recordCount, 0)}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-600">Q1 S1–S2 + FY24 S3</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="font-display text-[15px] font-semibold text-slate-900">
              2. Top 5 Scope 3 Categories (As Reported)
            </h4>
            <div className="mt-2.5 divide-y divide-slate-100 rounded border border-slate-200">
              {report.topScope3Categories.map((c, idx) => (
                <div key={c.name} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                  <span className="truncate pr-3 font-medium text-slate-800">
                    {idx + 1}. {c.name}
                  </span>
                  <span className="shrink-0 font-mono font-semibold text-slate-900 tabular-nums">
                    {c.co2eTonnes.toLocaleString()} t ({c.shareOfScopePercent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-[15px] font-semibold text-slate-900">
              3. Data Quality Audit Summary
            </h4>
            <div className="mt-2.5 space-y-2 rounded border border-slate-200 p-3.5 text-[12.5px]">
              <div className="flex justify-between font-mono tabular-nums">
                <span className="text-slate-600">Completeness / Quality</span>
                <span className="font-semibold text-slate-900">
                  {report.qualityOverview.completenessScore}% / {report.qualityOverview.qualityScore} pts (
                  {report.qualityOverview.qualityRating})
                </span>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {report.qualityOverview.criticalIssues.map((ci) => (
                  <li key={ci.id}>
                    <span className="font-semibold">[{ci.severity}]</span> {ci.checkName} (
                    <span className="font-mono">{ci.affectedRows}</span> rows)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-display text-[15px] font-semibold text-slate-900">
            4. Prioritized Abatement &amp; Governance Roadmap
          </h4>
          <div className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.recommendations.map((rec, idx) => (
              <div key={idx} className="rounded border border-slate-200 bg-slate-50/50 p-3.5">
                <div className="font-mono text-[11px] font-semibold text-emerald-800">{rec.priority}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold text-slate-900">{rec.title}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{rec.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
