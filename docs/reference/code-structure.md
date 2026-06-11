## Code Structure

### Entry Point: `src/index.js`

Renders `AppWrapper` into `#root` div.

```javascript
ReactDOM.render(<BrowserRouter><AppWrapper /></BrowserRouter>, document.getElementById('root'));
```

---

### `src/AppWrapper.js` – Root Component with Context Providers

**Responsibilities:**
- Initializes **Keycloak** client (authentication)
- Connects to **Socket.IO** server for real-time updates
- Wraps `<App />` with context providers:
  - `ReactKeycloakProvider` – Keycloak auth state
  - `SocketContext.Provider` – Socket.IO client instance
  - `UserContext.Provider` – Current user profile + admin flag
  - `AlertProvider` – Toast notifications (react-alert)

**Key Keycloak config:**
```javascript
keycloak = new Keycloak({
  url: process.env.REACT_APP_KEYCLOAK_URL,
  clientId: process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID,
  realm: process.env.REACT_APP_KEYCLOAK_REALM,
});

keycloakProviderInitConfig = {
  onLoad: 'check-sso',  // Silent check if user is logged in
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  checkLoginIframe: false,
}
```

**Socket.IO connection:**
```javascript
const socket = io(pythonBackendBaseURL, {});
socket.on(SOCKETIO_MESSAGES.CONNECT, () => {
  console.log('Successfully connected to Socket.IO server!');
});
```

---

### `src/App.js` – Main Router & Layout

**Responsibilities:**
- Defines **React Router v6** routes for all pages
- Wraps authenticated routes with `<ProtectedRoute>` component
- Fetches **albums** from Kheops on mount (when authenticated)
- Tracks **admin role** from Keycloak token (`resource_access` claim)
- Logs navigation history to backend

**Route Structure:**

| Path | Component | Protected | Description |
|---|---|---|---|
| `/` | `Home` | No | Landing page (login prompt if unauthenticated) |
| `/dashboard` | `Dashboard` | Yes | Album list + extraction status |
| `/features/:albumID/:tab` | `Features` | Yes | Feature extraction, labeling, training |
| `/features/:albumID/collection/:collectionID/:tab` | `Features` | Yes | Feature subset (collection) view |
| `/models/:albumID` | `ModelOverview` | Yes | Trained models for an album |
| `/study/:studyUID` | `Study` | Yes | DICOM study metadata viewer |
| `/profile` | `Profile` | Yes | User profile page |
| `/feature-presets` | `FeaturePresets` | Yes (admin) | Extraction config preset library |
| `/feature-presets/create` | `FeaturePresetCreate` | Yes (admin) | Create extraction config preset |

**Admin check:**
```javascript
const isAdmin =
  Object.keys(keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS]).includes(
    process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
  ) &&
  keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS][
    process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
  ].roles.includes(KEYCLOAK_ADMIN_ROLE);
```

---

### `src/services/` – API Client Layer

#### `services/backend.js` – Backend REST API Client

**Key methods:**

| Method | Endpoint(s) | Purpose |
|---|---|---|
| `extractions(token, albumID)` | `GET /extractions` | List all feature extractions |
| `extraction(token, extractionID)` | `GET /extractions/:id` | Get single extraction |
| `extractionFeatureDetails(token, extractionID)` | `GET /extractions/:id/feature-details` | Fetch features as tabular + chart data (multipart) |
| `labelCategories(token, albumID)` | `GET /label-categories/:albumID` | Get outcome definitions for album |
| `saveLabels(token, labelCategoryID, labelMap, posLabel)` | `POST /labels/:id` | Save patient outcome labels |
| `models(token, albumID)` | `GET /models/:albumID` | Get trained ML models for album |
| `trainModel(token, ...)` | `POST /models/:albumID` | Trigger model training (returns `training-id`) |
| `collections(token, extractionID)` | `GET /feature-collections` | Get feature subsets (collections) |
| `deleteCollection(token, collectionID)` | `DELETE /feature-collections/:id` | Delete feature subset |
| `downloadFeaturesCSV(token, extractionID)` | `GET /extractions/:id/features` | Download features as CSV |
| `clinicalFeaturesDefinitions(...)` | `GET/POST/PATCH /clinical-features-definitions` | CRUD clinical feature schemas |
| `clinicalFeaturesValues(...)` | `POST /clinical-features` | Save clinical feature values |
| `listClinicalFeatureFiles` / `createClinicalFeatureFile` / `renameClinicalFeatureFile` / `deleteClinicalFeatureFile` | `GET/POST/PATCH/DELETE /clinical-features-files` | Per-album clinical CSV files (multi-file support) |

