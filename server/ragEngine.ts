import fs from 'node:fs';
import path from 'node:path';
import { Groq } from 'groq-sdk';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ProtocolChunk, ProtocolSearchResult } from './types.ts';
import { callGroqWithRetry } from './agent.ts';

export const GHG_PROTOCOL_PDF_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/ghg-protocol-revised_cfcda4dd.pdf'
);

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'of', 'to', 'in', 'for', 'or', 'as',
  'by', 'with', 'be', 'are', 'that', 'this', 'from', 'it', 'can', 'how', 'what', 'why',
  'should', 'my', 'our', 'we', 'i', 'do', 'does', 'if', 'about', 'into', 'than', 'using',
]);

let cachedChunks: ProtocolChunk[] | null = null;

function detectChapterHeading(text: string, currentChapter: string): string {
  const m = /\b(CHAPTER\s+\d+\s+[A-Za-z0-9 ,&-]{4,60}|APPENDIX\s+[A-D]\s+[A-Za-z0-9 ,&-]{4,60})/i.exec(text);
  if (m && m[1]) {
    return m[1].replace(/\s+/g, ' ').trim();
  }
  return currentChapter;
}

function detectPrintedPage(text: string): string | null {
  const m = /\b(\d{1,3})\s+(?:CHAPTER|APPENDIX|A\s+Corporate|GHG\s+Protocol)/i.exec(text.slice(0, 120));
  if (m && m[1]) return m[1];
  const endMatch = /\b(\d{1,3})$/.exec(text.slice(-30).trim());
  if (endMatch && endMatch[1]) return endMatch[1];
  return null;
}

export function chunkPageText(
  text: string,
  pdfPage: number,
  chapter: string,
  printedPage: string | null,
  chunkSize = 1050,
  overlap = 180
): ProtocolChunk[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 40) return [];
  const chunks: ProtocolChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < cleaned.length) {
    let end = Math.min(cleaned.length, start + chunkSize);
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      if (lastPeriod > start + chunkSize * 0.55) {
        end = lastPeriod + 1;
      }
    }
    const slice = cleaned.slice(start, end).trim();
    if (slice.length > 35) {
      chunks.push({
        id: `ghg-p${pdfPage}-c${idx}`,
        sourceDocument: 'ghg-protocol-revised.pdf',
        pdfPage,
        printedPage,
        chapter,
        text: slice,
      });
      idx += 1;
    }
    if (end >= cleaned.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export async function loadProtocolChunks(): Promise<ProtocolChunk[]> {
  if (cachedChunks) return cachedChunks;

  const data = new Uint8Array(fs.readFileSync(GHG_PROTOCOL_PDF_PATH));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const chunks: ProtocolChunk[] = [];
  let currentChapter = 'Front Matter & Overview';

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    const rawText = tc.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawText) continue;
    currentChapter = detectChapterHeading(rawText, currentChapter);
    const printedPage = detectPrintedPage(rawText);
    const pageChunks = chunkPageText(rawText, pageNum, currentChapter, printedPage);
    chunks.push(...pageChunks);
  }

  cachedChunks = chunks;
  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function scoreLexicalBm25(query: string, chunks: ProtocolChunk[]): Map<string, number> {
  const qTokens = tokenize(query);
  const qLower = query.toLowerCase();
  const scores = new Map<string, number>();
  if (qTokens.length === 0) return scores;

  // Document frequency
  const df = new Map<string, number>();
  const tokenizedDocs = chunks.map((c) => {
    const toks = tokenize(c.text);
    const unique = new Set(toks);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    return { chunk: c, toks };
  });

  const N = chunks.length;
  const avgLen =
    tokenizedDocs.reduce((acc, d) => acc + d.toks.length, 0) / Math.max(1, tokenizedDocs.length);
  const k1 = 1.5;
  const b = 0.75;

  // Important GHG Protocol domain phrases
  const keyPhrases = [
    'business travel',
    'employee business travel',
    'scope 1',
    'scope 2',
    'scope 3',
    'purchased electricity',
    'steam',
    'location-based',
    'market-based',
    'emission factor',
    'activity data',
    'mobile combustion',
    'materiality',
    'organizational boundary',
    'operational boundary',
    'equity share',
    'control approach',
    'green power',
    'renewable',
    'quality management',
  ];

  for (const { chunk, toks } of tokenizedDocs) {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    const dl = toks.length;
    for (const qt of qTokens) {
      const freq = tf.get(qt) ?? 0;
      if (freq === 0) continue;
      const docFreq = df.get(qt) ?? 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const num = freq * (k1 + 1);
      const denom = freq + k1 * (1 - b + (b * dl) / Math.max(1, avgLen));
      score += idf * (num / denom);
    }

    const lowerText = chunk.text.toLowerCase();
    for (const phrase of keyPhrases) {
      if (qLower.includes(phrase) && lowerText.includes(phrase)) {
        score += 3.2;
      }
    }

    if (score > 0) {
      scores.set(chunk.id, score);
    }
  }

  return scores;
}

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured in server environment.');
  }
  return new Groq({ apiKey });
}

