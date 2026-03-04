# Code Architect — Architecture Review

Run this prompt to review frontend code changes for architectural consistency with QuantImage v2 patterns.

## When to Use

- After implementing a new feature or component
- When refactoring existing code
- Before opening a PR with significant changes

## Architecture Layers

```
src/
  ├── Pages (App.js, Features.js, Train.js, ...)     → Route-level components
  ├── components/                                      → Reusable UI components
  ├── services/ (backend.js, kheops.js, common.js)    → API client layer
  ├── context/ (SocketContext, UserContext)             → Cross-cutting state
  ├── config/constants.js                              → App-wide constants
  └── utils/                                           → Pure helper functions
```

## Review Checklist

### 1. Component Patterns

- All new components must be **functional components** with hooks (no class components)
- One component per file, file name = component name (PascalCase)
- Export as `export default ComponentName`
- Destructure props in function signature
- Define `PropTypes` for all props
- Provide `defaultProps` for optional props

Red flags:
- Class components in new code
- Multiple component exports from one file
- Components with >200 lines (consider extraction)

### 2. Service Layer Separation

- **Pages** handle: route params, data fetching, state management, layout
- **Components** handle: rendering props, local UI state, event callbacks
- **Services** handle: HTTP requests, URL construction, header management
- **Utils** handle: pure data transformation, formatting, parsing

Red flags:
- `fetch()` or `axios` calls directly in components (use `Backend.*` or `Kheops.*`)
- Business logic in reusable components (should be in pages or utils)
- API URLs hardcoded in components (use service methods)

### 3. Authentication

- `useKeycloak()` hook for token access
- `keycloak.token` passed as first argument to all service methods
- `<ProtectedRoute>` wrapper for authenticated pages
- Never store tokens in state, localStorage, or cookies
- Never log tokens to console

### 4. State Management

- Local state: `useState` in the component that owns it
- Shared state: lift to common parent, or use Context (SocketContext, UserContext)
- No Redux/Zustand — this project uses React Context + prop drilling
- `useCallback` for functions in dependency arrays
- `useMemo` for expensive computations

### 5. Real-Time Events (Socket.IO)

- Access socket via `useContext(SocketContext)`
- Subscribe in `useEffect` with cleanup: `return () => socket.off(event)`
- Event names must match backend `MessageType` enum values
- Filter events by ID (extraction_id, training_id) — multiple users share the socket

### 6. Feature ID Handling

- Always use `FEATURE_ID_SEPARATOR` (U+2011 non-breaking hyphen) from constants
- Never use regular hyphen `-` as feature separator
- Use the regex pattern from `Visualisation.js` for parsing feature IDs

### 7. Error Handling

- Wrap async calls in `try/catch`
- Show user-facing errors via `<Alert color="danger">`
- Log errors to console with `console.error()`
- Show `<Spinner />` during loading states
- Handle empty data states gracefully

### 8. Performance

- `useMemo` for expensive transformations (feature lists, chart data)
- Web Workers for heavy computation (correlation matrix in `public/workers/`)
- `react-window` for large lists (>1000 items)
- `useCallback` to prevent unnecessary re-renders of child components

### 9. Styling

- Use reactstrap components (Bootstrap 4) for layout/UI
- Bootstrap utility classes for spacing: `mt-3`, `mb-2`, `p-3`, etc.
- `react-icons` for icons
- No inline styles unless dynamic — prefer CSS classes

## Output Format

For each concern found:
```
⚠ [Category]: Description
  File: path/to/file.js
  Suggestion: How to fix
```

If no issues: `✓ Architecture review: No concerns found`