**All methods:**
- Accept `token` (Keycloak JWT) as first parameter
- Use helper `request()` which:
  - Adds `Authorization: Bearer <token>` header
  - Parses JSON response
  - Throws errors from `response.error` or `response.message`

#### `services/kheops.js` – Kheops API Client

**Key methods:**

| Method | Endpoint | Purpose |
|---|---|---|
| `albums(token)` | `GET /api/albums` | List all albums user has access to |
| `album(token, albumID)` | `GET /api/albums/:id` | Get single album metadata |
| `studies(token, albumID)` | `GET /api/studies?album=:id` | List studies in album |
| `study(token, studyUID)` | `GET /api/studies?StudyInstanceUID=:uid` | Get study by UID |
| `series(token, studyUID)` | `GET /api/studies/:uid/series` | Get series for a study |
| `studyMetadata(token, studyUID)` | `GET /api/studies/:uid/metadata` | Get DICOM metadata for study |

**Kheops uses the same token** as the backend (Keycloak JWT forwarded via Bearer header).

#### `services/common.js` – Shared HTTP Helpers

**Functions:**
- `request(url, { method, data, token, multipart })` – JSON request/response wrapper
- `rawRequest(url, { method, data, token, headers })` – Lower-level fetch wrapper
- `downloadFile(url, token, data)` – Downloads blob with filename from `Content-Disposition` header

---

### `src/context/` – React Context

| Context File | Provides | Usage |
|---|---|---|
| `SocketContext.js` | Socket.IO client instance | `const socket = useContext(SocketContext);` |
| `UserContext.js` | `{ user, isAdmin }` | `const { user, isAdmin } = useContext(UserContext);` |

**User object** (from Keycloak):
```javascript
{
  id: "uuid-string",           // Keycloak user ID
  username: "john.doe",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe"
}
```

---

### `src/config/constants.js` – Application Constants

**Feature Status:**
```javascript
export const FEATURE_STATUS = {
  NOT_COMPUTED: 'PENDING',
  IN_PROGRESS: 'PROGRESS',
  COMPLETE: 'SUCCESS',
  FAILURE: 'FAILURE',
};
```

**Model Types:**
```javascript
export const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival',
};
```

**Data Splitting Types:**
```javascript
export const DATA_SPLITTING_TYPES = {
  FULL_DATASET: 'fulldataset',       // Cross-validation only
  TRAIN_TEST_SPLIT: 'traintest',     // Train/test split + CV on train
};

export const TRAIN_TEST_SPLIT_TYPES = {
  AUTO: 'automatic',   // Backend decides split
  MANUAL: 'manual',    // User assigns patients
};
```

**Outcome Field Names:**
```javascript
export const OUTCOME_CLASSIFICATION = 'Outcome';
export const OUTCOME_SURVIVAL_EVENT = 'Event';
export const OUTCOME_SURVIVAL_TIME = 'Time';

export const CLASSIFICATION_OUTCOMES = [OUTCOME_CLASSIFICATION];
export const SURVIVAL_OUTCOMES = [OUTCOME_SURVIVAL_TIME, OUTCOME_SURVIVAL_EVENT];
```

