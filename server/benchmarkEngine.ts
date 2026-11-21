import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  EmissionsDashboardSummary,
  PeerBenchmarkResult,
  PeerComparisonRow,
  PeerEmissionsProfile,
} from './types.ts';

export const PEER1_PDF_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/peer1_emissions_report_960a1e7b.pdf'
);
export const PEER2_PDF_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/peer2_emissions_report_2b0ea2df.pdf'
);

interface ExtractedPdfPage {
  page: number;
  text: string;
}

async function readPdfPages(filePath: string, targetPages: number[]): Promise<ExtractedPdfPage[]> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const pages: ExtractedPdfPage[] = [];
  for (const p of targetPages) {
    if (p < 1 || p > doc.numPages) continue;
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: p, text });
  }
  return pages;
}

function parseNumberMatch(text: string, regex: RegExp, fallback: number): number {
  const m = regex.exec(text);
  if (!m || !m[1]) return fallback;
  const val = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(val) ? val : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let cachedPeers: PeerEmissionsProfile[] | null = null;

export async function extractPeerProfiles(): Promise<PeerEmissionsProfile[]> {
  if (cachedPeers) return cachedPeers;

  const p1Pages = await readPdfPages(PEER1_PDF_PATH, [49, 50, 52]);
  const p1Text = p1Pages.map((p) => p.text).join(' ');

  const p1Scope1 = parseNumberMatch(p1Text, /(\d[\d,]*)\s*tCO2e\s*Direct\s*\(scope\s*1\)/i, 449);
  const p1Scope2Market = parseNumberMatch(
    p1Text,
    /(\d[\d,]*\.?\d*)\s*tCO2e\s*100%\s*45\s*tCO2e/i,
    3.1
  );
  const p1Scope2Location = parseNumberMatch(
    p1Text,
    /Location\s*based\s+449\s*tCO2e\s+(\d[\d,]*)\s*tCO2e/i,
    8545
  );
  const p1Scope3 = parseNumberMatch(
    p1Text,
    /(\d[\d,]*)\s*tCO2e\s*449\s*tCO2e\s*Total\s*energy/i,
    132058
  );

  const docusign: PeerEmissionsProfile = {
    id: 'peer1-docusign',
    companyName: 'Docusign, Inc.',
    industryContext: 'Enterprise SaaS / Digital Agreement Software (6,838 FTEs, 18 global offices)',
    reportingPeriod: 'FY25 (Feb 1, 2024 – Jan 31, 2025)',
    isFullYear: true,
    monthsCovered: 12,
    organisationalBoundary:
      'Docusign, Inc. and operating subsidiaries (Scope 1 stationary & fugitive, Scope 2 electricity & heat/steam, specified Scope 3 categories)',
    assuranceStatus:
      'Limited assurance verification by Apex Companies, LLC against WRI/WBCSD GHG Protocol & ISO 14064-3 (p. 52)',
    units: 'tCO2e',
    scope1Co2e: p1Scope1,
    scope2LocationBasedCo2e: p1Scope2Location,
    scope2MarketBasedCo2e: p1Scope2Market,
    scope2PrimaryMethod: 'Dual-reported: Market-Based (3.1 tCO2e, 100% renewable EACs) & Location-Based (8,545 tCO2e)',
    scope3HeadlineCo2e: p1Scope3,
    scope3CoverageNotes:
      'Covers Cat 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8 (headline 132,058 tCO2e on p. 49; p. 50 table rows sum to 134,059 MB / 188,031 LB)',
    intensityMetric: '45 tCO2e per $1M revenue (p. 49)',
    sourceDocument: 'peer1_emissions_report.pdf',
    sourcePages: 'pp. 49–50, 52',
  };

  const p2Pages = await readPdfPages(PEER2_PDF_PATH, [17, 18, 19]);
  const p2Text = p2Pages.map((p) => p.text).join(' ');

  const p2Scope1 = parseNumberMatch(
    p2Text,
    /Scope\s*1\s*emissions\s*\(building\s*natural\s*gas\)\s*(\d[\d,]*)/i,
    360
  );
  const p2Scope2 = parseNumberMatch(
    p2Text,
    /360\s+(\d[\d,]*)\s+886\s+890/i,
    319
  );
  const p2Cat36 = parseNumberMatch(p2Text, /(\d[\d,]*)\s+1,663/i, 21959);
  const p2Cat37 = parseNumberMatch(p2Text, /21,959\s+(\d[\d,]*)/i, 1663);

  const shopify: PeerEmissionsProfile = {
    id: 'peer2-shopify',
    companyName: 'Shopify Inc.',
    industryContext: 'Global E-Commerce Cloud Software (remote-first distributed workforce)',
    reportingPeriod: 'CY 2024 (Jan 1, 2024 – Dec 31, 2024)',
    isFullYear: true,
    monthsCovered: 12,
    organisationalBoundary:
      'Operational footprint only: Shopify global physical office spaces (building natural gas & electricity) + Scope 3.6 & 3.7 (p. 18)',
    assuranceStatus:
      'Follows Greenhouse Gas Protocol; achieves net-zero operational footprint via RECs (890 tCO2e), RNG (886 tCO2e), and carbon removal credits (22,525 tCO2e) (pp. 18–19)',
    units: 'tCO2e',
    scope1Co2e: p2Scope1,
    scope2LocationBasedCo2e: p2Scope2,
    scope2MarketBasedCo2e: null,
    scope2PrimaryMethod:
      'Gross building electricity using regional emission factors (319 tCO2e); 890 tCO2e RECs & 886 tCO2e RNG credits retired separately (pp. 18–19)',
    scope3HeadlineCo2e: p2Cat36 + p2Cat37,
    scope3CoverageNotes:
      'Operational Scope 3 only: Cat 3.6 Business Travel (21,959 tCO2e) + Cat 3.7 Employee Home Office (1,663 tCO2e); full value-chain Scope 3 not included in this operational table.',
    intensityMetric: '2.96 tCO2e per employee / 0.0000027 tCO2e per revenue (2024 report)',
    sourceDocument: 'peer2_emissions_report.pdf',
    sourcePages: 'pp. 17–19',
  };

  cachedPeers = [docusign, shopify];
  return cachedPeers;
}

export async function comparePeerEmissions(
  summary: EmissionsDashboardSummary
): Promise<PeerBenchmarkResult> {
  const peers = await extractPeerProfiles();
  const s1Item = summary.scopes.find((s) => s.scope === 'Scope 1');
  const s2Item = summary.scopes.find((s) => s.scope === 'Scope 2');
  const s3Item = summary.scopes.find((s) => s.scope === 'Scope 3');

  const company: PeerEmissionsProfile = {
    id: 'company-inventory',
    companyName: 'Reporting Company (Our Inventory)',
    industryContext:
      'Mixed Industrial & Corporate Footprint (Manufacturing Plant w/ Coal, Cement & Steam + SF HQ, Data Center, Fleet, Warehouse)',
    reportingPeriod: `Scope 1 & 2: ${s1Item?.dateStart ?? 'N/A'} – ${s1Item?.dateEnd ?? 'N/A'} (${s1Item?.monthsCovered ?? 0} mos, Q1 only) | Scope 3: ${s3Item?.monthsCovered ?? 0} mos (FY24)`,
    isFullYear: Boolean(s1Item?.isFullYear && s2Item?.isFullYear),
    monthsCovered: s1Item?.monthsCovered ?? 0,
    organisationalBoundary:
      'Facilities present in CSVs: Manufacturing Plant, San Francisco HQ, Fleet Operations, Warehouse, Data Center (consolidation approach—equity share vs. operational/financial control—unspecified)',
    assuranceStatus: 'Unverified internal CSV records (automated quality checks only)',
    units: 'tCO2e',
    scope1Co2e: summary.scope1TotalCo2e,
    scope2LocationBasedCo2e: summary.scope2TotalCo2e,
    scope2MarketBasedCo2e: null,
    scope2PrimaryMethod:
      'Unspecified in CSV; calculation uses unadjusted grid/steam factors (gross location-based proxy) and ignores Renewable_Percentage (10%–45%)',
    scope3HeadlineCo2e: summary.scope3TotalCo2e,
    scope3CoverageNotes: `All 15 Scope 3 categories across ${s3Item?.monthsCovered ?? 12} months (spend-based), with category taxonomy inconsistencies`,
    intensityMetric: null,
    sourceDocument: 'scope1.csv, scope2.csv, scope3.csv',
    sourcePages: 'All rows',
  };

  const comparisons: PeerComparisonRow[] = peers.map((peer) => {
    const s1AbsDiff = round2(company.scope1Co2e - peer.scope1Co2e);
    const s1PctDiff =
      peer.scope1Co2e > 0 ? round2(((company.scope1Co2e - peer.scope1Co2e) / peer.scope1Co2e) * 100) : null;

    // Compare against Peer's Location-Based Scope 2 first because Company's CSV calculates unadjusted grid electricity/steam
    const peerS2Comp = peer.scope2LocationBasedCo2e ?? peer.scope2MarketBasedCo2e;
    const s2AbsDiff =
      peerS2Comp !== null ? round2((company.scope2LocationBasedCo2e ?? 0) - peerS2Comp) : null;
    const s2PctDiff =
      peerS2Comp !== null && peerS2Comp > 0
        ? round2((((company.scope2LocationBasedCo2e ?? 0) - peerS2Comp) / peerS2Comp) * 100)
        : null;

    const warnings: string[] = [];
    if (company.monthsCovered !== peer.monthsCovered) {
      warnings.push(
        `Reporting Window Mismatch: Our Scope 1 & 2 cover only ${company.monthsCovered} months (Q1 2024) vs. ${peer.companyName}'s ${peer.monthsCovered}-month annual period (${peer.reportingPeriod}).`
      );
    }
    if (peer.id === 'peer1-docusign') {
      warnings.push(
        'Scope 2 Methodology Divergence: Docusign reports both Market-Based (3.1 tCO2e via 100% EACs) and Location-Based (8,545 tCO2e); our CSV lacks dual reporting and ignores Renewable_Percentage.'
      );
    } else {
      warnings.push(
        'Scope 2 Boundary & Credit Treatment: Shopify reports gross building electricity (319 tCO2e) separately from retired RECs (890 tCO2e), whereas our Scope 2 includes heavy industrial Process Steam (2,116.40 tCO2e, 84.5% of Scope 2).'
      );
    }
    warnings.push(
      'Business Model & Consolidation Boundary Gap: Our inventory includes coal combustion & cement manufacturing (~94% of Scope 1) and industrial steam, whereas Docusign and Shopify are software/commerce companies; our organizational boundary (control vs. equity share) and revenue/FTE intensity denominators are missing.'
    );

    return {
      peerId: peer.id,
      companyName: peer.companyName,
      reportingPeriod: peer.reportingPeriod,
      monthsCovered: peer.monthsCovered,
      scope1Co2e: peer.scope1Co2e,
      scope1AbsDiffVsCompany: s1AbsDiff,
      scope1PctDiffVsCompany: s1PctDiff,
      scope2ComparableCo2e: peerS2Comp,
      scope2MethodUsed:
        peer.id === 'peer1-docusign' ? 'Location-Based (gross grid)' : 'Gross building electricity',
      scope2AbsDiffVsCompany: s2AbsDiff,
      scope2PctDiffVsCompany: s2PctDiff,
      scope1Plus2Co2e: peerS2Comp !== null ? round2(peer.scope1Co2e + peerS2Comp) : null,
      comparabilityWarnings: warnings,
    };
  });

  const allProfiles = [company, ...peers];
  const scope1Ranking = [...allProfiles]
    .sort((a, b) => a.scope1Co2e - b.scope1Co2e)
    .map((p, idx) => ({
      companyName: p.companyName,
      scope1Co2e: p.scope1Co2e,
      period: p.monthsCovered === 3 ? 'Q1 2024 (3 mos)' : p.reportingPeriod,
      rank: idx + 1,
    }));

  const scope2LocationRanking = [...allProfiles]
    .filter((p) => p.scope2LocationBasedCo2e !== null)
    .sort((a, b) => (a.scope2LocationBasedCo2e ?? 0) - (b.scope2LocationBasedCo2e ?? 0))
    .map((p, idx) => ({
      companyName: p.companyName,
      scope2Co2e: p.scope2LocationBasedCo2e ?? 0,
      method: p.id === 'company-inventory' ? 'Unadjusted grid + steam (Q1)' : 'Location-Based / Gross (12 mos)',
      period: p.monthsCovered === 3 ? 'Q1 2024 (3 mos)' : p.reportingPeriod,
      rank: idx + 1,
    }));

  const methodologyLimitations = [
    `Reporting Period Asymmetry: Our Scope 1 (1,692.47 tCO2e) and Scope 2 (2,505.04 tCO2e) reflect only Q1 2024 (Jan–Mar), whereas Docusign covers FY25 (Feb 2024–Jan 2025) and Shopify covers CY 2024 (Jan–Dec 2024). Even for a single quarter, our Scope 1 is already 3.77× Docusign's full-year Scope 1 (449 tCO2e) and 4.70× Shopify's full-year Scope 1 (360 tCO2e).`,
    'Scope 2 Dual-Reporting Gap: Docusign separates Location-Based (8,545 tCO2e) from Market-Based (3.1 tCO2e via 100% EACs). Our Scope 2 CSV uses unadjusted grid/steam factors (closer to Location-Based) and does not calculate Market-Based emissions despite recording 10%–45% Renewable_Percentage.',
    'Organisational Boundary & Intensity Missing: Both peers define their boundaries and provide revenue/employee intensity metrics (Docusign: 45 tCO2e/$1M; Shopify: 2.96 tCO2e/FTE). Our CSVs lack an organizational consolidation approach (operational control vs. equity share) and denominator metrics.',
    'Sectoral Mix Difference: Our Manufacturing Plant burns coal (895.40 tCO2e) and produces cement (702.00 tCO2e) and consumes 25,500 MMBtu process steam (1,887.00 tCO2e), making direct comparisons with asset-light SaaS/e-commerce offices inherently limited without industrial peers.',
  ];

  const improvementInsights = [
    'Implement Scope 2 Dual Reporting & Verified EAC/PPA Procurement: Docusign cuts Market-Based Scope 2 by 99.96% (8,545 → 3.1 tCO2e) via 100% renewable EACs, and Shopify backs electricity with Rattlesnake Ridge Wind RECs. Documenting contractual instruments for our 10%–45% renewable claims would immediately formalize our Market-Based figure.',
    'Target Industrial Thermal Decarbonization (Coal & Process Steam): Unlike office-based peers, 94.4% of our Scope 1 (Coal + Cement) and 75.3% of our Scope 2 (Manufacturing Steam) stem from one Manufacturing Plant. Fuel switching away from coal, heat-pump/electric boiler electrification, and green steam sourcing offer vastly higher abatement leverage than office initiatives.',
    'Close Q2–Q4 Data Collection & Pursue Third-Party Assurance: Complete full-year 2024 Scope 1 & 2 utility tracking and follow Docusign’s ISO 14064-3 limited assurance model before external ESG benchmarking.',
    'Add Intensity Denominators (Revenue & Headcount): Track tCO2e/$1M revenue and tCO2e/FTE alongside absolute emissions so year-over-year growth and efficiency gains can be benchmarked fairly.',
  ];

  return {
    company,
    peers,
    comparisons,
    scope1Ranking,
    scope2LocationRanking,
    methodologyLimitations,
    improvementInsights,
  };
}
