# AGENTS.md

## Quick orientation
- Monorepo with two independent apps: `coInk/` (Next.js 16 + React 19) and `backEnd/` (NestJS + Prisma + MySQL).
- Run package commands from the app directory, not repo root (`pnpm dev`, `pnpm type-check`, etc.).
- Core architecture references: `coInk/src/app/docs/[room]/page.tsx`, `backEnd/src/app.module.ts`, `backEnd/prisma/schema.prisma`.

## Developer workflows that matter here
- Frontend loop: `cd coInk && pnpm dev`; backend loop: `cd backEnd && pnpm dev`.
- Backend Prisma client is generated to `backEnd/generated/prisma/` (see `backEnd/prisma/schema.prisma` generator output).
- Pre-commit hooks in both apps run `lint:ci`, `format:ci`, and `type-check` (`coInk/.husky/pre-commit`, `backEnd/.husky/pre-commit`).
- Commit style is enforced by commitlint + cz-git; use `pnpm commit` inside the target app.

## Cross-component data flow
- HTTP API is globally wrapped as `{ code, message, data, timestamp }` by `backEnd/src/common/interceptors/response.interceptor.ts`.
- Frontend service layer expects wrapped envelopes and usually reads `result.data.data` (`coInk/src/services/documents/*`).
- Error format is normalized by `backEnd/src/common/filters/http-exception.filter.ts`; keep this shape when adding error-dependent UI.
- Auth is cookie-first (HTTP-only `access_token`/`refresh_token`), so frontend does not attach bearer tokens (`coInk/src/utils/auth/cookie.ts`).

## Collaboration and document persistence
- Editor page boot sequence: permission check -> `Y.Doc` -> IndexedDB sync -> Hocuspocus provider (`coInk/src/app/docs/[room]/page.tsx`).
- Collaboration server starts from Nest via `HocuspocusService` on port `9999` (`backEnd/src/collaboration/hocuspocus.service.ts`).
- Persist both TipTap JSON and Yjs binary snapshot (`document_contents.content` + `document_contents.y_state`); do not remove dual-write behavior.
- Legacy content fallback (old base64 Yjs in JSON field) is handled in `backEnd/src/collaboration/document-yjs-storage.ts`.
- Version history uses composite PK `(document_id, version_id)` with second-level timestamps and retry-on-collision logic (`backEnd/src/documents/documents.service.ts`).

## External integrations and gotchas
- AI stream endpoint `/ai/editor/stream` returns raw stream bytes and is intentionally excluded from response wrapping.
- OSS editor image upload (`/upload/editor-image`) requires login cookie and full OSS env config (`backEnd/src/upload/oss.service.ts`).
- Frontend API base URL resolves from `NEXT_PUBLIC_SERVER_URL` with dev fallback to `http://localhost:8888` (`coInk/src/services/request/client.ts`).
- Collaboration URL currently reads `NEXT_PUBLIC_WEBSOCKET_URL` in code, while sample env uses `NEXT_PUBLIC_COLLABORATION_URL`; align before debugging ws issues.

## Project-specific coding conventions
- Frontend uses `@/*` alias (`coInk/tsconfig.json`); backend uses CommonJS target ES2023 (`backEnd/tsconfig.json`).
- Backend module pattern is strict: controller for routing, service for business logic, DTOs in `dto/`, entities/types in `entities/`.
- For iterative feature work, first provide an iteration plan + feature list and wait for approval, then document the iteration in `程序迭代文档.md` (see `CLAUDE.md`).