**Socket.IO Event Names:**
```javascript
export const SOCKETIO_MESSAGES = {
  CONNECT: 'connect',
  EXTRACTION_STATUS: 'extraction-status',
  FEATURE_STATUS: 'feature-status',
  TRAINING_STATUS: 'training-status',
};
```

**Training Phases:**
```javascript
export const TRAINING_PHASES = {
  PENDING: 'pending',     // Waiting in Celery queue
  TRAINING: 'training',   // GridSearchCV in progress
  TESTING: 'testing',     // Evaluating on test set
};
```

**Clinical Feature Types:**
```javascript
export const CLINICAL_FEATURE_TYPES = {
  NUMBER: 'Number',
  CATEGORICAL: 'Categorical',
};

export const CLINICAL_FEATURE_ENCODING = {
  NONE: 'None',
  ONE_HOT_ENCODING: 'One-Hot Encoding',
  NORMALIZATION: 'Normalization',
  ORDERED_CATEGORIES: 'Ordered Categories',
};

export const CLINICAL_FEATURE_MISSING_VALUES = {
  DROP: 'Drop',
  MODE: 'Mode',
  MEDIAN: 'Median',
  MEAN: 'Mean',
  NONE: 'None',
};
```

**CV Settings:**
```javascript
export const CV_SPLITS = 5;  // Number of cross-validation folds
```

---

### `src/utils/` – Utility Functions

#### `utils/ProtectedRoute.js` – Route Guard

Wraps authenticated pages. If user not logged in, triggers Keycloak login redirect.

```javascript
export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAdmin } = useContext(UserContext);
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) return <div>Loading...</div>;

  if (!keycloak.authenticated) {
    keycloak.login({ redirectUri: window.location.origin + window.location.pathname });
    return <div>Redirecting to login...</div>;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
```

#### `utils/feature-naming.js` – Feature Name Parsing & Grouping

**Feature ID format:**
```
{modality}‑{roi}‑{featureName}
```
where `‑` is a **non-breaking hyphen** (`U+2011`, defined as `FEATURE_ID_SEPARATOR` in `Visualisation.js`).

**Key functions:**
- `groupFeatures(featureNames)` – Hierarchically groups features by modality, filter, category
- `convertFeatureName(featureName, modalities)` – Makes names human-readable (e.g., "firstorder" → "intensity/SUV" for PET)
- `getFeatureDescription(featureName)` – Fetches description from `FEATURE_DEFINITIONS`

**Regex patterns:**
```javascript
const FILTER_PATTERN = /(?<filter>.*?)-(?<parameters>.*?)_(?<category>.*)_(?<name>.*)/;
const PYRADIOMICS_PATTERN = /(?<image>)_(?<category>.*?)_(?<name>.*)/;
const RIESZ_PATTERN = /(?<category>.*?)_(?<name>.*)/;
const ZRAD_PATTERN = `zrad_(?<category>...)?_?(?<name>.*)`;
```

**Feature Prefixes (by backend):**
- **PyRadiomics:** `original`, `log`, `wavelet`, `gradient`, `square`, `squareroot`, `exponential`, `logarithm`
- **Riesz:** `tex`
- **ZRAD:** `zrad`

#### `utils/feature-utils.js` – Feature Manipulation

**Key functions:**
- `downloadFeatureSet(token, tasks)` – Assembles features from extraction tasks into CSV format and triggers download
- `trainModel(extractionID, collection, labelCategoryID, ...)` – Calls backend to start model training
- `assembleFeatures(extraction, studies, album)` – Transforms DB feature values into tabular format for UI
- `formatMetric(metric)` – Formats metric with confidence intervals (e.g., `0.850 (0.820 - 0.880)`)
- `getModelLabel(model, modelLabels)` – Resolves a model's display name (shared by the plot components)

#### `utils/clinical-feature-id.js` – Clinical Feature ID Convention

