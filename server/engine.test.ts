import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_TOOL_DECLARATIONS, buildDeterministicReport } from './agent.ts';
import { comparePeerEmissions, extractPeerProfiles } from './benchmarkEngine.ts';
import {
  buildEmissionsSummary,
  buildUnifiedCsvExport,
  getHighestEmittingCategories,
  getSupplierEmissionsBreakdown,
  loadDefaultInventory,
  loadInventoryFromCsvStrings,
} from './emissionsEngine.ts';
import { assessEmissionsQuality } from './qualityEngine.ts';
import { loadProtocolChunks, searchGhgProtocol } from './ragEngine.ts';

test('loads and aggregates default Scope 1, 2, 3 CSVs deterministically', () => {
  const inv = loadDefaultInventory();
  assert.equal(inv.rawScope1.length, 18);
  assert.equal(inv.rawScope2.length, 18);
  assert.equal(inv.rawScope3.length, 1000);
  assert.equal(inv.records.length, 1036);

  const summary = buildEmissionsSummary(inv);
  assert.equal(summary.scope1TotalCo2e, 1692.47);
  assert.equal(summary.scope2TotalCo2e, 2505.04);
  assert.equal(summary.scope3TotalCo2e, 374485.51);
  assert.equal(summary.totalCombinedCo2eTonnes, 378683.02);

  assert.equal(summary.scopes[0].monthsCovered, 3);
  assert.equal(summary.scopes[1].monthsCovered, 3);
  assert.equal(summary.scopes[2].monthsCovered, 12);

  const topCat = getHighestEmittingCategories(inv, 'Scope 3', 5);
  assert.ok('categories' in topCat && topCat.categories);
  assert.ok(topCat.categories[0].name.startsWith('Category 3'));
  assert.equal(topCat.categories[0].co2eTonnes, 31794.33);

  const suppliers = getSupplierEmissionsBreakdown(inv, 5);
  assert.equal(suppliers.suppliers[0].supplier, 'OfficeMax');
  assert.equal(suppliers.suppliers[0].co2eTonnes, 50966.25);

  const csvExport = buildUnifiedCsvExport(inv);
  assert.ok(csvExport.startsWith('ID,Source_File,Row_Number,Scope,'));
  assert.equal(csvExport.trim().split('\n').length, 1037);
});

test('quality assessment flags all critical structural and GHG Protocol issues', () => {
  const inv = loadDefaultInventory();
  const quality = assessEmissionsQuality(inv);

  assert.equal(quality.completenessScore, 80);
  assert.ok(quality.qualityScore >= 35 && quality.qualityScore <= 75);

  const ids = new Set(quality.issues.map((i) => i.id));
  assert.ok(ids.has('DQ-INCOMPLETE-PERIODS-S1S2'));
  assert.ok(ids.has('DQ-SCOPE2-DUAL-REPORTING'));
  assert.ok(ids.has('DQ-EF-UNIT-SCALING'));
  assert.ok(ids.has('DQ-SCOPE3-CATEGORY-MISMATCH'));
  assert.ok(ids.has('DQ-SCOPE3-SUPPLIER-MISMATCH'));
  assert.ok(ids.has('DQ-STATISTICAL-OUTLIERS'));
  assert.ok(quality.complianceDisclaimer.includes('do not constitute formal GHG Protocol verification'));
});

test('quality assessment catches missing values, negative numbers, and duplicates on synthetic CSVs', () => {
  const s1 = [
    'Facility,Activity_Type,Fuel_Type,Consumption_Amount,Consumption_Unit,Emission_Factor,CO2e_Tonnes,Date,Notes',
    'HQ,Stationary Combustion,Natural Gas,-100,cubic_feet,0.0531,2.39,2024-01-15,Negative test',
    'HQ,Stationary Combustion,Natural Gas,-100,cubic_feet,0.0531,2.39,2024-01-15,Negative test',
  ].join('\n');
  const s2 = [
    'Facility,Energy_Type,Consumption_Amount,Consumption_Unit,Grid_Region,Emission_Factor,CO2e_Tonnes,Date,Renewable_Percentage,Notes',
    'HQ,Electricity,1000,kWh,,0.334,0.33,2024-01-15,0,Missing grid region',
  ].join('\n');
  const s3 = [
    'Category,Activity_Description,Spend_Amount,Spend_Currency,Emission_Factor,CO2e_Tonnes,Date,Supplier,Category_Details,Data_Quality',
    'Category 6,Business Travel - Air,1000,USD,0.5,0.5,2024-01-15,Corporate Travel,Business Travel,Secondary data',
  ].join('\n');

  const inv = loadInventoryFromCsvStrings({ scope1Csv: s1, scope2Csv: s2, scope3Csv: s3 }, 'custom');
  const quality = assessEmissionsQuality(inv);
  const ids = new Set(quality.issues.map((i) => i.id));
  assert.ok(ids.has('DQ-MISSING-NUMERIC'));
  assert.ok(ids.has('DQ-DUPLICATES'));
});

test('peer benchmarking extracts real Docusign & Shopify figures and flags limitations', async () => {
  const peers = await extractPeerProfiles();
  assert.equal(peers.length, 2);

  const docusign = peers.find((p) => p.id === 'peer1-docusign')!;
  assert.equal(docusign.scope1Co2e, 449);
  assert.equal(docusign.scope2LocationBasedCo2e, 8545);
  assert.equal(docusign.scope2MarketBasedCo2e, 3.1);

  const shopify = peers.find((p) => p.id === 'peer2-shopify')!;
  assert.equal(shopify.scope1Co2e, 360);
  assert.equal(shopify.scope2LocationBasedCo2e, 319);

  const summary = buildEmissionsSummary(loadDefaultInventory());
  const benchmark = await comparePeerEmissions(summary);
  assert.equal(benchmark.comparisons.length, 2);
  assert.ok(benchmark.methodologyLimitations.length >= 4);
  assert.ok(benchmark.scope1Ranking.length === 3);
});

test('GHG Protocol PDF extraction and hybrid/lexical retrieval preserves page metadata', async () => {
  const chunks = await loadProtocolChunks();
  assert.ok(chunks.length > 150);
  assert.ok(chunks.every((c) => c.pdfPage >= 1 && c.pdfPage <= 116));

  const travelResults = await searchGhgProtocol('employee business travel Scope 3 mobile combustion', 5);
  assert.equal(travelResults.length, 5);
  const combinedText = travelResults.map((r) => r.chunk.text.toLowerCase()).join(' ');
  assert.ok(combinedText.includes('business travel') || combinedText.includes('scope 3'));

  const s2Results = await searchGhgProtocol('Scope 2 purchased electricity steam heat', 5);
  assert.equal(s2Results.length, 5);
  assert.ok(s2Results.some((r) => r.chunk.text.toLowerCase().includes('scope 2')));
});

test('agent declares all 8 required tools and builds deterministic report', async () => {
  const names = AGENT_TOOL_DECLARATIONS.map((t) => t.function.name);
  assert.deepEqual(names, [
    'get_emissions_summary',
    'get_scope_breakdown',
    'get_highest_emitting_categories',
    'get_supplier_emissions',
    'assess_emissions_quality',
    'search_ghg_protocol',
    'compare_peer_emissions',
    'generate_emissions_report',
  ]);

  const report = await buildDeterministicReport(loadDefaultInventory());
  assert.equal(report.totalCombinedCo2eTonnes, 378683.02);
  assert.equal(report.topScope3Categories.length, 5);
  assert.ok(report.recommendations.length >= 4);
});
