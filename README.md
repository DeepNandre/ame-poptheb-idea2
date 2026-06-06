# VEX

**Shaping tomorrow with vision and action.**

We back visionaries and craft ventures that define what comes next.
Investing. Building. Advisory.

A teaser landing page with an early-access form.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Visiting with `?access` opens the early-access form directly.

## Scripts

```bash
npm run dev       # dev server (early-access endpoint mounted in-process)
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build
```

## Early access

The form posts to `/api/early-access`, handled in dev/preview by a small Vite
middleware (`server/earlyAccess.mjs`) that appends each submission to
`data/early-access.jsonl` (gitignored).

> Note: a static-only host (e.g. plain Vercel/Netlify static) has no Node
> server, so the endpoint won't exist there — wire the form to a form service
> (Formspree, Supabase, etc.) for production capture.
