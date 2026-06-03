## Coding Standards & Conventions

### JavaScript / React Style

- Use **functional components with hooks** — no class components in new code.
- Prefer `const` over `let`; never use `var`.
- Use **destructured props** in function signatures: `function MyComponent({ prop1, prop2 })`.
- Use `useMemo` and `useCallback` for expensive computations and callback stability (required by `react-hooks/exhaustive-deps` eslint rule set to `error`).
- Always include all dependencies in `useEffect` / `useCallback` / `useMemo` dependency arrays — the ESLint rule will flag violations.
- Prefer early returns over deeply nested conditionals.
- Use **template literals** for string interpolation, never string concatenation.
- File naming: PascalCase for components (`MyComponent.js`), camelCase for utilities (`feature-utils.js` or `featureUtils.js`).
- One component per file. Export as default for page/component files.

### CSS

- CSS modules or plain `.css` files co-located with components (e.g., `Features.css` next to `Features.js`).
- Use Bootstrap 4 utility classes (via reactstrap) for layout where possible.
- Avoid inline styles except for dynamic values (e.g., chart dimensions).

### Error Handling

- Service methods (`Backend.*`, `Kheops.*`) throw on failure — callers should use `try/catch`.
- Display errors to users via `react-alert` toast: `alert.error(message)`.
- Never swallow errors silently — at minimum log to `console.error()`.
- Use `ErrorBoundary` component to wrap sections that may fail at render time.

### State Management

- **No Redux.** State flows through React Context (global) and useState/props (local).
- Global state: `UserContext` (user + admin flag), `SocketContext` (Socket.IO client).
- Page-level state lives in top-level page components (`Features.js`, `Dashboard.js`).
- Avoid prop drilling beyond 2 levels — extract to context or restructure.

### Token / Auth Handling

- Always access the token via `useKeycloak()` hook: `const { keycloak } = useKeycloak(); keycloak.token`.
- Pass `keycloak.token` as first argument to all `Backend.*` and `Kheops.*` methods.
- **Never store tokens** in localStorage, sessionStorage, or component state.
- Token refresh is handled automatically by `@react-keycloak/web`.
- **Never log tokens** — use `console.debug()` only for development diagnostics.

### Dependencies

- Use `yarn` (not npm) — `yarn.lock` is committed.
- Check existing deps before adding new ones (the project already includes lodash, moment, luxon, papaparse, etc.).
- Use `react-app-rewired` for webpack config overrides (see `config-overrides.js`).

---

## Code Formatting (Post-Edit)

**After every code edit**, ensure the modified JavaScript files conform to **Prettier** formatting (config in `.prettierrc`: single quotes).

### Rules

- Single quotes (configured in `.prettierrc`)
- Semicolons (Prettier default)
- 2-space indentation (Prettier default)
- Trailing commas where valid (Prettier default)
- Print width: 80 characters (Prettier default)

### How to Format

```bash
npx prettier --write <modified_files>
```

### What to Check

After editing any `.js` or `.jsx` file, verify formatting:
```bash
npx prettier --check <modified_files>
```

### ESLint

The project uses `eslint` with `react-app` config and strict `react-hooks/exhaustive-deps: "error"`. After edits, check:
```bash
npx eslint <modified_files>
```

### Scope

Format only the files you changed — do not reformat the entire codebase.

---

