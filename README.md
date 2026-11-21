# CarbonLens — AI-Powered Emissions Analysis & Insights Agent

Full-stack corporate greenhouse gas (GHG) emissions analysis, GHG Protocol RAG knowledge assistant, deterministic data quality validation engine, peer benchmarking, and tool-calling Gemini agent built for the Unravel Carbon ML Engineer Take-Home Assignment.

## Architecture Overview

- **Backend (`server.ts` + `server/`)**: Express + TypeScript server executing deterministic CSV analytics, PDF parsing (`pdfjs-dist`), hybrid RAG (`gemini-embedding-2` + BM25), peer benchmarking, rule-based quality auditing, and multi-turn Gemini tool calling (`@google/genai` with `gemini-4-hydrogen`).
- **Frontend (`src/`)**: React 19 + TypeScript + Tailwind CSS v4 SaaS workspace featuring 6 interactive views:
  1. **Overview Dashboard** (`DashboardView.tsx`)
  2. **AI Emissions Agent** (`AgentView.tsx`)
  3. **GHG Protocol RAG** (`KnowledgeView.tsx`)
  4. **Data Quality Audit** (`QualityView.tsx`)
  5. **Peer Benchmarking** (`BenchmarkView.tsx`)
  6. **Executive Reports** (`ReportsView.tsx`)

## Setup & Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and set `GEMINI_API_KEY`:
   ```bash
   GEMINI_API_KEY="your_gemini_api_key"
   ```

3. **Run development server (port 3000)**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

4. **Run automated checks**:
   ```bash
   npm test       # Unit tests via tsx --test (CSV analytics, quality rules, peer PDFs, RAG, 8 agent tools)
   npm run lint   # TypeScript typecheck (tsc --noEmit)
   npm run build  # Production Vite bundle
   ```

5. **Run production server**:
   ```bash
   npm run build && npm start
   ```

## Deterministic Tools Exposed to Gemini (`gemini-4-hydrogen`)

1. `get_emissions_summary`
2. `get_scope_breakdown`
3. `get_highest_emitting_categories`
4. `get_supplier_emissions`
5. `assess_emissions_quality`
6. `search_ghg_protocol`
7. `compare_peer_emissions`
8. `generate_emissions_report`
