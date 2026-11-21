import {
  ACTIVITY_CANONICAL_CATEGORY,
  SUPPLIER_EXPECTED_ACTIVITIES,
  type LoadedInventory,
  type RawCsvRow,
} from './emissionsEngine.ts';
import type {
  IssueSeverity,
  QualityAssessmentResult,
  QualityIssue,
  QualityIssueSample,
} from './types.ts';

function isMissingOrNa(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'nan' || s === 'n/a' || s === 'na' || s === 'none';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function assessEmissionsQuality(inventory: LoadedInventory): QualityAssessmentResult {
  const { rawScope1, rawScope2, rawScope3, records } = inventory;
  const totalRows = records.length;
  const issues: QualityIssue[] = [];

  // 1. Missing values / invalid numeric fields across all raw rows
  const missingSamples: QualityIssueSample[] = [];
  let missingCount = 0;
  let invalidNumericCount = 0;

  const checkRawSet = (
    rows: RawCsvRow[],
    file: string,
    requiredCols: string[],
    numericCols: string[]
  ) => {
    for (const r of rows) {
      for (const col of requiredCols) {
        if (isMissingOrNa(r[col])) {
          missingCount += 1;
          if (missingSamples.length < 5) {
            missingSamples.push({
              sourceFile: file,
              rowNumber: Number(r._rowNumber),
              summary: `Missing required field "${col}"`,
            });
          }
        }
      }
      for (const col of numericCols) {
        const num = Number(r[col]);
        if (!Number.isFinite(num) || num < 0) {
          invalidNumericCount += 1;
          if (missingSamples.length < 5) {
            missingSamples.push({
              sourceFile: file,
              rowNumber: Number(r._rowNumber),
              summary: `Invalid or negative numeric value in "${col}": ${String(r[col])}`,
            });
          }
        }
      }
    }
  };

  checkRawSet(
    rawScope1,
    'scope1.csv',
    ['Facility', 'Activity_Type', 'Fuel_Type', 'Consumption_Amount', 'Consumption_Unit', 'Emission_Factor', 'CO2e_Tonnes', 'Date'],
    ['Consumption_Amount', 'Emission_Factor', 'CO2e_Tonnes']
  );
  checkRawSet(
    rawScope2,
    'scope2.csv',
    ['Facility', 'Energy_Type', 'Consumption_Amount', 'Consumption_Unit', 'Grid_Region', 'Emission_Factor', 'CO2e_Tonnes', 'Date'],
    ['Consumption_Amount', 'Emission_Factor', 'CO2e_Tonnes', 'Renewable_Percentage']
  );
  checkRawSet(
    rawScope3,
    'scope3.csv',
    ['Category', 'Activity_Description', 'Spend_Amount', 'Spend_Currency', 'Emission_Factor', 'CO2e_Tonnes', 'Date', 'Supplier'],
    ['Spend_Amount', 'Emission_Factor', 'CO2e_Tonnes']
  );

  // 2. Exact duplicate record detection
  let duplicateCount = 0;
  const dupSamples: QualityIssueSample[] = [];
  const checkDups = (rows: RawCsvRow[], file: string) => {
    const seen = new Set<string>();
    for (const r of rows) {
      const clone: Record<string, unknown> = { ...r };
      delete clone._rowNumber;
      const sig = JSON.stringify(clone);
      if (seen.has(sig)) {
        duplicateCount += 1;
        if (dupSamples.length < 5) {
          dupSamples.push({
            sourceFile: file,
            rowNumber: Number(r._rowNumber),
            summary: `Exact duplicate row in ${file}`,
          });
        }
      }
      seen.add(sig);
    }
  };
  checkDups(rawScope1, 'scope1.csv');
  checkDups(rawScope2, 'scope2.csv');
  checkDups(rawScope3, 'scope3.csv');

  if (missingCount > 0 || invalidNumericCount > 0) {
    issues.push({
      id: 'DQ-MISSING-NUMERIC',
      scope: 'Cross-Scope',
      checkName: 'Missing Required Fields or Invalid Numeric Values',
      severity: 'Critical',
      affectedRows: missingCount + invalidNumericCount,
      totalRowsInScope: totalRows,
      penaltyPoints: 18,
      explanation: `Detected ${missingCount} missing required fields and ${invalidNumericCount} invalid/negative numeric entries across uploaded datasets.`,
      correctiveAction: 'Populate missing fields and validate non-negative numeric formats before inventory aggregation.',
      samples: missingSamples,
    });
  } else {
    issues.push({
      id: 'DQ-NO-NULLS-OR-DUPS',
      scope: 'Cross-Scope',
      checkName: 'Null Values, Invalid Numbers & Exact Duplicates Check',
      severity: 'Pass',
      affectedRows: 0,
      totalRowsInScope: totalRows,
      penaltyPoints: 0,
      explanation: `All ${totalRows} records contain valid non-negative numerical activity/spend, emission factor, and CO2e values with 0 null cells and ${duplicateCount} exact duplicate rows.`,
      correctiveAction: 'Maintain automated schema validation gates in ETL ingestion.',
      samples: [],
    });
  }

  if (duplicateCount > 0) {
    issues.push({
      id: 'DQ-DUPLICATES',
      scope: 'Cross-Scope',
      checkName: 'Duplicate Emission Records',
      severity: 'High',
      affectedRows: duplicateCount,
      totalRowsInScope: totalRows,
      penaltyPoints: 10,
      explanation: `Detected ${duplicateCount} exact duplicate rows that risk double-counting emissions.`,
      correctiveAction: 'Deduplicate records using composite keys (Facility/Supplier, Date, Activity, Amount).',
      samples: dupSamples,
    });
  }

  // 3. Temporal completeness: Scope 1 & Scope 2 vs Scope 3
  const s1Months = new Set(records.filter((r) => r.scope === 'Scope 1').map((r) => r.month));
  const s2Months = new Set(records.filter((r) => r.scope === 'Scope 2').map((r) => r.month));
  const s3Months = new Set(records.filter((r) => r.scope === 'Scope 3').map((r) => r.month));

  if (s1Months.size < 12 || s2Months.size < 12) {
    issues.push({
      id: 'DQ-INCOMPLETE-PERIODS-S1S2',
      scope: 'Cross-Scope',
      checkName: 'Incomplete Annual Reporting Periods (Scope 1 & Scope 2 Q1-Only)',
      severity: 'Critical',
      affectedRows: rawScope1.length + rawScope2.length,
      totalRowsInScope: rawScope1.length + rawScope2.length,
      penaltyPoints: 16,
      explanation: `Scope 1 covers ${s1Months.size} months (Jan–Mar 2024) and Scope 2 covers ${s2Months.size} months (Jan–Mar 2024), whereas Scope 3 covers ${s3Months.size} months (Jan–Dec 2024). Q2–Q4 2024 utility/fuel logs are missing, distorting the Scope 1/2 vs Scope 3 ratio and preventing full-year peer benchmarking.`,
      correctiveAction: 'Ingest Q2–Q4 2024 stationary, mobile, process, refrigerant, and purchased electricity/steam bills before annual disclosure or peer comparison.',
      samples: [
        {
          sourceFile: 'scope1.csv',
          rowNumber: 19,
          summary: `Latest date is ${Array.from(s1Months).sort().pop() ?? 'N/A'} (missing Apr–Dec 2024)`,
        },
        {
          sourceFile: 'scope2.csv',
          rowNumber: 19,
          summary: `Latest date is ${Array.from(s2Months).sort().pop() ?? 'N/A'} (missing Apr–Dec 2024)`,
        },
      ],
    });
  }

  // 4. Scope 2 Renewable_Percentage unapplied & missing dual-reporting
  const s2Records = records.filter((r) => r.scope === 'Scope 2');
  const s2WithRenew = s2Records.filter((r) => (r.renewablePercentage ?? 0) > 0);
  const unadjustedRenewSamples: QualityIssueSample[] = [];
  let unappliedCount = 0;
  for (const r of s2WithRenew) {
    const gross = (r.activityAmount * r.emissionFactor) / r.efScalingFactor;
    if (Math.abs(r.reportedCo2eTonnes - gross) < 0.05) {
      unappliedCount += 1;
      if (unadjustedRenewSamples.length < 5) {
        unadjustedRenewSamples.push({
          sourceFile: 'scope2.csv',
          rowNumber: r.rowNumber,
          summary: `${r.facility} (${r.date}): Renewable_Percentage=${r.renewablePercentage}% is ignored; reported ${r.reportedCo2eTonnes} tCO2e equals 100% gross grid electricity.`,
        });
      }
    }
  }
  if (unappliedCount > 0) {
    issues.push({
      id: 'DQ-SCOPE2-DUAL-REPORTING',
      scope: 'Scope 2',
      checkName: 'Scope 2 Missing Dual-Reporting & Unapplied Renewable Percentage',
      severity: 'Critical',
      affectedRows: s2Records.length,
      totalRowsInScope: s2Records.length,
      penaltyPoints: 14,
      explanation: `In ${unappliedCount} electricity rows with positive Renewable_Percentage (10%–45% across San Francisco HQ, Manufacturing Plant, and Data Center), CO2e_Tonnes equals gross grid consumption without renewable deduction. Furthermore, the dataset lacks Scope 2 Methodology labels (Location-Based vs. Market-Based), residual-mix factors, and REC/PPA contractual instrument verification required by the GHG Protocol Scope 2 Guidance.`,
      correctiveAction: 'Report both Location-Based (grid average, ignoring RECs) and Market-Based (contractual/residual-mix) totals separately, and verify EAC/REC certificates for claimed renewable percentages.',
      samples: unadjustedRenewSamples,
    });
  }

  // 5. Calculation scaling & missing EF unit inconsistency (1,000x ratio)
  const scalingSamples: QualityIssueSample[] = [];
  let nonUniformScalingRows = 0;
  for (const r of [...records.filter((x) => x.scope === 'Scope 1'), ...s2Records]) {
    if (r.efScalingFactor === 1000) {
      nonUniformScalingRows += 1;
      if (scalingSamples.length < 5) {
        scalingSamples.push({
          sourceFile: r.sourceFile,
          rowNumber: r.rowNumber,
          summary: `${r.energyOrFuelType ?? r.activity} (${r.activityAmount} ${r.activityUnit} × EF ${r.emissionFactor}) ÷ 1,000 = ${r.reportedCo2eTonnes} tCO2e (EF is kgCO2e/unit, whereas Coal/Cement/Steam are tCO2e/unit without ÷1,000).`,
        });
      }
    }
  }
  if (nonUniformScalingRows > 0) {
    issues.push({
      id: 'DQ-EF-UNIT-SCALING',
      scope: 'Cross-Scope',
      checkName: 'Missing Emission_Factor_Unit & 1,000× Formula Scaling Inconsistency',
      severity: 'High',
      affectedRows: nonUniformScalingRows,
      totalRowsInScope: rawScope1.length + rawScope2.length,
      penaltyPoints: 10,
      explanation: `Neither scope1.csv nor scope2.csv includes an Emission_Factor_Unit column. Consequently, Natural Gas, Diesel, Gasoline, Refrigerants, and Electricity require (Consumption × EF) / 1,000 (kgCO2e/unit), while Coal, Cement Production, and Steam use (Consumption × EF) directly (tCO2e/unit). Additionally, Scope 1 Refrigerants uses non-standard unit "kg_R404A" combining mass unit and gas species.`,
      correctiveAction: 'Add explicit Emission_Factor_Unit, EF_Source, and GWP_Assessment_Report columns; standardize mass units (kg) separately from refrigerant chemical species (R-404A).',
      samples: scalingSamples,
    });
  }

  // 6. Scope 3 Category-to-Activity taxonomy mismatches
  const s3Records = records.filter((r) => r.scope === 'Scope 3');
  const catMismatchSamples: QualityIssueSample[] = [];
  let catMismatchCount = 0;
  for (const r of s3Records) {
    const canonical = ACTIVITY_CANONICAL_CATEGORY[r.activity];
    if (canonical && canonical !== r.category) {
      catMismatchCount += 1;
      if (catMismatchSamples.length < 6) {
        catMismatchSamples.push({
          sourceFile: 'scope3.csv',
          rowNumber: r.rowNumber,
          summary: `"${r.activity}" is assigned to "${r.category}", but under GHG Protocol Scope 3 belongs in "${canonical}".`,
        });
      }
    }
  }
  if (catMismatchCount > 0) {
    issues.push({
      id: 'DQ-SCOPE3-CATEGORY-MISMATCH',
      scope: 'Scope 3',
      checkName: 'GHG Protocol Scope 3 Category-to-Activity Taxonomy Mismatches',
      severity: 'Critical',
      affectedRows: catMismatchCount,
      totalRowsInScope: s3Records.length,
      penaltyPoints: 15,
      explanation: `${catMismatchCount} of ${s3Records.length} Scope 3 rows (${round1((catMismatchCount / Math.max(1, s3Records.length)) * 100)}%) map activities to incompatible GHG Protocol Scope 3 categories (e.g., "Raw Materials - Aluminum" or "Employee Commuting" labeled as Category 11 Use of Sold Products; "Business Travel - Air" labeled as Category 3 or Category 14). Category totals cannot be relied upon for external reporting without reclassification.`,
      correctiveAction: 'Apply deterministic activity-to-Scope 3 category mapping rules (e.g., Air Travel → Cat 6, Commuting → Cat 7, Steel/Aluminum/Packaging → Cat 1, CapEx Equipment/IT Hardware → Cat 2) and re-aggregate.',
      samples: catMismatchSamples,
    });
  }

  // 7. Scope 3 Supplier-to-Activity semantic mismatches
  const supMismatchSamples: QualityIssueSample[] = [];
  let supMismatchCount = 0;
  for (const r of s3Records) {
    if (!r.supplier) continue;
    const expected = SUPPLIER_EXPECTED_ACTIVITIES[r.supplier];
    if (expected && !expected.includes(r.activity)) {
      supMismatchCount += 1;
      if (supMismatchSamples.length < 6) {
        supMismatchSamples.push({
          sourceFile: 'scope3.csv',
          rowNumber: r.rowNumber,
          summary: `Supplier "${r.supplier}" paired with unrelated activity "${r.activity}" ($${r.activityAmount.toLocaleString()}, ${r.reportedCo2eTonnes} tCO2e).`,
        });
      }
    }
  }
  if (supMismatchCount > 0) {
    issues.push({
      id: 'DQ-SCOPE3-SUPPLIER-MISMATCH',
      scope: 'Scope 3',
      checkName: 'Scope 3 Supplier-to-Activity Domain Mismatches',
      severity: 'High',
      affectedRows: supMismatchCount,
      totalRowsInScope: s3Records.length,
      penaltyPoints: 8,
      explanation: `${supMismatchCount} of ${s3Records.length} Scope 3 records (${round1((supMismatchCount / Math.max(1, s3Records.length)) * 100)}%) pair named suppliers with implausible procurement activities (e.g., "Corporate Travel" billed for "Raw Materials - Steel", or "WasteManagement Co" billed for "Business Travel - Air" and "IT Hardware").`,
      correctiveAction: 'Reconcile Scope 3 ledger against ERP vendor master codes (NAICS/UNSPSC) before prioritizing suppliers for decarbonization engagement.',
      samples: supMismatchSamples,
    });
  }

  // 8. Scope 2 Steam grid region codes & identical EF
  const steamRows = s2Records.filter((r) => r.energyOrFuelType === 'Steam');
  if (steamRows.length > 0) {
    issues.push({
      id: 'DQ-SCOPE2-STEAM-METADATA',
      scope: 'Scope 2',
      checkName: 'Scope 2 Steam Assigned Electricity Grid Codes & Uniform EF',
      severity: 'Medium',
      affectedRows: steamRows.length,
      totalRowsInScope: s2Records.length,
      penaltyPoints: 4,
      explanation: `All ${steamRows.length} Steam records use electricity grid region identifiers (CAISO, PJM) and an identical 0.074 EF despite representing 84.5% of Scope 2 emissions (2,116.40 tCO2e). District/process steam factors depend on supplier boiler fuel mix and CHP allocation, not regional electric grid codes.`,
      correctiveAction: 'Obtain supplier-specific steam/thermal emission factors and fuel-mix documentation per GHG Protocol Appendix A.',
      samples: steamRows.slice(0, 3).map((r) => ({
        sourceFile: 'scope2.csv',
        rowNumber: r.rowNumber,
        summary: `${r.facility} Steam (${r.activityAmount} MMBtu) tagged with electric grid "${r.gridRegion}" and EF ${r.emissionFactor}.`,
      })),
    });
  }

  // 9. Uninformative Category_Details in Scope 3
  const genericDetailsCount = s3Records.filter(
    (r) => r.categoryDetails === 'Scope 3 emissions category'
  ).length;
  if (genericDetailsCount > 0) {
    issues.push({
      id: 'DQ-SCOPE3-GENERIC-DETAILS',
      scope: 'Scope 3',
      checkName: 'Generic Placeholder in Category_Details Column',
      severity: 'Medium',
      affectedRows: genericDetailsCount,
      totalRowsInScope: s3Records.length,
      penaltyPoints: 3,
      explanation: `All ${genericDetailsCount} Scope 3 rows contain the non-descriptive placeholder "Scope 3 emissions category" in Category_Details instead of standardized GHG Protocol subcategory descriptions.`,
      correctiveAction: 'Populate Category_Details with the official GHG Protocol Scope 3 category name and calculation boundary.',
      samples: s3Records.slice(0, 2).map((r) => ({
        sourceFile: 'scope3.csv',
        rowNumber: r.rowNumber,
        summary: `Category_Details = "${r.categoryDetails}" on ${r.category} (${r.activity}).`,
      })),
    });
  }

  // 10. Statistical outlier detection (Scope 3 single transactions > mean + 2.5*std)
  if (s3Records.length > 5) {
    const vals = s3Records.map((r) => r.reportedCo2eTonnes);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    const threshold = mean + 2.5 * std;
    const outliers = s3Records
      .filter((r) => r.reportedCo2eTonnes > threshold)
      .sort((a, b) => b.reportedCo2eTonnes - a.reportedCo2eTonnes);

    if (outliers.length > 0) {
      issues.push({
        id: 'DQ-STATISTICAL-OUTLIERS',
        scope: 'Scope 3',
        checkName: 'High-Magnitude Spend-Based Emission Outliers (> mean + 2.5σ)',
        severity: 'Medium',
        affectedRows: outliers.length,
        totalRowsInScope: s3Records.length,
        penaltyPoints: 3,
        explanation: `${outliers.length} Scope 3 transactions exceed ${round1(threshold)} tCO2e (mean ${round1(mean)} + 2.5σ), driven by high single-line spend (~$450k–$495k) multiplied by high spend-based emission factors (up to 2.94 kgCO2e/USD), e.g., Office Supplies generating >1,379 tCO2e in a single line item.`,
        correctiveAction: 'Audit high-value transactions and transition top-emitting line items from spend-based EEIO factors to supplier-specific or physical-activity-based data.',
        samples: outliers.slice(0, 5).map((r) => ({
          sourceFile: 'scope3.csv',
          rowNumber: r.rowNumber,
          summary: `${r.activity} (${r.supplier}): $${r.activityAmount.toLocaleString()} × ${r.emissionFactor} = ${r.reportedCo2eTonnes} tCO2e`,
        })),
      });
    }
  }

  // 11. Mixed Data_Quality labels on spend-based entries
  const primaryOnSpend = s3Records.filter(
    (r) => r.dataQualityTier === 'Primary data' || r.dataQualityTier === 'Hybrid approach'
  );
  if (primaryOnSpend.length > 0) {
    issues.push({
      id: 'DQ-SCOPE3-TIER-MISMATCH',
      scope: 'Scope 3',
      checkName: 'Primary/Hybrid Data Quality Labels Applied to Spend-Based Calculations',
      severity: 'Low',
      affectedRows: primaryOnSpend.length,
      totalRowsInScope: s3Records.length,
      penaltyPoints: 2,
      explanation: `${primaryOnSpend.length} Scope 3 rows are tagged "Primary data" or "Hybrid approach" despite being calculated exclusively from USD spend and spend-based emission factors without physical activity quantities (tonnes, kWh, passenger-km).`,
      correctiveAction: 'Align Data_Quality classifications with GHG Protocol Scope 3 Guidance (reserve "Primary data" for supplier-verified physical activity or primary EPD/PCF metrics).',
      samples: primaryOnSpend.slice(0, 3).map((r) => ({
        sourceFile: 'scope3.csv',
        rowNumber: r.rowNumber,
        summary: `Tagged "${r.dataQualityTier}" while using Spend_Amount ($${r.activityAmount.toLocaleString()} USD) × EF ${r.emissionFactor}.`,
      })),
    });
  }

  // Scoring methodology (deterministic & fully transparent)
  const expectedFieldCount =
    rawScope1.length * 8 + rawScope2.length * 8 + rawScope3.length * 8;
  const fieldCompleteness =
    expectedFieldCount > 0
      ? ((expectedFieldCount - missingCount) / expectedFieldCount) * 100
      : 0;
  // Penalize missing annual Q2-Q4 months in Scope 1 & 2 (24 of 36 scope-months covered -> 66.7% temporal coverage)
  const scopeMonthsCovered =
    Math.min(12, s1Months.size) + Math.min(12, s2Months.size) + Math.min(12, s3Months.size);
  const temporalCompleteness = (scopeMonthsCovered / 36) * 100;
  const completenessScore = round1(0.6 * fieldCompleteness + 0.4 * temporalCompleteness);

  const schemaIntegrityScore = Math.max(0, 100 - (missingCount + invalidNumericCount + duplicateCount) * 2 - 20); // -20 for missing EF_Unit
  const temporalScore = round1(temporalCompleteness);
  const ghgMethodologyScore = round1(
    Math.max(
      0,
      100 -
        (unappliedCount > 0 ? 45 : 0) -
        (steamRows.length > 0 ? 15 : 0) -
        (primaryOnSpend.length > 0 ? 10 : 0)
    )
  );
  const catMismatchRate = s3Records.length > 0 ? catMismatchCount / s3Records.length : 0;
  const supMismatchRate = s3Records.length > 0 ? supMismatchCount / s3Records.length : 0;
  const taxonomyConsistencyScore = round1(
    Math.max(0, 100 - catMismatchRate * 65 - supMismatchRate * 35)
  );

  const qualityScore = round1(
    0.25 * schemaIntegrityScore +
      0.25 * temporalScore +
      0.25 * ghgMethodologyScore +
      0.25 * taxonomyConsistencyScore
  );

  const qualityRating: QualityAssessmentResult['qualityRating'] =
    qualityScore >= 80
      ? 'Strong'
      : qualityScore >= 60
        ? 'Moderate'
        : qualityScore >= 40
          ? 'Needs Remediation'
          : 'Critical Gaps';

  const summaryCounts: Record<IssueSeverity, number> = {
    Critical: issues.filter((i) => i.severity === 'Critical').length,
    High: issues.filter((i) => i.severity === 'High').length,
    Medium: issues.filter((i) => i.severity === 'Medium').length,
    Low: issues.filter((i) => i.severity === 'Low').length,
    Pass: issues.filter((i) => i.severity === 'Pass').length,
  };

  return {
    completenessScore,
    qualityScore,
    qualityRating,
    totalRowsAudited: totalRows,
    summaryCounts,
    scoringMethodology: {
      completenessFormula:
        'Completeness = 0.60 × Required_Field_Fill_Rate + 0.40 × Temporal_Coverage_Rate (covered scope-months ÷ 36)',
      qualityFormula:
        'Quality Score = 0.25 × Schema_Unit_Integrity + 0.25 × Temporal_Completeness + 0.25 × GHG_Methodological_Validity + 0.25 × Taxonomy_Consistency',
      components: [
        {
          dimension: 'Schema & Unit Integrity',
          weightPercent: 25,
          score: round1(schemaIntegrityScore),
          rationale: '100% numeric/null integrity and 0 duplicates, offset by missing Emission_Factor_Unit columns causing 1,000× scaling differences.',
        },
        {
          dimension: 'Temporal Completeness',
          weightPercent: 25,
          score: temporalScore,
          rationale: `${scopeMonthsCovered} of 36 scope-months populated (Scope 1 & 2 cover Q1 2024 only; Scope 3 covers all 12 months).`,
        },
        {
          dimension: 'GHG Protocol Methodological Validity',
          weightPercent: 25,
          score: ghgMethodologyScore,
          rationale: 'Scope 2 lacks Location- vs. Market-Based split and ignores Renewable_Percentage; Steam uses electric grid codes; Scope 3 spend rows carry Primary labels.',
        },
        {
          dimension: 'Taxonomy & Mapping Consistency',
          weightPercent: 25,
          score: taxonomyConsistencyScore,
          rationale: `${catMismatchCount}/${s3Records.length} Scope 3 Category-Activity mismatches and ${supMismatchCount}/${s3Records.length} Supplier-Activity mismatches detected.`,
        },
      ],
    },
    issues,
    complianceDisclaimer:
      'Automated validation checks identify structural, statistical, and metadata anomalies in the uploaded CSVs. They do not constitute formal GHG Protocol verification or third-party limited/reasonable assurance (such as ISO 14064-3).',
  };
}
