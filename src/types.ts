export type ScopeType = 'Scope 1' | 'Scope 2' | 'Scope 3';
export type IssueSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Pass';
export type NavSection =
  | 'dashboard'
  | 'agent'
  | 'knowledge'
  | 'quality'
  | 'benchmarks'
  | 'reports';

export interface ScopeSummaryItem {
  scope: ScopeType;
  totalCo2eTonnes: number;
  sharePercent: number;
  recordCount: number;
  dateStart: string;
  dateEnd: string;
  monthsCovered: number;
  isFullYear: boolean;
  coverageLabel: string;
}

export interface RankedEmissionBucket {
  name: string;
  scope?: ScopeType;
  co2eTonnes: number;
  shareOfTotalPercent: number;
  shareOfScopePercent: number;
  recordCount: number;
  totalActivityOrSpend: number;
  unit: string;
  topActivities?: string[];
  topCategories?: string[];
}

export interface MonthlyTrendPoint {
  month: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  hasScope1: boolean;
  hasScope2: boolean;
  hasScope3: boolean;
}

export interface EmissionsDashboardSummary {
  companyName: string;
  datasetSource: 'default' | 'custom';
  totalCombinedCo2eTonnes: number;
  totalRecords: number;
  scope1TotalCo2e: number;
  scope2TotalCo2e: number;
  scope3TotalCo2e: number;
  coverageNotice: string;
  scopes: ScopeSummaryItem[];
  scope3Categories: RankedEmissionBucket[];
  topActivities: RankedEmissionBucket[];
  topSuppliers: RankedEmissionBucket[];
  facilities: RankedEmissionBucket[];
  scope1Breakdown: RankedEmissionBucket[];
  scope2Breakdown: RankedEmissionBucket[];
  monthlyTrends: MonthlyTrendPoint[];
  scope2RenewableSummary: {
    grossElectricityCo2e: number;
    grossSteamCo2e: number;
    weightedRenewablePercent: number;
    potentialMarketBasedReductionCo2e: number;
    facilitiesWithRenewables: Array<{
      facility: string;
      gridRegion: string;
      kwh: number;
      grossCo2e: number;
      avgRenewablePercent: number;
      impliedMarketBasedCo2e: number;
    }>;
  };
}

export interface QualityIssueSample {
  sourceFile: string;
  rowNumber: number;
  summary: string;
}

export interface QualityIssue {
  id: string;
  scope: ScopeType | 'Cross-Scope';
  checkName: string;
  severity: IssueSeverity;
  affectedRows: number;
  totalRowsInScope: number;
  penaltyPoints: number;
  explanation: string;
  correctiveAction: string;
  samples: QualityIssueSample[];
}

export interface QualityAssessmentResult {
  completenessScore: number;
  qualityScore: number;
  qualityRating: 'Strong' | 'Moderate' | 'Needs Remediation' | 'Critical Gaps';
  totalRowsAudited: number;
  summaryCounts: Record<IssueSeverity, number>;
  scoringMethodology: {
    completenessFormula: string;
    qualityFormula: string;
    components: Array<{
      dimension: string;
      weightPercent: number;
      score: number;
      rationale: string;
    }>;
  };
  issues: QualityIssue[];
  complianceDisclaimer: string;
}

export interface ProtocolSearchResult {
  chunk: {
    id: string;
    sourceDocument: string;
    pdfPage: number;
    printedPage: string | null;
    chapter: string;
    text: string;
  };
  score: number;
  matchType: 'hybrid' | 'lexical';
}

export interface PeerEmissionsProfile {
  id: string;
  companyName: string;
  industryContext: string;
  reportingPeriod: string;
  isFullYear: boolean;
  monthsCovered: number;
  organisationalBoundary: string;
  assuranceStatus: string;
  units: string;
  scope1Co2e: number;
  scope2LocationBasedCo2e: number | null;
  scope2MarketBasedCo2e: number | null;
  scope2PrimaryMethod: string;
  scope3HeadlineCo2e: number | null;
  scope3CoverageNotes: string;
  intensityMetric: string | null;
  sourceDocument: string;
  sourcePages: string;
}

export interface PeerComparisonRow {
  peerId: string;
  companyName: string;
  reportingPeriod: string;
  monthsCovered: number;
  scope1Co2e: number;
  scope1AbsDiffVsCompany: number;
  scope1PctDiffVsCompany: number | null;
  scope2ComparableCo2e: number | null;
  scope2MethodUsed: string;
  scope2AbsDiffVsCompany: number | null;
  scope2PctDiffVsCompany: number | null;
  scope1Plus2Co2e: number | null;
  comparabilityWarnings: string[];
}

export interface PeerBenchmarkResult {
  company: PeerEmissionsProfile;
  peers: PeerEmissionsProfile[];
  comparisons: PeerComparisonRow[];
  scope1Ranking: Array<{ companyName: string; scope1Co2e: number; period: string; rank: number }>;
  scope2LocationRanking: Array<{
    companyName: string;
    scope2Co2e: number;
    method: string;
    period: string;
    rank: number;
  }>;
  methodologyLimitations: string[];
  improvementInsights: string[];
}

export interface AgentToolTrace {
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  dataPreview?: unknown;
}

export interface AgentChatResponse {
  answerMarkdown: string;
  toolTraces: AgentToolTrace[];
  citations: Array<{ source: string; page: string; excerpt: string }>;
  evidenceTable?: {
    title: string;
    columns: string[];
    rows: Array<Array<string | number>>;
  };
}

export interface ExecutiveReportData {
  generatedAt: string;
  companyName: string;
  totalCombinedCo2eTonnes: number;
  coverageNotice: string;
  scopeSummary: ScopeSummaryItem[];
  topScope3Categories: RankedEmissionBucket[];
  topActivities: RankedEmissionBucket[];
  topSuppliers: RankedEmissionBucket[];
  facilities: RankedEmissionBucket[];
  qualityOverview: {
    completenessScore: number;
    qualityScore: number;
    qualityRating: string;
    criticalIssues: Array<{
      id: string;
      severity: string;
      checkName: string;
      affectedRows: number;
    }>;
    complianceDisclaimer: string;
  };
  peerOverview: {
    comparisons: PeerComparisonRow[];
    limitations: string[];
  };
  recommendations: Array<{
    priority: string;
    title: string;
    impact: string;
  }>;
}
