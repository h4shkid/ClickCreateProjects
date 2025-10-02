# Repository Guidelines

## Project Structure & Module Organization
- Root: `nft-snapshot-tool/` (Next.js App Router).
- App code: `app/` (pages, `app/api/**/route.ts`, global styles in `app/globals.css`).
- UI: `components/` (PascalCase files for layout and small UI parts).
- Core libs: `lib/`
  - `blockchain/`, `database/`, `processing/`, `metadata/`, `websocket/`, `advanced/`, `api/`, `utils/`.
- Scripts: `scripts/` (DB init, state rebuild, phase tests).
- Data: `data/` (SQLite `nft-snapshot.db`). Assets: `public/`. Reports: `reports/`.

## Build, Test, and Development Commands
- `npm run dev`: Start dev server at http://localhost:3000.
- `npm run build`: Production build (Next.js + TypeScript).
- `npm run start`: Serve the production build.
- `npm run lint`: Lint with ESLint (Next core-web-vitals + TS).
- `node scripts/init-db.js`: Create/verify tables in `data/nft-snapshot.db`.
- `node scripts/rebuild-state.js`: Recompute balances/state from stored events.
- `node test-env.js`: Print effective env for quick sanity checks.
Example smoke checks: `GET /api/snapshot/current`, `GET /api/analytics/summary`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict), 2-space indent, avoid `any` when feasible.
- Components: PascalCase (e.g., `components/layout/Header.tsx`). Utilities: camelCase.
- Routes: kebab-case folder segments under `app/*`; API in `app/api/**/route.ts`.
- Imports: prefer `@/*` path alias when helpful.
- Styling: Tailwind CSS v4; keep utility classes close to markup.
- Run `npm run lint` and fix issues before PRs.

## Testing Guidelines
- No formal runner yet. Use scripts above and hit local API routes for smoke tests.
- If adding tests, place `*.test.ts` near source, mock DB/providers, and avoid network I/O by default.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat(blockchain): add provider fallback`).
- PRs include: description, linked issues, steps to verify, screenshots/GIFs for UI, and notes on new env vars or DB migrations.
- Ensure `npm run lint` passes and basic routes respond locally.

## Security & Configuration Tips
- Use `.env.local` (never commit secrets). Common keys: `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_QUICKNODE_ENDPOINT`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_ALCHEMY_WS_URL`, `OPENSEA_API_KEY`, `DATABASE_PATH`.
- Default DB path: `./data/nft-snapshot.db` (override with `DATABASE_PATH`).
- Do not commit `data/*.db*` or private keys; validate inputs with helpers in `lib/api/response-utils.ts`.

