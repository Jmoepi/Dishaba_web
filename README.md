Dishaba Mine — Web Admin Portal (Next.js)

Purpose

- Lightweight web admin portal intended for supervisors and admins to review and manage breakdowns.

Quick start

1. Copy environment variables into `website/.env.local` (see `.env.local.example`).
2. From `website/` install dependencies and run dev server:

```bash
cd website
npm install
npm run dev
```

3. Open http://localhost:3000

Notes

- The portal uses the same Supabase backend as the Flutter app. Server-side Row-Level Security (RLS) will enforce permissions.
- Export uses the `public.export_breakdowns` RPC you added via migrations; ensure it's applied.
- There is a server-side API endpoint at `pages/api/export.js` which calls the `export_breakdowns` RPC using a `SUPABASE_SERVICE_ROLE` key. Put the service role key into your deployment environment (do NOT expose it to clients).
