# Changes (UI/UX overhaul)

Summary of major edits made during the UI/UX pass:

- Global design system and responsive styles added: `styles/globals.css`.
- App shell and navigation refactor: `components/Layout.js`.
- Improved components: `components/BreakdownTable.js`, `ConfirmModal.js`, `Tooltip.js`, `Sparkline.js`.
- Formatting helpers and downtime display: `lib/formatters.js` (shows days when >= 24h).
- Pages updated to use new layout/design: `pages/index.js`, `pages/admin.js`, `pages/analytics.js`, `pages/login.js`.
- API routes preserved: `pages/api/*.js` (close/export/breakdowns).
- Linting and formatting: Prettier and ESLint configs added; ran auto-fixes.

Notes / rationale:
- Accessibility and keyboard behaviors improved for modals, tooltips and drawers.
- Kept Supabase usage intact; no database or API contract changes.
- Large files (node_modules etc.) are excluded via `.gitignore`.

Next steps (recommended):
- Run manual smoke test: `pnpm dev` (dev server runs on port 3000 by default). If port in use, use `pnpm dev -p 3001`.
- Run full accessibility check (Lighthouse) and fix any remaining issues.
- Add icons and micro-interactions for final polish.
- Commit and create a release branch if you want to push to production.

How to run locally
1. Install dependencies: `pnpm install`
2. Start dev server: `pnpm dev` or `pnpm dev -p 3001`
3. Open http://localhost:3000 (or 3001)

If you want, I can continue with any of the next steps above and run the dev server now.