export async function searchGhgProtocol(
  query: string,
  topK = 6
): Promise<ProtocolSearchResult[]> {
  const chunks = await loadProtocolChunks();
  const bm25Scores = scoreLexicalBm25(query, chunks);

  const candidates = [...chunks]
    .map((c) => ({ chunk: c, lexScore: bm25Scores.get(c.id) ?? 0 }))
    .sort((a, b) => b.lexScore - a.lexScore)
    .slice(0, 18);

  if (candidates.length === 0 || candidates[0].lexScore === 0) {
    // Fallback broad scan if query uses unusual phrasing
    return chunks.slice(0, topK).map((c) => ({
      chunk: {
        id: c.id,
        sourceDocument: c.sourceDocument,
        pdfPage: c.pdfPage,
        printedPage: c.printedPage,
        chapter: c.chapter,
        text: c.text,
      },
      score: 0.1,
      matchType: 'lexical',
    }));
  }

  const maxLex = Math.max(...candidates.map((c) => c.lexScore), 1);

  return candidates.slice(0, topK).map((cand) => ({
    chunk: {
      id: cand.chunk.id,
      sourceDocument: cand.chunk.sourceDocument,
      pdfPage: cand.chunk.pdfPage,
      printedPage: cand.chunk.printedPage,
      chapter: cand.chunk.chapter,
      text: cand.chunk.text,
    },
    score: Math.round((cand.lexScore / maxLex) * 1000) / 1000,
    matchType: 'hybrid',
  }));
}

export async function askGhgProtocolRag(question: string): Promise<{
  answerMarkdown: string;
  passages: ProtocolSearchResult[];
}> {
  const passages = await searchGhgProtocol(question, 6);
  const groq = getGroqClient();
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const contextBlock = passages
    .map(
      (p, i) =>
        `[Passage ${i + 1} | ${p.chunk.sourceDocument}, PDF page ${p.chunk.pdfPage}${
          p.chunk.printedPage ? ` (printed p. ${p.chunk.printedPage})` : ''
        } | ${p.chunk.chapter}]\n${p.chunk.text}`
    )
    .join('\n\n');

  const response = await callGroqWithRetry(() =>
    groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a GHG Protocol Corporate Standard subject-matter expert.

Answer the user's question using ONLY the retrieved GHG Protocol passages below for authoritative GHG Protocol rules, and explicitly separate:
1. **Retrieved GHG Protocol Evidence** (cite exact PDF/printed page numbers from the passages)
2. **Practical Implementation & Calculation Guidance** (where helpful beyond the 2004 base text, e.g., clarifying that Scope 2 location-based vs. market-based dual reporting was formalized in the 2015 GHG Protocol Scope 2 Guidance while the 2004 Revised Edition covers Scope 2 purchased electricity, steam, heat, and cooling).

Never invent page numbers or requirements not supported by the passages.`,
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nRetrieved Passages:\n${contextBlock}`,
        },
      ],
      temperature: 0.1,
    })
  );

  return {
    answerMarkdown: response.choices[0]?.message?.content ?? 'Unable to generate response from retrieved passages.',
    passages,
  };
}
