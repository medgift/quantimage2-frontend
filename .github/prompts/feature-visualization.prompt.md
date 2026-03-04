# Feature Visualization & Collections

Guide for adding or modifying feature display, heatmap visualization, UMAP analysis, or feature collection management in the QuantImage v2 frontend.

## Requirements

- **What to build**: [DESCRIBE THE VISUALIZATION, FILTER, OR COLLECTION FEATURE]
- **Affected tab**: [overview | visualisation | clinical | train]
- **Data source**: [backend feature-details endpoint | existing state | new endpoint]

## Architecture Overview

```
Features.js (page hub)
  ├── Tab: overview → FeatureTable.js (react-table v7)
  ├── Tab: visualisation → Visualisation.js
  │     ├── Heatmap (Highcharts with boost module)
  │     ├── UMAP (umap-js + Plotly.js)
  │     ├── FilterTree.js (hierarchical feature selection)
  │     ├── FeatureSelection.js (correlation filter + importance ranking)
  │     └── Web Worker: /workers/filter-features.js (correlation matrix)
  ├── Tab: clinical → ClinicalFeatures.js + ClinicalFeatureTable.js
  ├── CollectionSelection.js (dropdown for feature subsets)
  └── "Save as Collection" → Backend.saveCollectionNew()
```

## Feature ID Format (CRITICAL)

```javascript
export const FEATURE_ID_SEPARATOR = '‑'; // Non-breaking hyphen U+2011

// Feature ID = "{modality}‑{roi}‑{featureName}"
// Example: "CT‑GTV_T‑original_firstorder_Mean"
```

**Import from:** `import { FEATURE_ID_SEPARATOR } from './Visualisation';`

**Never use a regular hyphen `-` as separator.** ROI names like `GTV-T` contain real hyphens.

**Regex for parsing feature IDs:**
```javascript
const featureIDRegex = new RegExp(
  `(?<modality>.*?)${FEATURE_ID_SEPARATOR}(?<roi>.*?)${FEATURE_ID_SEPARATOR}(?<featureName>(?:${prefixes.join('|')}).*)`
);
```

**Feature prefixes** (must match backend `const.py`):
- PyRadiomics: `original`, `log`, `wavelet`, `gradient`, `square`, `squareroot`, `exponential`, `logarithm`
- Riesz: `tex`
- ZRAD: `zrad`

## Checklist

### Adding a New Visualization Mode or Chart

1. Add the visualization to `src/Visualisation.js` or create a new component imported from there.
2. For Highcharts: use `HighchartsReact` component. Enable `boost` module for large datasets (>200K features).
3. For Plotly: use `plotly.js-dist` (already in dependencies).
4. For CPU-heavy computation (correlation matrix, clustering), use a Web Worker in `public/workers/`.
5. Web Workers cannot use ES6 imports — use `importScripts()` pattern. Files go in `public/workers/`.

### Modifying the Feature Table (Overview Tab)

6. `FeatureTable.js` uses react-table v7 API: `useTable()`, `useSortBy`.
7. Column definitions via `useMemo(() => [...columns], [deps])`.
8. For large datasets, consider `react-window` for virtualized scrolling (already in deps).

### Adding/Modifying Feature Filtering

9. Correlation-based filtering runs in the `filter-features.js` Web Worker.
10. Worker input: `{ features, leafItems, selected, corrThreshold }`.
11. Worker output: set of feature IDs to drop.
12. Feature importance ranking is in `FeatureSelection.js`.

### Managing Feature Collections (Subsets)

13. A collection = a named subset of feature IDs saved to the backend.
14. Create: `Backend.saveCollectionNew(token, extractionID, name, featureIDs, ...)`.
15. Load: `Backend.collectionDetails(token, collectionID)`.
16. Delete: `Backend.deleteCollection(token, collectionID)`.
17. Collection URL: `/features/:albumID/collection/:collectionID/:tab`.
18. Collections inherit train/test patient splits from the extraction, or can override them.

### Feature Name Display

19. Use `convertFeatureName()` from `utils/feature-naming.js` for human-readable names.
20. Use `groupFeatures()` for hierarchical grouping (modality → filter → category → name).
21. Feature definitions and descriptions are in `utils/feature-mapping.js` (`FEATURE_DEFINITIONS` array).

### Clinical Features (Separate from Radiomic)

22. Clinical features are managed in `ClinicalFeatures.js` + `ClinicalFeatureTable.js`.
23. They have plain string IDs (e.g., `"Age"`) — NOT the `FEATURE_ID_SEPARATOR` pattern.
24. Types: `Number`, `Categorical`. Encodings: `None`, `One-Hot Encoding`, `Normalization`, `Ordered Categories`.
25. Upload via CSV → backend guesses types → user confirms → save definitions + values.

## Data Flow: Feature Loading

```
Features.js mount
  → Backend.extractionFeatureDetails(token, extractionID)
      → GET /extractions/:id/feature-details (multipart response)
      → parseFeatureDetailsResponse() in utils/multipart-parser.js
          Part 1: featuresTabular (array of row objects for table)
          Part 2: featuresChart (array of feature objects for visualization)
  → setState({ featuresTabular, featuresChart })
  → Passed as props to FeatureTable, Visualisation, Train components
```
