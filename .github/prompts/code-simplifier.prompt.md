# Code Simplifier — Post-Implementation Cleanup

Run this prompt after completing a feature to simplify and clean up the frontend code.

## When to Use

- After implementing a feature (before committing)
- After a complex debugging session
- As a final polish pass before PR

## Simplification Checklist

### 1. Dead Code Removal

- Remove commented-out JSX and JavaScript blocks
- Remove unused imports (ESLint will catch these too)
- Remove unused state variables and effects
- Remove `console.log()` debug statements
- Remove empty event handlers or callbacks

### 2. Hook Optimization

- Remove `useEffect` dependencies that never change (constants, refs)
- Merge multiple `useState` calls into a single state object when they always change together
- Replace `useEffect` + `setState` patterns with `useMemo` when computing derived values:
  ```jsx
  // Before
  const [filtered, setFiltered] = useState([]);
  useEffect(() => { setFiltered(items.filter(predicate)); }, [items]);

  // After
  const filtered = useMemo(() => items.filter(predicate), [items]);
  ```
- Ensure `useCallback` wraps functions used in `useEffect` dependency arrays

### 3. Component Extraction

- Extract repeated JSX patterns (>3 uses) into small components
- Extract complex conditional rendering into named components
- Move large inline functions to named `useCallback` hooks or helper functions

### 4. Prop Simplification

- Replace prop drilling (>2 levels) with Context or component composition
- Remove unused props from component signatures
- Ensure PropTypes match actual usage

### 5. Conditional Rendering

Simplify verbose conditionals:
```jsx
// Before
{loading ? <Spinner /> : data !== null ? <DataView data={data} /> : <p>No data</p>}

// After (early returns)
if (loading) return <Spinner />;
if (!data) return <p>No data</p>;
return <DataView data={data} />;
```

### 6. String & Template Cleanup

- Use template literals instead of string concatenation
- Remove unnecessary `.toString()` calls
- Use optional chaining: `obj?.prop?.nested` instead of `obj && obj.prop && obj.prop.nested`
- Use nullish coalescing: `value ?? 'default'` instead of `value !== null && value !== undefined ? value : 'default'`

### 7. Import Organization

- Group: React → third-party → local services → local components → local utils → CSS
- Remove unused imports
- Use named imports where possible

### 8. Naming

- Components: PascalCase (`FeatureTable`, not `featureTable`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Boolean state: `is*`, `has*`, `can*` prefixes (`isLoading`, `hasError`)
- Event handlers: `handle*` prefix (`handleClick`, `handleSubmit`)
- Rename vague names (`data`, `result`, `tmp`, `item`) to descriptive ones

### 9. Project-Specific Patterns

- Use `FEATURE_ID_SEPARATOR` constant (U+2011), never literal `‑` or `-`
- Use `Backend.*` and `Kheops.*` static methods, never raw `fetch()`
- Use `keycloak.token` directly, never cache tokens
- Use `MessageType` constant values for Socket.IO events
- Use `formatMetric()` for displaying numeric metrics
- Use `convertFeatureName()` for human-readable feature names

## Output Format

For each simplification applied:
```
Simplified: <brief description>
  File: path/to/file.js
  Before: <old code>
  After: <new code>
```
