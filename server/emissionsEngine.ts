import fs from 'node:fs';
import path from 'node:path';
import type {
  EmissionsDashboardSummary,
  MonthlyTrendPoint,
  RankedEmissionBucket,
  ScopeSummaryItem,
  ScopeType,
  UnifiedEmissionRecord,
} from './types.ts';

export const DEFAULT_CSV_PATHS = {
  scope1: path.resolve(process.cwd(), 'public/assets/aistudio/scope1_7c8d72b0.csv'),
  scope2: path.resolve(process.cwd(), 'public/assets/aistudio/scope2_3a51590d.csv'),
  scope3: path.resolve(process.cwd(), 'public/assets/aistudio/scope3_8c63ce28.csv'),
};

export const SCOPE3_CATEGORY_NAMES: Record<string, string> = {
  'Category 1': 'Purchased Goods and Services',
  'Category 2': 'Capital Goods',
  'Category 3': 'Fuel- and Energy-Related Activities',
  'Category 4': 'Upstream Transportation and Distribution',
  'Category 5': 'Waste Generated in Operations',
  'Category 6': 'Business Travel',
  'Category 7': 'Employee Commuting',
  'Category 8': 'Upstream Leased Assets',
  'Category 9': 'Downstream Transportation and Distribution',
  'Category 10': 'Processing of Sold Products',
  'Category 11': 'Use of Sold Products',
  'Category 12': 'End-of-Life Treatment of Sold Products',
  'Category 13': 'Downstream Leased Assets',
  'Category 14': 'Franchises',
  'Category 15': 'Investments',
};

export const ACTIVITY_CANONICAL_CATEGORY: Record<string, string> = {
  'Raw Materials - Aluminum': 'Category 1',
  'Raw Materials - Steel': 'Category 1',
  'Packaging Materials': 'Category 1',
  'Office Supplies': 'Category 1',
  'IT Hardware': 'Category 2',
  'Manufacturing Equipment': 'Category 2',
  'Inbound Logistics - Truck': 'Category 4',
  'Business Travel - Air': 'Category 6',
  'Employee Commuting': 'Category 7',
  'Product Use Phase': 'Category 11',
};

export const SUPPLIER_EXPECTED_ACTIVITIES: Record<string, string[]> = {
  'Corporate Travel': ['Business Travel - Air', 'Employee Commuting'],
  'LogisticsPro': ['Inbound Logistics - Truck'],
  'MetalSupply Co': ['Raw Materials - Aluminum', 'Raw Materials - Steel'],
  'SteelCorp Inc': ['Raw Materials - Steel', 'Raw Materials - Aluminum'],
  'PackagePro Ltd': ['Packaging Materials'],
  'OfficeMax': ['Office Supplies', 'IT Hardware'],
  'TechEquip Corp': ['IT Hardware', 'Manufacturing Equipment'],
  'WasteManagement Co': [],
};

export interface RawCsvRow {
  _rowNumber: number;
  [key: string]: string | number;
}

