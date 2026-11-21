import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { buildDeterministicReport, runEmissionsAgent } from './server/agent.ts';
import { comparePeerEmissions } from './server/benchmarkEngine.ts';
import {
  buildEmissionsSummary,
  buildUnifiedCsvExport,
  loadDefaultInventory,
  loadInventoryFromCsvStrings,
  type LoadedInventory,
} from './server/emissionsEngine.ts';
import { assessEmissionsQuality } from './server/qualityEngine.ts';
import { askGhgProtocolRag, loadProtocolChunks, searchGhgProtocol } from './server/ragEngine.ts';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  let activeInventory: LoadedInventory = loadDefaultInventory();

  // Warm PDF chunks in background on startup
  loadProtocolChunks().catch((err) => {
    console.warn('[Startup] Failed to preload GHG Protocol PDF chunks:', err);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      datasetSource: activeInventory.datasetSource,
      totalRecords: activeInventory.records.length,
    });
  });

  app.get('/api/dashboard', (_req, res) => {
    try {
      const summary = buildEmissionsSummary(activeInventory);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/quality', (_req, res) => {
    try {
      const quality = assessEmissionsQuality(activeInventory);
      res.json(quality);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/benchmarks', async (_req, res) => {
    try {
      const summary = buildEmissionsSummary(activeInventory);
      const benchmark = await comparePeerEmissions(summary);
      res.json(benchmark);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/knowledge/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim();
      const topK = Math.min(12, Math.max(1, Number(req.query.topK ?? 6) || 6));
      if (!q) {
        const chunks = await loadProtocolChunks();
        res.json({
          query: '',
          totalChunksIndexed: chunks.length,
          results: chunks.slice(0, topK).map((c) => ({
            chunk: {
              id: c.id,
              sourceDocument: c.sourceDocument,
              pdfPage: c.pdfPage,
              printedPage: c.printedPage,
              chapter: c.chapter,
              text: c.text,
            },
            score: 1,
            matchType: 'lexical',
          })),
        });
        return;
      }
      const results = await searchGhgProtocol(q, topK);
      const all = await loadProtocolChunks();
      res.json({
        query: q,
        totalChunksIndexed: all.length,
        results,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const formatApiError = (err: unknown): { status: number; message: string } => {
    const raw = (err as Error)?.message ?? 'Unexpected server error';
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        const code = Number(parsed.error.code);
        return {
          status: code >= 400 && code < 600 ? code : 500,
          message: String(parsed.error.message),
        };
      }
    } catch {
      // raw string is not JSON
    }
    const status = raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') ? 429 : 500;
    return { status, message: raw };
  };

  app.post('/api/knowledge/ask', async (req, res) => {
    try {
      const question = String(req.body?.question ?? '').trim();
      if (!question) {
        res.status(400).json({ error: 'Question is required.' });
        return;
      }
      const answer = await askGhgProtocolRag(question);
      res.json(answer);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/agent/chat', async (req, res) => {
    try {
      const message = String(req.body?.message ?? '').trim();
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      if (!message) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }
      const result = await runEmissionsAgent(activeInventory, message, history);
      res.json(result);
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/report', async (_req, res) => {
    try {
      const report = await buildDeterministicReport(activeInventory);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/export/csv', (_req, res) => {
    try {
      const csv = buildUnifiedCsvExport(activeInventory);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="carbonlens_unified_emissions.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/upload', (req, res) => {
    try {
      const action = req.body?.action;
      if (action === 'reset') {
        activeInventory = loadDefaultInventory();
        res.json({
          status: 'reset',
          summary: buildEmissionsSummary(activeInventory),
        });
        return;
      }

      const scope1Csv = typeof req.body?.scope1Csv === 'string'
        ? req.body.scope1Csv
        : fs.readFileSync(path.resolve(process.cwd(), 'public/assets/aistudio/scope1_7c8d72b0.csv'), 'utf8');
      const scope2Csv = typeof req.body?.scope2Csv === 'string'
        ? req.body.scope2Csv
        : fs.readFileSync(path.resolve(process.cwd(), 'public/assets/aistudio/scope2_3a51590d.csv'), 'utf8');
      const scope3Csv = typeof req.body?.scope3Csv === 'string'
        ? req.body.scope3Csv
        : fs.readFileSync(path.resolve(process.cwd(), 'public/assets/aistudio/scope3_8c63ce28.csv'), 'utf8');

      const next = loadInventoryFromCsvStrings({ scope1Csv, scope2Csv, scope3Csv }, 'custom');
      if (next.records.length === 0) {
        res.status(400).json({ error: 'Uploaded CSV files produced 0 valid emission records.' });
        return;
      }
      activeInventory = next;
      res.json({
        status: 'updated',
        summary: buildEmissionsSummary(activeInventory),
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`CarbonLens server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
