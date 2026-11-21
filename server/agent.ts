import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { comparePeerEmissions } from './benchmarkEngine.ts';
import {
  buildEmissionsSummary,
  getHighestEmittingCategories,
  getSupplierEmissionsBreakdown,
  type LoadedInventory,
} from './emissionsEngine.ts';
import { assessEmissionsQuality } from './qualityEngine.ts';
import { searchGhgProtocol } from './ragEngine.ts';
import type { AgentChatResponse, AgentToolTrace } from './types.ts';

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured in server environment.');
  }
  return new Groq({ apiKey });
}

export async function callGroqWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? String(err);
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('rate_limit') ||
        (err as { status?: number })?.status === 429;
      if (isRateLimit && attempt < maxRetries - 1) {
        let waitMs = 8000;
        const match = /try again in (\d+\.?\d*)s/i.exec(msg);
        if (match && match[1]) {
          waitMs = Math.max(2000, (parseFloat(match[1]) + 1.5) * 1000);
        }
        console.warn(
          `[Groq Rate Limit 429] Retrying in ${Math.round(waitMs / 1000)}s (attempt ${
            attempt + 1
          }/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Exceeded maximum retry attempts for Groq API');
}


export const AGENT_TOOL_DECLARATIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_emissions_summary',
      description:
        'Retrieve overall deterministic emissions totals across Scope 1, Scope 2, and Scope 3, percentage shares, reporting coverage windows, facilities, and Scope 2 renewable energy metrics.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_scope_breakdown',
      description:
        'Retrieve detailed emissions breakdown for a specific scope (Scope 1, Scope 2, or Scope 3), including monthly trends and sub-activity/facility totals.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            description: 'Must be one of: "Scope 1", "Scope 2", or "Scope 3".',
          },
        },
        required: ['scope'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_highest_emitting_categories',
      description:
        'Rank the highest-emitting categories and specific activities within Scope 3 or across all scopes, including tCO2e totals and percentage shares.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            description: 'Optional scope filter: "Scope 1", "Scope 2", "Scope 3", or "All". Defaults to "Scope 3".',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of categories/activities to return (default 10).',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_supplier_emissions',
      description:
        'Rank Scope 3 suppliers by total tCO2e emissions, spend in USD, emission intensity (kgCO2e/USD), top activities, and data quality tier breakdown.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of top suppliers to return (default 8).',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'assess_emissions_quality',
      description:
        'Run the deterministic emissions data quality and GHG Protocol validity audit across Scope 1, Scope 2, and Scope 3, returning completeness/quality scores, detected issues, severity levels, affected rows, and corrective actions.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            description: 'Optional filter: "Scope 1", "Scope 2", "Scope 3", "Cross-Scope", or "All".',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_ghg_protocol',
      description:
        'Search the GHG Protocol Corporate Standard (ghg-protocol-revised.pdf, 116 pages) using hybrid semantic + keyword retrieval and return relevant passages with PDF page numbers and chapters.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query about GHG Protocol rules, scopes, boundaries, calculation methods, business travel, Scope 2, or verification.',
          },
          topK: {
            type: 'number',
            description: 'Number of passages to retrieve (default 6).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_peer_emissions',
      description:
        'Compare our Scope 1 and Scope 2 emissions against peer sustainability reports (Docusign FY25 and Shopify CY2024), returning absolute and percentage differences, rankings, and comparability limitation flags.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_emissions_report',
      description:
        'Generate a comprehensive deterministic executive emissions summary report covering totals by scope, top Scope 3 categories, key drivers, data quality score, peer comparison context, and prioritized reduction opportunities.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export async function buildDeterministicReport(inventory: LoadedInventory) {
  const summary = buildEmissionsSummary(inventory);
  const quality = assessEmissionsQuality(inventory);
  const benchmark = await comparePeerEmissions(summary);

  return {
    generatedAt: new Date().toISOString(),
    companyName: summary.companyName,
    totalCombinedCo2eTonnes: summary.totalCombinedCo2eTonnes,
    coverageNotice: summary.coverageNotice,
    scopeSummary: summary.scopes,
    topScope3Categories: summary.scope3Categories.slice(0, 5),
    topActivities: summary.topActivities.slice(0, 6),
    topSuppliers: summary.topSuppliers.slice(0, 5),
    facilities: summary.facilities,
    qualityOverview: {
      completenessScore: quality.completenessScore,
      qualityScore: quality.qualityScore,
      qualityRating: quality.qualityRating,
      criticalIssues: quality.issues
        .filter((i) => i.severity === 'Critical' || i.severity === 'High')
        .map((i) => ({
          id: i.id,
          severity: i.severity,
          checkName: i.checkName,
          affectedRows: i.affectedRows,
        })),
      complianceDisclaimer: quality.complianceDisclaimer,
    },
    peerOverview: {
      comparisons: benchmark.comparisons,
      limitations: benchmark.methodologyLimitations,
    },
    recommendations: [
      {
        priority: 'Immediate (Data Governance)',
        title: 'Complete Q2–Q4 2024 Scope 1 & 2 Logs and Fix Scope 3 Category/Supplier Taxonomy',
        impact: 'Fixes reporting asymmetry and reclassifies mismatched Scope 3 categories so decarbonization targets target real activities.',
      },
      {
        priority: 'Immediate (GHG Protocol Alignment)',
        title: 'Implement Dual Scope 2 Reporting (Location-Based vs. Market-Based) & Verify EACs',
        impact: `Formalizes the ${summary.scope2RenewableSummary.potentialMarketBasedReductionCo2e} tCO2e implied electricity reduction from 10%–45% renewable shares and adds supplier-specific steam emission factors.`,
      },
      {
        priority: 'High Abatement (Scope 1 & 2)',
        title: 'Decarbonize Manufacturing Plant Thermal & Process Footprint',
        impact: 'Manufacturing Plant drives 94.4% of Scope 1 (Coal 895.40 + Cement 702.00 tCO2e) and 84.7% of Scope 2 (Process Steam 1,887.00 + Electricity 231.56 tCO2e).',
      },
      {
        priority: 'High Abatement (Scope 3)',
        title: 'Target Top Spend-Based Activities & Transition to Primary Supplier Data',
        impact: 'Business Travel - Air (46,312.07 tCO2e), IT Hardware (45,226.26 tCO2e), and Product Use Phase (40,650.09 tCO2e) lead activity emissions; audit supplier master mappings before launching vendor reduction SLAs.',
      },
    ],
  };
}

export async function runEmissionsAgent(
  inventory: LoadedInventory,
  userMessage: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<AgentChatResponse> {
  const groq = getGroqClient();
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const summary = buildEmissionsSummary(inventory);

  const systemInstruction = `You are CarbonLens, an expert AI Emissions Analysis & Insights Agent for sustainability professionals.

CRITICAL OPERATING RULES:
1. NEVER calculate emissions totals, percentages, rankings, or differences yourself. Always invoke the provided deterministic tools to retrieve exact numbers from the uploaded CSVs, validation engine, peer PDFs, and GHG Protocol PDF.
2. ALWAYS report exact figures and explicitly note the reporting period asymmetry when comparing scopes: Scope 1 (${summary.scopes[0].monthsCovered} mos: Q1 2024) and Scope 2 (${summary.scopes[1].monthsCovered} mos: Q1 2024) cover Q1 only, while Scope 3 covers ${summary.scopes[2].monthsCovered} months (FY 2024).
3. For GHG Protocol rules or methodology questions (e.g., business travel scope, Scope 2 validity, organizational boundaries), ALWAYS call search_ghg_protocol AND (when evaluating user data) assess_emissions_quality. Cite exact PDF page numbers from retrieved chunks, and explicitly distinguish:
   - What comes from ghg-protocol-revised.pdf (2004 Revised Edition)
   - Subsequent guidance notes (such as 2015 Scope 2 Guidance formalizing Location-Based vs. Market-Based dual reporting)
   - General implementation recommendations.
4. For supplier prioritization questions, ALWAYS call get_supplier_emissions AND assess_emissions_quality so you present the ranked suppliers while candidly flagging the detected supplier-to-activity ledger mismatches in scope3.csv!
5. For peer benchmarking questions, ALWAYS call compare_peer_emissions and explicitly highlight all comparability limitations (Q1 vs 12-month periods, Market-Based vs Location-Based Scope 2, Steam & Manufacturing vs SaaS offices, missing intensity metrics).
6. Never claim formal GHG Protocol compliance or third-party assurance based solely on automated checks. Never invent missing data.
7. Structure your final answer clearly in Markdown with concise headings, bullet points, and exact numbers.`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
  ];

  for (const h of history.slice(-6)) {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    });
  }

  messages.push({
    role: 'user',
    content: userMessage,
  });

  const toolTraces: AgentToolTrace[] = [];
  const collectedCitations: Array<{ source: string; page: string; excerpt: string }> = [];
  let evidenceTable: AgentChatResponse['evidenceTable'] | undefined;

  async function executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'get_emissions_summary': {
        toolTraces.push({
          toolName: name,
          args,
          summary: `Total ${summary.totalCombinedCo2eTonnes.toLocaleString()} tCO2e (S1: ${summary.scope1TotalCo2e}, S2: ${summary.scope2TotalCo2e}, S3: ${summary.scope3TotalCo2e})`,
          dataPreview: summary.scopes,
        });
        return {
          totalCombinedCo2eTonnes: summary.totalCombinedCo2eTonnes,
          coverageNotice: summary.coverageNotice,
          scopes: summary.scopes,
          facilities: summary.facilities,
          scope2RenewableSummary: summary.scope2RenewableSummary,
        };
      }
      case 'get_scope_breakdown': {
        const scope = String(args.scope ?? 'Scope 1');
        if (scope === 'Scope 1') {
          toolTraces.push({
            toolName: name,
            args,
            summary: `Scope 1: ${summary.scope1TotalCo2e} tCO2e across ${summary.scope1Breakdown.length} fuel/process streams`,
            dataPreview: summary.scope1Breakdown,
          });
          return {
            scope: 'Scope 1',
            totalCo2eTonnes: summary.scope1TotalCo2e,
            period: summary.scopes[0].coverageLabel,
            breakdown: summary.scope1Breakdown,
            monthlyTrends: summary.monthlyTrends.filter((m) => m.hasScope1),
          };
        }
        if (scope === 'Scope 2') {
          toolTraces.push({
            toolName: name,
            args,
            summary: `Scope 2: ${summary.scope2TotalCo2e} tCO2e across Electricity & Steam`,
            dataPreview: summary.scope2Breakdown,
          });
          return {
            scope: 'Scope 2',
            totalCo2eTonnes: summary.scope2TotalCo2e,
            period: summary.scopes[1].coverageLabel,
            breakdown: summary.scope2Breakdown,
            renewableSummary: summary.scope2RenewableSummary,
            monthlyTrends: summary.monthlyTrends.filter((m) => m.hasScope2),
          };
        }
        toolTraces.push({
          toolName: name,
          args,
          summary: `Scope 3: ${summary.scope3TotalCo2e} tCO2e across 15 categories`,
          dataPreview: summary.scope3Categories.slice(0, 8),
        });
        return {
          scope: 'Scope 3',
          totalCo2eTonnes: summary.scope3TotalCo2e,
          period: summary.scopes[2].coverageLabel,
          categories: summary.scope3Categories,
          topActivities: summary.topActivities.filter((a) => a.scope === 'Scope 3'),
          monthlyTrends: summary.monthlyTrends,
        };
      }
      case 'get_highest_emitting_categories': {
        const scopeFilter = (args.scope as 'Scope 1' | 'Scope 2' | 'Scope 3' | 'All') ?? 'Scope 3';
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const result = getHighestEmittingCategories(inventory, scopeFilter, limit);
        const cats = 'categories' in result && result.categories ? result.categories : undefined;
        const topCat = cats ? cats[0] : result.scope3TopCategories?.[0];
        toolTraces.push({
          toolName: name,
          args: { scope: scopeFilter, limit },
          summary: topCat
            ? `Top in ${scopeFilter}: ${topCat.name} (${topCat.co2eTonnes.toLocaleString()} tCO2e)`
            : `Retrieved ${scopeFilter} categories`,
          dataPreview: cats ? cats.slice(0, 6) : result.scope3TopCategories?.slice(0, 6),
        });
        if (cats && cats.length > 0 && !evidenceTable) {
          evidenceTable = {
            title: `Top ${scopeFilter} Emitting Categories`,
            columns: ['Category', 'Emissions (tCO2e)', 'Share of Scope (%)', 'Records'],
            rows: cats.slice(0, 8).map((c) => [
              c.name,
              c.co2eTonnes.toLocaleString(),
              `${c.shareOfScopePercent}%`,
              c.recordCount,
            ]),
          };
        }
        return result;
      }
      case 'get_supplier_emissions': {
        const limit = typeof args.limit === 'number' ? args.limit : 8;
        const result = getSupplierEmissionsBreakdown(inventory, limit);
        toolTraces.push({
          toolName: name,
          args: { limit },
          summary: `Ranked ${result.suppliers.length} suppliers (Top: ${result.suppliers[0]?.supplier ?? 'N/A'} at ${result.suppliers[0]?.co2eTonnes.toLocaleString() ?? 0} tCO2e)`,
          dataPreview: result.suppliers,
        });
        evidenceTable = {
          title: 'Scope 3 Supplier Emissions & Intensity Ranking',
          columns: ['Supplier', 'Emissions (tCO2e)', 'Share (%)', 'Spend (USD)', 'Intensity (kg/$)'],
          rows: result.suppliers.map((s) => [
            s.supplier,
            s.co2eTonnes.toLocaleString(),
            `${s.shareOfScope3Percent}%`,
            `$${s.totalSpendUsd.toLocaleString()}`,
            s.emissionIntensityKgPerUsd,
          ]),
        };
        return result;
      }
      case 'assess_emissions_quality': {
        const quality = assessEmissionsQuality(inventory);
        const scopeFilter = args.scope ? String(args.scope) : 'All';
        const filteredIssues =
          scopeFilter === 'All'
            ? quality.issues
            : quality.issues.filter(
                (i) => i.scope === scopeFilter || i.scope === 'Cross-Scope'
              );
        toolTraces.push({
          toolName: name,
          args: { scope: scopeFilter },
          summary: `Quality Score: ${quality.qualityScore}/100 (${quality.qualityRating}) | Completeness: ${quality.completenessScore}% | ${filteredIssues.length} checks`,
          dataPreview: filteredIssues.map((i) => ({
            id: i.id,
            severity: i.severity,
            checkName: i.checkName,
            affectedRows: i.affectedRows,
          })),
        });
        return {
          completenessScore: quality.completenessScore,
          qualityScore: quality.qualityScore,
          qualityRating: quality.qualityRating,
          scoringMethodology: quality.scoringMethodology,
          issues: filteredIssues,
          complianceDisclaimer: quality.complianceDisclaimer,
        };
      }
      case 'search_ghg_protocol': {
        const query = String(args.query ?? '');
        const topK = typeof args.topK === 'number' ? args.topK : 6;
        const passages = await searchGhgProtocol(query, topK);
        for (const p of passages) {
          collectedCitations.push({
            source: p.chunk.sourceDocument,
            page: `PDF p. ${p.chunk.pdfPage}${p.chunk.printedPage ? ` (doc p. ${p.chunk.printedPage})` : ''}`,
            excerpt: p.chunk.text.slice(0, 220) + (p.chunk.text.length > 220 ? '…' : ''),
          });
        }
        toolTraces.push({
          toolName: name,
          args: { query, topK },
          summary: `Retrieved ${passages.length} GHG Protocol passages (pages ${passages
            .map((p) => p.chunk.pdfPage)
            .join(', ')})`,
        });
        return {
          passages: passages.map((p) => ({
            source: p.chunk.sourceDocument,
            pdfPage: p.chunk.pdfPage,
            printedPage: p.chunk.printedPage,
            chapter: p.chunk.chapter,
            score: p.score,
            text: p.chunk.text,
          })),
        };
      }
      case 'compare_peer_emissions': {
        const benchmark = await comparePeerEmissions(summary);
        for (const peer of benchmark.peers) {
          collectedCitations.push({
            source: peer.sourceDocument,
            page: peer.sourcePages,
            excerpt: `${peer.companyName} (${peer.reportingPeriod}): Scope 1 = ${peer.scope1Co2e} tCO2e, Scope 2 LB = ${peer.scope2LocationBasedCo2e ?? 'N/A'} tCO2e, Scope 2 MB = ${peer.scope2MarketBasedCo2e ?? 'N/A'} tCO2e.`,
          });
        }
        toolTraces.push({
          toolName: name,
          args,
          summary: `Compared vs. ${benchmark.peers.map((p) => p.companyName).join(' & ')} (${benchmark.methodologyLimitations.length} limitation flags)`,
          dataPreview: benchmark.comparisons,
        });
        evidenceTable = {
          title: 'Scope 1 & 2 Peer Comparison Matrix',
          columns: ['Company', 'Period', 'Scope 1 (tCO2e)', 'Scope 2 Comparable (tCO2e)', 'Scope 2 Method'],
          rows: [
            [
              benchmark.company.companyName,
              'Q1 2024 (3 mos)',
              benchmark.company.scope1Co2e.toLocaleString(),
              benchmark.company.scope2LocationBasedCo2e?.toLocaleString() ?? 'N/A',
              'Unadjusted grid + steam',
            ],
            ...benchmark.peers.map((p) => [
              p.companyName,
              p.reportingPeriod,
              p.scope1Co2e.toLocaleString(),
              p.id === 'peer1-docusign'
                ? `${p.scope2LocationBasedCo2e?.toLocaleString()} LB / ${p.scope2MarketBasedCo2e} MB`
                : (p.scope2LocationBasedCo2e?.toLocaleString() ?? 'N/A'),
              p.id === 'peer1-docusign' ? 'Dual (LB & MB 100% EACs)' : 'Gross building elec.',
            ]),
          ],
        };
        return benchmark as unknown as Record<string, unknown>;
      }
      case 'generate_emissions_report': {
        const report = await buildDeterministicReport(inventory);
        toolTraces.push({
          toolName: name,
          args,
          summary: `Compiled executive summary report (${report.totalCombinedCo2eTonnes.toLocaleString()} tCO2e, Quality ${report.qualityOverview.qualityScore}/100)`,
        });
        evidenceTable = {
          title: 'Corporate Emissions Inventory by Scope',
          columns: ['Scope', 'Emissions (tCO2e)', 'Share (%)', 'Records', 'Period Coverage'],
          rows: report.scopeSummary.map((s) => [
            s.scope,
            s.totalCo2eTonnes.toLocaleString(),
            `${s.sharePercent}%`,
            s.recordCount,
            s.coverageLabel,
          ]),
        };
        return report as unknown as Record<string, unknown>;
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  let finalText = '';
  for (let round = 0; round < 8; round += 1) {
    const completion = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model,
        messages,
        tools: AGENT_TOOL_DECLARATIONS as any,
        tool_choice: 'auto',
        temperature: 0.1,
      })
    );

    const choice = completion.choices[0];
    const msg = choice?.message;
    if (!msg) break;

    const toolCalls = msg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      finalText = msg.content || '';
      break;
    }

    // Append the assistant's message that requested tool_calls
    messages.push(msg as ChatCompletionMessageParam);

    // Execute each tool call sequentially
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await executeTool(tc.function.name, args);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!finalText) {
    // If finished rounds without content, request final summary
    const finalCompletion = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
      })
    );
    finalText = finalCompletion.choices[0]?.message?.content || 'Completed tool execution.';
  }

  // Deduplicate citations
  const uniqueCitations = Array.from(
    new Map(collectedCitations.map((c) => [`${c.source}:${c.page}`, c])).values()
  );

  return {
    answerMarkdown: finalText,
    toolTraces,
    citations: uniqueCitations,
    evidenceTable,
  };
}
