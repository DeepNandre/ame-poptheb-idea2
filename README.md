# Spectre

**We show insurers what attackers already know about their policyholders.**

Spectre turns any insured address into an attacker's-eye picture — assembled only
from public records and passively-observed signals. Quantify the exposure before
it becomes a claim.

This repository is the marketing landing page.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS. Pure static SPA — no backend.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Visiting with `?demo` opens the "Book a demo" form directly.

## Scripts

```bash
npm run dev       # dev server
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build
```

## Demo requests

The "Book a demo" form writes directly to Supabase from the browser
(`src/components/landing/submitDemo.ts`). The table is **insert-only** under
Row-Level Security — visitors can submit a lead, but the publishable key cannot
read, update, or delete any data. Schema: [`supabase/demo_requests.sql`](supabase/demo_requests.sql).

Read submitted leads from the Supabase dashboard's Table editor.