export function parseCsvText(csvText: string): { headers: string[]; rows: RawCsvRow[] } {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { headers: [], rows: [] };
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows: RawCsvRow[] = lines.slice(1).map((line, idx) => {
    const vals = parseLine(line);
    const row: RawCsvRow = { _rowNumber: idx + 2 };
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : Number.NaN;
  if (typeof val !== 'string') return Number.NaN;
  const trimmed = val.trim();
  if (!trimmed) return Number.NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function extractMonthAndQuarter(dateStr: string): { month: string; quarter: string } {
  const match = /^(\d{4})-(\d{2})/.exec(dateStr.trim());
  if (!match) return { month: 'Unknown', quarter: 'Unknown' };
  const year = match[1];
  const monthNum = Number(match[2]);
  const q = Math.ceil(monthNum / 3);
  return {
    month: `${year}-${match[2]}`,
    quarter: `${year}-Q${q}`,
  };
}

export interface LoadedInventory {
  datasetSource: 'default' | 'custom';
  rawScope1: RawCsvRow[];
  rawScope2: RawCsvRow[];
  rawScope3: RawCsvRow[];
  records: UnifiedEmissionRecord[];
}

export function loadInventoryFromCsvStrings(
  csvInputs: { scope1Csv: string; scope2Csv: string; scope3Csv: string },
  datasetSource: 'default' | 'custom' = 'default'
): LoadedInventory {
  const rawScope1 = parseCsvText(csvInputs.scope1Csv).rows;
  const rawScope2 = parseCsvText(csvInputs.scope2Csv).rows;
  const rawScope3 = parseCsvText(csvInputs.scope3Csv).rows;

  const records: UnifiedEmissionRecord[] = [];

  for (const row of rawScope1) {
    const date = String(row.Date ?? '');
    const { month, quarter } = extractMonthAndQuarter(date);
    const amount = toNum(row.Consumption_Amount);
    const ef = toNum(row.Emission_Factor);
    const reported = toNum(row.CO2e_Tonnes);
    const fuel = String(row.Fuel_Type ?? '').trim();
    const unit = String(row.Consumption_Unit ?? '').trim();
    const isDirectTonneEf = fuel === 'Coal' || fuel === 'Cement Production';
    const scaling: 1 | 1000 = isDirectTonneEf ? 1 : 1000;
    const recalculated =
      Number.isFinite(amount) && Number.isFinite(ef) ? (amount * ef) / scaling : Number.NaN;

    records.push({
      id: `S1-${row._rowNumber}`,
      sourceFile: 'scope1.csv',
      rowNumber: Number(row._rowNumber),
      scope: 'Scope 1',
      date,
      month,
      quarter,
      facility: String(row.Facility ?? '').trim() || null,
      category: String(row.Activity_Type ?? '').trim() || 'Uncategorized',
      canonicalCategory: String(row.Activity_Type ?? '').trim() || null,
      activity: fuel ? `${String(row.Activity_Type ?? '').trim()} — ${fuel}` : String(row.Activity_Type ?? '').trim(),
      energyOrFuelType: fuel || null,
      activityAmount: Number.isFinite(amount) ? amount : 0,
      activityUnit: unit,
      spendCurrency: null,
      gridRegion: null,
      emissionFactor: Number.isFinite(ef) ? ef : 0,
      inferredEfUnit: isDirectTonneEf ? `tCO2e/${unit || 'unit'}` : `kgCO2e/${unit || 'unit'}`,
      reportedCo2eTonnes: Number.isFinite(reported) ? reported : 0,
      recalculatedCo2eTonnes: Number.isFinite(recalculated) ? recalculated : 0,
      efScalingFactor: scaling,
      renewablePercentage: null,
      supplier: null,
      dataQualityTier: 'Activity-based (fuel/process)',
      categoryDetails: null,
      notes: String(row.Notes ?? '').trim() || null,
    });
  }

  for (const row of rawScope2) {
    const date = String(row.Date ?? '');
    const { month, quarter } = extractMonthAndQuarter(date);
    const amount = toNum(row.Consumption_Amount);
    const ef = toNum(row.Emission_Factor);
    const reported = toNum(row.CO2e_Tonnes);
    const renew = toNum(row.Renewable_Percentage);
    const energy = String(row.Energy_Type ?? '').trim();
    const unit = String(row.Consumption_Unit ?? '').trim();
    const scaling: 1 | 1000 = energy === 'Steam' ? 1 : 1000;
    const recalculated =
      Number.isFinite(amount) && Number.isFinite(ef) ? (amount * ef) / scaling : Number.NaN;

    records.push({
      id: `S2-${row._rowNumber}`,
      sourceFile: 'scope2.csv',
      rowNumber: Number(row._rowNumber),
      scope: 'Scope 2',
      date,
      month,
      quarter,
      facility: String(row.Facility ?? '').trim() || null,
      category: energy || 'Purchased Energy',
      canonicalCategory: energy === 'Steam' ? 'Purchased Steam' : 'Purchased Electricity',
      activity: `${energy || 'Energy'} (${String(row.Grid_Region ?? '').trim() || 'Unknown Grid'})`,
      energyOrFuelType: energy || null,
      activityAmount: Number.isFinite(amount) ? amount : 0,
      activityUnit: unit,
      spendCurrency: null,
      gridRegion: String(row.Grid_Region ?? '').trim() || null,
      emissionFactor: Number.isFinite(ef) ? ef : 0,
      inferredEfUnit: energy === 'Steam' ? `tCO2e/${unit || 'MMBtu'}` : `kgCO2e/${unit || 'kWh'}`,
      reportedCo2eTonnes: Number.isFinite(reported) ? reported : 0,
      recalculatedCo2eTonnes: Number.isFinite(recalculated) ? recalculated : 0,
      efScalingFactor: scaling,
      renewablePercentage: Number.isFinite(renew) ? renew : null,
      supplier: null,
      dataQualityTier: 'Activity-based (grid average, unadjusted)',
      categoryDetails: null,
      notes: String(row.Notes ?? '').trim() || null,
    });
  }

  for (const row of rawScope3) {
    const date = String(row.Date ?? '');
    const { month, quarter } = extractMonthAndQuarter(date);
    const spend = toNum(row.Spend_Amount);
    const ef = toNum(row.Emission_Factor);
    const reported = toNum(row.CO2e_Tonnes);
    const category = String(row.Category ?? '').trim() || 'Uncategorized';
    const activity = String(row.Activity_Description ?? '').trim() || 'Unknown Activity';
    const currency = String(row.Spend_Currency ?? 'USD').trim() || 'USD';
    const recalculated = Number.isFinite(spend) && Number.isFinite(ef) ? (spend * ef) / 1000 : Number.NaN;

    records.push({
      id: `S3-${row._rowNumber}`,
      sourceFile: 'scope3.csv',
      rowNumber: Number(row._rowNumber),
      scope: 'Scope 3',
      date,
      month,
      quarter,
      facility: null,
      category,
      canonicalCategory: ACTIVITY_CANONICAL_CATEGORY[activity] ?? null,
      activity,
      energyOrFuelType: null,
      activityAmount: Number.isFinite(spend) ? spend : 0,
      activityUnit: currency,
      spendCurrency: currency,
      gridRegion: null,
      emissionFactor: Number.isFinite(ef) ? ef : 0,
      inferredEfUnit: `kgCO2e/${currency}`,
      reportedCo2eTonnes: Number.isFinite(reported) ? reported : 0,
      recalculatedCo2eTonnes: Number.isFinite(recalculated) ? recalculated : 0,
      efScalingFactor: 1000,
      renewablePercentage: null,
      supplier: String(row.Supplier ?? '').trim() || null,
      dataQualityTier: String(row.Data_Quality ?? '').trim() || null,
      categoryDetails: String(row.Category_Details ?? '').trim() || null,
      notes: null,
    });
  }

  return {
    datasetSource,
    rawScope1,
    rawScope2,
    rawScope3,
    records,
  };
}

export function loadDefaultInventory(): LoadedInventory {
  const scope1Csv = fs.readFileSync(DEFAULT_CSV_PATHS.scope1, 'utf8');
  const scope2Csv = fs.readFileSync(DEFAULT_CSV_PATHS.scope2, 'utf8');
  const scope3Csv = fs.readFileSync(DEFAULT_CSV_PATHS.scope3, 'utf8');
  return loadInventoryFromCsvStrings({ scope1Csv, scope2Csv, scope3Csv }, 'default');
}

function aggregateBuckets(
  records: UnifiedEmissionRecord[],
  keyFn: (r: UnifiedEmissionRecord) => string,
  totalCombined: number,
  scopeTotal: number,
  unitFallback: string
): RankedEmissionBucket[] {
  const map = new Map<
    string,
    {
      co2e: number;
      count: number;
      activitySum: number;
      unit: string;
      scope?: ScopeType;
      subActivities: Set<string>;
      subCategories: Set<string>;
    }
  >();

  for (const r of records) {
    const key = keyFn(r);
    if (!key) continue;
    const entry = map.get(key) ?? {
      co2e: 0,
      count: 0,
      activitySum: 0,
      unit: r.activityUnit || unitFallback,
      scope: r.scope,
      subActivities: new Set<string>(),
      subCategories: new Set<string>(),
    };
    entry.co2e += r.reportedCo2eTonnes;
    entry.count += 1;
    entry.activitySum += r.activityAmount;
    entry.subActivities.add(r.activity);
    entry.subCategories.add(r.category);
    if (entry.unit !== r.activityUnit && r.activityUnit) {
      entry.unit = 'mixed';
    }
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      scope: v.scope,
      co2eTonnes: round2(v.co2e),
      shareOfTotalPercent: totalCombined > 0 ? round2((v.co2e / totalCombined) * 100) : 0,
      shareOfScopePercent: scopeTotal > 0 ? round2((v.co2e / scopeTotal) * 100) : 0,
      recordCount: v.count,
      totalActivityOrSpend: round2(v.activitySum),
      unit: v.unit,
      topActivities: Array.from(v.subActivities).slice(0, 5),
      topCategories: Array.from(v.subCategories).slice(0, 5),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);
}

export function buildEmissionsSummary(inventory: LoadedInventory): EmissionsDashboardSummary {
  const { records, datasetSource } = inventory;
  const scopeLists: Record<ScopeType, UnifiedEmissionRecord[]> = {
    'Scope 1': records.filter((r) => r.scope === 'Scope 1'),
    'Scope 2': records.filter((r) => r.scope === 'Scope 2'),
    'Scope 3': records.filter((r) => r.scope === 'Scope 3'),
  };

  const scope1Total = round2(scopeLists['Scope 1'].reduce((s, r) => s + r.reportedCo2eTonnes, 0));
  const scope2Total = round2(scopeLists['Scope 2'].reduce((s, r) => s + r.reportedCo2eTonnes, 0));
  const scope3Total = round2(scopeLists['Scope 3'].reduce((s, r) => s + r.reportedCo2eTonnes, 0));
  const totalCombined = round2(scope1Total + scope2Total + scope3Total);

  const buildScopeItem = (scope: ScopeType, total: number): ScopeSummaryItem => {
    const list = scopeLists[scope];
    const dates = list.map((r) => r.date).filter(Boolean).sort();
    const months = new Set(list.map((r) => r.month).filter((m) => m !== 'Unknown'));
    const isFullYear = months.size >= 12;
    const coverageLabel =
      months.size === 0
        ? 'No dates'
        : isFullYear
          ? `Full Year (${months.size} months: ${dates[0]} to ${dates[dates.length - 1]})`
          : `Partial Period (${months.size} months: ${dates[0]} to ${dates[dates.length - 1]})`;
    return {
      scope,
      totalCo2eTonnes: total,
      sharePercent: totalCombined > 0 ? round2((total / totalCombined) * 100) : 0,
      recordCount: list.length,
      dateStart: dates[0] ?? 'N/A',
      dateEnd: dates[dates.length - 1] ?? 'N/A',
      monthsCovered: months.size,
      isFullYear,
      coverageLabel,
    };
  };

  const scopes: ScopeSummaryItem[] = [
    buildScopeItem('Scope 1', scope1Total),
    buildScopeItem('Scope 2', scope2Total),
    buildScopeItem('Scope 3', scope3Total),
  ];

  // Scope 3 Categories (decorated with GHG Protocol category names)
  const rawScope3Categories = aggregateBuckets(
    scopeLists['Scope 3'],
    (r) => {
      const label = SCOPE3_CATEGORY_NAMES[r.category];
      return label ? `${r.category} — ${label}` : r.category;
    },
    totalCombined,
    scope3Total,
    'USD'
  );

  // Also enrich top activities for each Scope 3 category with exact breakdown
  const scope3Categories = rawScope3Categories.map((cat) => {
    const catCode = cat.name.split(' — ')[0];
    const matching = scopeLists['Scope 3'].filter((r) => r.category === catCode);
    const actMap = new Map<string, number>();
    for (const r of matching) {
      actMap.set(r.activity, (actMap.get(r.activity) ?? 0) + r.reportedCo2eTonnes);
    }
    const orderedActs = Array.from(actMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, val]) => `${name} (${round2(val)} tCO2e)`);
    return {
      ...cat,
      topActivities: orderedActs,
    };
  });

  const topActivities = aggregateBuckets(
    records,
    (r) => `${r.activity} [${r.scope}]`,
    totalCombined,
    totalCombined,
    'mixed'
  );

  const topSuppliers = aggregateBuckets(
    scopeLists['Scope 3'].filter((r) => Boolean(r.supplier)),
    (r) => r.supplier ?? 'Unknown',
    totalCombined,
    scope3Total,
    'USD'
  );

  const facilities = aggregateBuckets(
    records.filter((r) => Boolean(r.facility)),
    (r) => r.facility ?? 'Unspecified',
    totalCombined,
    round2(scope1Total + scope2Total),
    'mixed'
  );

  const scope1Breakdown = aggregateBuckets(
    scopeLists['Scope 1'],
    (r) => r.activity,
    totalCombined,
    scope1Total,
    'unit'
  );

  const scope2Breakdown = aggregateBuckets(
    scopeLists['Scope 2'],
    (r) => `${r.energyOrFuelType ?? 'Energy'} · ${r.facility ?? 'Unknown'} (${r.gridRegion ?? 'N/A'})`,
    totalCombined,
    scope2Total,
    'unit'
  );

  const monthSet = new Set<string>();
  for (const r of records) {
    if (r.month !== 'Unknown') monthSet.add(r.month);
  }
  const monthsSorted = Array.from(monthSet).sort();
  const monthlyTrends: MonthlyTrendPoint[] = monthsSorted.map((month) => {
    const mRows = records.filter((r) => r.month === month);
    const s1Rows = mRows.filter((r) => r.scope === 'Scope 1');
    const s2Rows = mRows.filter((r) => r.scope === 'Scope 2');
    const s3Rows = mRows.filter((r) => r.scope === 'Scope 3');
    const s1 = round2(s1Rows.reduce((s, r) => s + r.reportedCo2eTonnes, 0));
    const s2 = round2(s2Rows.reduce((s, r) => s + r.reportedCo2eTonnes, 0));
    const s3 = round2(s3Rows.reduce((s, r) => s + r.reportedCo2eTonnes, 0));
    return {
      month,
      scope1: s1,
      scope2: s2,
      scope3: s3,
      total: round2(s1 + s2 + s3),
      hasScope1: s1Rows.length > 0,
      hasScope2: s2Rows.length > 0,
      hasScope3: s3Rows.length > 0,
    };
  });

  // Scope 2 renewable summary
  const s2Elec = scopeLists['Scope 2'].filter((r) => r.energyOrFuelType === 'Electricity');
  const s2Steam = scopeLists['Scope 2'].filter((r) => r.energyOrFuelType === 'Steam');
  const grossElectricityCo2e = round2(s2Elec.reduce((s, r) => s + r.reportedCo2eTonnes, 0));
  const grossSteamCo2e = round2(s2Steam.reduce((s, r) => s + r.reportedCo2eTonnes, 0));
  const totalKwh = s2Elec.reduce((s, r) => s + r.activityAmount, 0);
  const weightedRenewNumerator = s2Elec.reduce(
    (s, r) => s + r.activityAmount * (r.renewablePercentage ?? 0),
    0
  );
  const weightedRenewablePercent =
    totalKwh > 0 ? round2(weightedRenewNumerator / totalKwh) : 0;

  const facilityMap = new Map<
    string,
    { gridRegion: string; kwh: number; gross: number; renewWeighted: number; impliedMarket: number }
  >();
  for (const r of s2Elec) {
    const fac = r.facility ?? 'Unknown';
    const cur = facilityMap.get(fac) ?? {
      gridRegion: r.gridRegion ?? 'N/A',
      kwh: 0,
      gross: 0,
      renewWeighted: 0,
      impliedMarket: 0,
    };
    const pct = r.renewablePercentage ?? 0;
    cur.kwh += r.activityAmount;
    cur.gross += r.reportedCo2eTonnes;
    cur.renewWeighted += r.activityAmount * pct;
    cur.impliedMarket += r.reportedCo2eTonnes * (1 - pct / 100);
    facilityMap.set(fac, cur);
  }

  const facilitiesWithRenewables = Array.from(facilityMap.entries()).map(([facility, v]) => ({
    facility,
    gridRegion: v.gridRegion,
    kwh: round2(v.kwh),
    grossCo2e: round2(v.gross),
    avgRenewablePercent: v.kwh > 0 ? round2(v.renewWeighted / v.kwh) : 0,
    impliedMarketBasedCo2e: round2(v.impliedMarket),
  }));

  const impliedElecMarket = facilitiesWithRenewables.reduce((s, f) => s + f.impliedMarketBasedCo2e, 0);
  const potentialMarketBasedReductionCo2e = round2(grossElectricityCo2e - impliedElecMarket);

  const s1Item = scopes[0];
  const s2Item = scopes[1];
  const s3Item = scopes[2];
  const coverageNotice =
    !s1Item.isFullYear || !s2Item.isFullYear
      ? `Reporting Period Asymmetry: Scope 1 (${s1Item.monthsCovered} mos: ${s1Item.dateStart}–${s1Item.dateEnd}) and Scope 2 (${s2Item.monthsCovered} mos: ${s2Item.dateStart}–${s2Item.dateEnd}) contain Q1 2024 data only, whereas Scope 3 covers ${s3Item.monthsCovered} months (${s3Item.dateStart}–${s3Item.dateEnd}). Combined totals reflect reported inventory without extrapolating Q2–Q4.`
      : 'All three scopes cover full-year reporting periods.';

  return {
    companyName: 'Reporting Company (Uploaded Inventory)',
    datasetSource,
    totalCombinedCo2eTonnes: totalCombined,
    totalRecords: records.length,
    scope1TotalCo2e: scope1Total,
    scope2TotalCo2e: scope2Total,
    scope3TotalCo2e: scope3Total,
    coverageNotice,
    scopes,
    scope3Categories,
    topActivities,
    topSuppliers,
    facilities,
    scope1Breakdown,
    scope2Breakdown,
    monthlyTrends,
    scope2RenewableSummary: {
      grossElectricityCo2e,
      grossSteamCo2e,
      weightedRenewablePercent,
      potentialMarketBasedReductionCo2e,
      facilitiesWithRenewables,
    },
  };
}

export function getHighestEmittingCategories(
  inventory: LoadedInventory,
  scopeFilter?: 'Scope 1' | 'Scope 2' | 'Scope 3' | 'All',
  limit = 10
) {
  const summary = buildEmissionsSummary(inventory);
  if (scopeFilter === 'Scope 1') {
    return { scope: 'Scope 1', totalCo2eTonnes: summary.scope1TotalCo2e, categories: summary.scope1Breakdown.slice(0, limit) };
  }
  if (scopeFilter === 'Scope 2') {
    return { scope: 'Scope 2', totalCo2eTonnes: summary.scope2TotalCo2e, categories: summary.scope2Breakdown.slice(0, limit) };
  }
  if (scopeFilter === 'Scope 3') {
    return { scope: 'Scope 3', totalCo2eTonnes: summary.scope3TotalCo2e, categories: summary.scope3Categories.slice(0, limit) };
  }
  return {
    scope: 'All',
    totalCo2eTonnes: summary.totalCombinedCo2eTonnes,
    scope3TopCategories: summary.scope3Categories.slice(0, limit),
    topActivitiesAcrossScopes: summary.topActivities.slice(0, limit),
  };
}

export function getSupplierEmissionsBreakdown(inventory: LoadedInventory, limit = 10) {
  const summary = buildEmissionsSummary(inventory);
  const suppliers = summary.topSuppliers.slice(0, limit).map((s) => {
    const rows = inventory.records.filter((r) => r.scope === 'Scope 3' && r.supplier === s.name);
    const spend = round2(rows.reduce((acc, r) => acc + r.activityAmount, 0));
    const actMap = new Map<string, number>();
    const tierMap = new Map<string, number>();
    for (const r of rows) {
      actMap.set(r.activity, (actMap.get(r.activity) ?? 0) + r.reportedCo2eTonnes);
      if (r.dataQualityTier) {
        tierMap.set(r.dataQualityTier, (tierMap.get(r.dataQualityTier) ?? 0) + 1);
      }
    }
    const topActivities = Array.from(actMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, val]) => `${name} (${round2(val)} tCO2e)`);
    return {
      supplier: s.name,
      co2eTonnes: s.co2eTonnes,
      shareOfScope3Percent: s.shareOfScopePercent,
      totalSpendUsd: spend,
      emissionIntensityKgPerUsd: spend > 0 ? round2((s.co2eTonnes * 1000) / spend) : 0,
      recordCount: s.recordCount,
      topActivities,
      dataQualityBreakdown: Object.fromEntries(tierMap.entries()),
    };
  });
  return {
    totalScope3Co2eTonnes: summary.scope3TotalCo2e,
    supplierCount: summary.topSuppliers.length,
    suppliers,
  };
}

export function buildUnifiedCsvExport(inventory: LoadedInventory): string {
  const headers = [
    'ID',
    'Source_File',
    'Row_Number',
    'Scope',
    'Date',
    'Quarter',
    'Facility',
    'Reported_Category',
    'Canonical_GHG_Category',
    'Activity',
    'Activity_Amount',
    'Activity_Unit',
    'Emission_Factor',
    'Inferred_EF_Unit',
    'Reported_CO2e_Tonnes',
    'Renewable_Percentage',
    'Supplier',
    'Data_Quality_Tier',
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(',')];
  for (const r of inventory.records) {
    lines.push(
      [
        r.id,
        r.sourceFile,
        r.rowNumber,
        r.scope,
        r.date,
        r.quarter,
        r.facility ?? '',
        r.category,
        r.canonicalCategory ?? '',
        r.activity,
        r.activityAmount,
        r.activityUnit,
        r.emissionFactor,
        r.inferredEfUnit,
        r.reportedCo2eTonnes,
        r.renewablePercentage ?? '',
        r.supplier ?? '',
        r.dataQualityTier ?? '',
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}