Clinical feature IDs are namespaced `<file_id>::<name>` so two uploaded CSVs can share a column name. Centralizes the convention so it lives in one place:
- `makeClinicalFeatureId(fileId, name)` – build `<file_id>::<name>`
- `clinicalFeatureIdPrefix(fileId)` – `<file_id>::` prefix (for matching a file's IDs)
- `CLINICAL_FEATURE_ID_SEPARATOR` – `'::'` (deliberately not the U+2011 radiomics separator)

#### `utils/feature-mapping.js` – Feature Metadata

Defines `FEATURE_DEFINITIONS` array with:
```javascript
{
  id: "firstorder_10Percentile",
  category: "Intensity",
  description: "The 10th percentile of the intensity distribution",
  // ...
}
```

Also defines `CATEGORY_DEFINITIONS` for grouping features by category.

#### `utils/multipart-parser.js` – Multipart Response Parser

Parses backend's multipart response from `/extractions/:id/feature-details`:
- **Part 1:** Tabular features (JSON array)
- **Part 2:** Chart-format features (JSON object)

#### `utils/ErrorBoundary.js` – React Error Boundary

Catches errors in component tree and displays fallback UI.

#### `utils/useExitPrompt.js` – Unsaved Changes Warning

Custom hook that shows browser confirmation when user tries to leave page with unsaved changes.

```javascript
const [, setShowExitPrompt] = useExitPrompt(false);
useEffect(() => setShowExitPrompt(hasPendingChanges), [hasPendingChanges]);
```

---

### `src/components/` – Reusable Components

#### Core Components

| Component | File | Purpose |
|---|---|---|
| `ModelsTable` | `ModelsTable.js` | Display trained models with metrics, expandable details |
| `FeatureTable` | `FeatureTable.js` | Display features in table with filtering/sorting (react-table) |
| `ClinicalFeatureTable` | `ClinicalFeatureTable.js` | Edit clinical features in table format |
| `FilterTree` | `FilterTree.js` | Hierarchical feature selection tree |
| `FeatureSelection` | `FeatureSelection.js` | Feature filtering by correlation + importance ranking |
| `ROCCurveComponent` | `ROCCurveComponent.js` | Plotly.js ROC curve visualization |
| `InteractivePredictionsPlot` | `InteractivePredictionsPlot.js` | Interactive scatter plot for model predictions |
| `UnifiedModelAnalysis` | `UnifiedModelAnalysis.js` | Model comparison UI (permutation test) |
| `TrainingQueue` | `TrainingQueue.js` | Progress bar for model training |
| `FeatureImportanceModal` | `FeatureImportanceModal.js` | Modal showing feature importances as bar chart |
| `ListValues` | `ListValues.js` | Modal displaying list of values (e.g., feature names, patient IDs) |
| `MyModal` | `MyModal.js` | Custom modal wrapper around reactstrap Modal |
| `AlertTemplate` | `AlertTemplate.js` | Custom toast notification template |
| `CollectionSelection` | `CollectionSelection.js` | Dropdown for selecting feature collections |
| `ConfigEditor` | `ConfigEditor.js` | Monaco editor for YAML extraction config |
| `ColorPickerPopover` | `ColorPickerPopover.js` | Popover color picker (react-color) |

#### Component Patterns

**Using react-table (v7):**
```javascript
const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
  { columns, data, initialState: { sortBy: [...] } },
  useSortBy
);
```

**Using Keycloak token:**
```javascript
const { keycloak } = useKeycloak();
// ...
await Backend.someMethod(keycloak.token, ...);
```

**Using Socket.IO:**
```javascript
const socket = useContext(SocketContext);

useEffect(() => {
  socket.on(SOCKETIO_MESSAGES.TRAINING_STATUS, handleTrainingStatus);
  return () => socket.off(SOCKETIO_MESSAGES.TRAINING_STATUS, handleTrainingStatus);
}, [socket, handleTrainingStatus]);
```

---

