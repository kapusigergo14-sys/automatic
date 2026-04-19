# leadgen dashboard

Local-only Next.js app for inspecting, filtering, and triaging lead pools.
Runs at http://localhost:3001 — **never deploy this**.

## Setup

```bash
cd leadgen/dashboard
npm install
npm run dev
```

## What it does

- Reads `../output/leads/*.json` (pool) and `../output/v5-campaign/send-state-*.json` (sent history)
- Sortable / filterable table of every lead across all 4 industries
- Click any row to see detail + live website enrichment (tech stack, copyright, mobile, SSL, CTA count)
- Actions: move between industries, block (do-not-contact)

## Not deployed

This dashboard has write access to your leads JSON files. Keep it local.
