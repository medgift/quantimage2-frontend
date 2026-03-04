# New Reusable Component

Guide for adding a new reusable UI component to the QuantImage v2 frontend.

## Requirements

- **Component name**: [NAME]
- **Purpose**: [DESCRIBE]
- **Where used**: [list parent pages/components]
- **Interactive?**: [display-only / interactive]

## Architecture Overview

```
src/components/
  ├── Domain components: FeatureHeatmap, ModelMetrics, PatientSelector, ...
  ├── Layout components: Breadcrumbs, ErrorBoundary, ...
  └── UI components: Spinner wrappers, Badge variants, ...
```

**UI Library:** reactstrap (Bootstrap 4 React wrappers)

## Checklist

### 1. Create the Component File

1. Create `src/components/MyComponent.js`:

```jsx
import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardBody, CardTitle } from 'reactstrap';

function MyComponent({ title, data, onAction }) {
  return (
    <Card>
      <CardBody>
        <CardTitle tag="h5">{title}</CardTitle>
        {/* Render data */}
        {data && data.map((item, index) => (
          <div key={item.id || index}>{item.name}</div>
        ))}
      </CardBody>
    </Card>
  );
}

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  onAction: PropTypes.func,
};

MyComponent.defaultProps = {
  data: [],
  onAction: () => {},
};

export default MyComponent;
```

### 2. Component Conventions

2. **Functional components only** — no class components in new code.
3. One component per file. File name = component name in PascalCase.
4. Export as default: `export default MyComponent`.
5. Destructure all props in the function signature.
6. Define `PropTypes` for all props (the project uses `prop-types` package).
7. Provide `defaultProps` for optional props.

### 3. Hooks Usage

8. `useState` — local component state.
9. `useEffect` — side effects (API calls, subscriptions). Always include a cleanup return.
10. `useCallback` — memoize callbacks passed to children or used in `useEffect` deps.
11. `useMemo` — memoize expensive computations (feature transformations, sorting, filtering).
12. `useRef` — DOM references (for Highcharts containers, scroll targets).
13. `useContext(SocketContext)` — Socket.IO connection (only if component needs real-time updates).
14. `useKeycloak()` — access `keycloak.token` for API calls (prefer passing token as prop from parent).

### 4. Styling

15. Use **Bootstrap 4 utility classes**: `mt-3`, `mb-2`, `p-3`, `d-flex`, `text-center`, etc.
16. Use **reactstrap** components: Container, Row, Col, Card, Button, Badge, Table, Modal, Alert, Spinner, etc.
17. For custom styles, use CSS modules or inline styles. Avoid global CSS where possible.
18. For icons, use `react-icons`:
```jsx
import { FaDownload, FaTrash } from 'react-icons/fa';
<Button><FaDownload /> Download</Button>
```

### 5. Data Display Patterns

19. **Tables**: Use `react-table` v7 hooks API (`useTable`, `useSortBy`, `useFilters`).
20. **Charts (Highcharts)**:
```jsx
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
<HighchartsReact highcharts={Highcharts} options={chartOptions} />
```
21. **Charts (Plotly)**:
```jsx
import Plotly from 'plotly.js-dist';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);
```
22. **Loading states**: Always show `<Spinner />` while data is loading.
23. **Empty states**: Show a message when data array is empty, don't render an empty table/chart.
24. **Error states**: Use `<Alert color="danger">{error.message}</Alert>`.

### 6. Performance

25. Wrap expensive computations in `useMemo`:
```jsx
const processedData = useMemo(() => {
  return heavyComputation(rawData);
}, [rawData]);
```
26. For very heavy work (correlation matrices, UMAP), use a Web Worker (see `public/workers/`).
27. For large lists (>1000 items), consider `react-window` for virtualization.
28. Avoid anonymous functions in JSX event handlers in tight loops — use `useCallback`.

### 7. Integration

29. Import in the parent component: `import MyComponent from './components/MyComponent';`.
30. Pass data and callbacks as props — prefer "lifting state up" to shared parent.
31. For cross-cutting data (user, socket), use Context rather than prop drilling.
32. Never make API calls directly in reusable components — receive data as props, let pages handle fetching.
