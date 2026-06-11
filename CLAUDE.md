# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reference docs (read on demand)

Long-form architecture, components, and conventions live in [`docs/reference/`](docs/reference/) — one file per topic. **Don't inline these here; open the relevant file when a task needs that depth.** This file stays short and focused on commands, repo-level facts, and gotchas.

- [architecture.md](docs/reference/architecture.md) — overview, data flow, services & dependencies
- [code-structure.md](docs/reference/code-structure.md) — `src/` layout (services, context, config, utils, components)
- [page-components.md](docs/reference/page-components.md) — top-level route pages and responsibilities
- [development-patterns.md](docs/reference/development-patterns.md) — conventions & patterns
- [auth.md](docs/reference/auth.md) — Keycloak OIDC flow + security / medical-data handling
- [feature-extraction.md](docs/reference/feature-extraction.md) — feature extraction flow
- [ml-modeling.md](docs/reference/ml-modeling.md) — model training flow
- [libraries.md](docs/reference/libraries.md) — key libraries inventory
- [gotchas.md](docs/reference/gotchas.md) — important notes / non-obvious behaviors
- [config.md](docs/reference/config.md) — environment setup & `REACT_APP_*` env vars
- [commands.md](docs/reference/commands.md) — testing, useful commands, troubleshooting
- [coding-standards.md](docs/reference/coding-standards.md) — coding standards + post-edit formatting
- [docker-deployment.md](docs/reference/docker-deployment.md) — Docker, networking, deployment commands

See [docs/reference/README.md](docs/reference/README.md) for the index. These are *reference, not contract* — verify against code when it matters.

## Repository scope

React 18 SPA for the QuantImage v2 radiomics platform. Talks to:
- **Backend** (Flask + Socket.IO) — REST + WebSocket. Repo: `../quantimage2_backend/` in the parent setup dir.
- **Kheops** (DICOMweb PACS) — albums, studies, metadata.
- **Keycloak** — OIDC, token refresh handled by `@react-keycloak/web`.

All three URLs are baked in at **build time** through `REACT_APP_*` env vars (CRA limitation). Production builds therefore must set those at `yarn build` time, not at container start.

## High-level architecture (just enough to navigate)

```
src/
├── AppWrapper.js        Keycloak + Socket.IO providers wrap App
├── App.js               React Router v6 routes; guards via ProtectedRoute
├── services/
│   ├── backend.js       REST client; every method takes (token, ...)
│   ├── kheops.js        Kheops DICOMweb client
│   └── common.js        request() / rawRequest() / downloadFile()
├── context/             SocketContext, UserContext
├── config/constants.js  Enums shared with backend (model types, feature types, Socket.IO event names)
├── utils/
│   ├── feature-naming.js   parses `{modality}‑{roi}‑{name}` (U+2011 separator)
│   ├── feature-utils.js    assembleFeatures, trainModel, formatMetric, getModelLabel
│   ├── clinical-feature-id.js  builds/parses `<file_id>::<name>` clinical IDs
│   └── multipart-parser.js parses /extractions/:id/feature-details (tabular + chart)
├── components/          Reusable widgets (FeatureTable, FilterTree, ClinicalFeatureTable, etc.)
├── Features.js          Hub page: tabs `overview / clinical / visualisation / outcomes / datasplitting / train / models`
├── Visualisation.js     Heatmap + UMAP; feature selection tree → "save as collection"
├── ModelOverview.js     Trained-model list + comparison
└── public/workers/      Plain JS Web Workers (NOT bundled by webpack)
```

State management: Context + useState only. No Redux. Page-level state lives in `Features.js` and friends; children receive callbacks.

## Common commands

```bash
# Dev server (with hot reload via volume mount):
docker compose up                                 # http://localhost:3000

# Local Yarn (no Docker):
yarn install
yarn start

# Tests:
yarn test                                         # interactive watch mode
yarn test --watchAll=false                        # one-shot
yarn test src/App.test.js                         # one file
yarn test -t "renders learn react link"           # by test name

# Production build:
yarn build                                        # → /build static files
docker build -f Dockerfile.prod -t quantimage2-frontend:prod .

# Lint / format (project config: single quotes; react-hooks/exhaustive-deps as error):
npx prettier --check <files>
npx prettier --write <files>
npx eslint <files>
```

`yarn` is canonical (`yarn.lock` is committed). Do not switch to `npm install` — it will rewrite the lockfile.

## Gotchas worth flagging

- **Feature ID separator is U+2011 non-breaking hyphen `‑`** (defined as `FEATURE_ID_SEPARATOR` in `Visualisation.js`). Radiomics IDs use it; clinical feature IDs do **not** (the absence is how the backend tells them apart in `feature_collection.feature_ids`). Never normalize to a regular `-`.
- **Clinical feature IDs are namespaced `<file_id>::<name>`** (e.g. `3::Age`) so two uploaded CSVs can share a column name. Build/parse them via `utils/clinical-feature-id.js` (`makeClinicalFeatureId`, `clinicalFeatureIdPrefix`, `CLINICAL_FEATURE_ID_SEPARATOR = '::'`) — never hand-concatenate. The `::` separator contains no U+2011, so these still classify as clinical (not radiomics). Legacy collections stored bare names; the backend resolves those to the lowest `clinical_feature_file_id` (the migration's "Legacy" file).
- **`react-hooks/exhaustive-deps` is set to error**, so `useEffect` / `useCallback` / `useMemo` dependency arrays must be exhaustive. Wrap callbacks in `useCallback` to keep them stable; ESLint will block builds otherwise.
- **Socket.IO subscriptions need explicit cleanup** — `socket.on(..., handler)` paired with `return () => socket.off(..., handler)` in `useEffect`. Forgetting this leaves stacked listeners on every re-render.
- **CRA env vars are build-time and must be `REACT_APP_*` prefixed.** Anything else is dropped silently. `.env.local` (gitignored) is the dev-side place; production sets them in the Dockerfile build args.
- **`config-overrides.js` (via `react-app-rewired`) is required** for Monaco Editor + Node.js polyfills (webpack 5 dropped them). Do not `eject` and do not bypass the rewire.
- **Web workers in `public/workers/` are not bundled** — they're served as static files. They cannot use ES `import`; use `importScripts()`.
- **Token: never log `keycloak.token`, never put it in localStorage.** Pass it as the first arg to every `Backend.*` / `Kheops.*` method; the `@react-keycloak/web` provider keeps it fresh.
- **Exit prompt hook (`useExitPrompt`)** must be reset on unmount, otherwise the "Leave site?" warning sticks across page navigations.

## Backend ↔ frontend contract notes

- `feature_collection.feature_ids` is a flat array; entries containing U+2011 are radiomics IDs, the rest are clinical-feature IDs — `<file_id>::<name>` for collections saved after the multi-CSV change, or bare names for legacy ones.
- `Backend.*` methods take `token` first and throw on `response.error` / `response.message`. Catch and surface via `react-alert` (`alert.error(msg)`).
- Socket.IO events the frontend listens to: `extraction-status`, `feature-status`, `training-status` (constants in `config/constants.js`).
