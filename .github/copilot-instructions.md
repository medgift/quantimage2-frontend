# QuantImage v2 Frontend – Copilot Instructions

## Project Overview

QuantImage v2 is a **radiomics research platform** for medical imaging. The frontend is a **React single-page application** that allows clinicians to:
- Browse DICOM medical images (MRI, CT, PET/CT scans) from **Kheops** (PACS viewer)
- Extract radiomic features from those images
- Train and evaluate machine learning models for outcome prediction (classification or survival analysis)
- Visualize features through heatmaps and UMAP plots
- Compare trained models and analyze feature importance

This repository is the **frontend only**. It communicates with:
- **Backend API** (Python Flask + Celery) for feature extraction and ML model training
- **Kheops PACS** (DICOMweb API) for medical image metadata and albums
- **Keycloak** auth server for authentication via OpenID Connect (OIDC)
- **Socket.IO** server (via backend) for real-time progress updates

---

## Architecture: Services & Dependencies

### Frontend Service (This App)

**Development:**
- Docker container running `yarn start` (webpack dev server)
- Port 3000 exposed to host
- Source code mounted as volume for hot reload

**Production:**
- Built with `yarn build` → static files
- Served via nginx (see `Dockerfile.prod` and `react.conf`)
- Traefik reverse proxy for HTTPS (see `docker-compose.prod.yml`)

### External Services (Separate Repos/Containers)

| Service | Base URL Env Var | Role |
|---|---|---|
| **Backend API** | `REACT_APP_PYTHON_BACKEND_URL` | REST API + Socket.IO server |
| **Kheops PACS** | `REACT_APP_KHEOPS_URL` | DICOM metadata, albums, studies (DICOMweb) |
| **Keycloak** | `REACT_APP_KEYCLOAK_URL` | OpenID Connect auth server (JWT tokens) |

**Environment Variables:**

| Variable | Example | Description |
|---|---|---|
| `REACT_APP_PYTHON_BACKEND_URL` | `http://localhost:5001` | Backend Flask API base URL |
| `REACT_APP_KHEOPS_URL` | `http://localhost` | Kheops PACS base URL |
| `REACT_APP_KEYCLOAK_URL` | `http://localhost:8081/auth` | Keycloak auth server URL |
| `REACT_APP_KEYCLOAK_REALM` | `QuantImage-v2` | Keycloak realm name |
| `REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID` | `quantimage2-frontend` | Keycloak client ID for this app |

All `REACT_APP_*` variables are injected at **build time** by Create React App and accessible via `process.env.REACT_APP_*`.

---

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

## Page Components (Top-Level Routes)

### `Dashboard.js` – Album List & Extraction Status

**Responsibilities:**
- Displays list of albums from Kheops
- Shows feature extraction status per album (pending/progress/complete)
- Shows number of trained models per album
- Provides "Extract Features" / "Re-Extract" / "Explore Features" buttons
- Subscribes to `SOCKETIO_MESSAGES.EXTRACTION_STATUS` for real-time updates
- Allows canceling ongoing extractions

**Key state:**
```javascript
const [albums, setAlbums] = useState([]);         // From Kheops
const [extractions, setExtractions] = useState(null); // From backend
const [models, setModels] = useState(null);       // From backend
```

**Socket.IO subscription:**
```javascript
socket.on(SOCKETIO_MESSAGES.EXTRACTION_STATUS, (status) => {
  updateExtraction(status.feature_extraction_id, status);
});
```

---

### `Features.js` – Main Feature Workflow Hub

**Tabs (via URL param `:tab`):**
- `overview` – Feature table (radiomic features)
- `clinical` – Clinical features editor
- `visualisation` – Heatmap / UMAP visualization
- `outcomes` – Outcome labeling (classification or survival)
- `datasplitting` – Train/test split configuration
- `train` – Model training interface
- `models` – Trained model list for this extraction

**URL patterns:**
- `/features/:albumID/:tab` – Album-level features (latest extraction)
- `/features/:albumID/collection/:collectionID/:tab` – Feature collection (subset)

**Key state:**
```javascript
const [album, setAlbum] = useState(null);
const [featureExtraction, setFeatureExtraction] = useState(null);
const [featuresTabular, setFeaturesTabular] = useState(null);  // Table view
const [featuresChart, setFeaturesChart] = useState(null);      // Chart view
const [collections, setCollections] = useState(null);          // Feature subsets
const [labelCategories, setLabelCategories] = useState(null);  // Outcome definitions
const [selectedLabelCategory, setSelectedLabelCategory] = useState(null);
const [models, setModels] = useState([]);
const [patients, setPatients] = useState(null);  // { training: [...], test: [...] }
const [clinicalFeaturesDefinitions, setClinicalFeaturesDefinitions] = useState(null);
const [clinicalFeaturesValues, setClinicalFeaturesValues] = useState(null);
```

**Data flow:**
1. On mount: Fetch album, extraction, features, label categories, collections, models, clinical features
2. When user saves labels → updates `SOCKETIO_MESSAGES.FEATURE_STATUS`
3. When user trains model → calls `trainModel()` → subscribes to `SOCKETIO_MESSAGES.TRAINING_STATUS`
4. When user saves collection → creates/updates feature subset

**Exit prompt:** Uses `useExitPrompt` hook to warn user when navigating away with unsaved changes.

---

### `Train.js` – Model Training Interface

**Responsibilities:**
- Displays list of algorithms (Logistic Regression, SVM, Random Forest for classification; CoxPH, CoxNet, IPC for survival)
- Shows algorithm details (hyperparameters, references)
- Displays training progress bar (via Socket.IO)
- Shows element count per class/event
- Lists trained models (via parent `Features.js` state)

**Training flow:**
1. User clicks "Train Model" button
2. Calls `trainModel()` from `utils/feature-utils.js`
3. Backend returns `{ training-id, n-steps }`
4. Component subscribes to Socket.IO `SOCKETIO_MESSAGES.TRAINING_STATUS`
5. Progress updates displayed in real-time
6. On completion, new model added to list

**Training phases:**
- `PENDING` – Waiting in Celery queue
- `TRAINING` – GridSearchCV in progress (incremental updates per fold)
- `TESTING` – Computing test metrics (bootstrap iterations)

---

### `Visualisation.js` – Feature Heatmap & UMAP

**Modes:**
- **Heatmap** – Highcharts heatmap with clustering, correlation filtering, feature selection
- **UMAP** – Dimensionality reduction plot (via `umap-js` library)

**Key features:**
- Hierarchical feature tree (by modality, ROI, category)
- Correlation-based filtering (uses Web Worker `public/workers/filter-features.js`)
- Feature importance ranking
- Patient hovering/selection
- Save selected features as **collection**

**Web Worker usage:**
```javascript
filterFeaturesWorker.postMessage({ features, leafItems, selected, corrThreshold });
filterFeaturesWorker.onmessage = (event) => {
  const featuresToDrop = event.data;
  // Update UI...
};
```

**Feature ID separator:**
```javascript
export const FEATURE_ID_SEPARATOR = '‑';  // Non-breaking hyphen (U+2011)
```

**CRITICAL:** Never replace this with a regular hyphen `-`. ROI names can contain regular hyphens.

---

### `ModelOverview.js` – Trained Model List

**Responsibilities:**
- Lists all trained models for an album
- Groups models by outcome (label category)
- Displays metrics (AUC, accuracy, sensitivity, specificity, precision)
- Expandable rows with:
  - ROC curves
  - Feature importances
  - Confusion matrix
  - Patient IDs (training/test)
- Model comparison (permutation test)
- Download test metrics, scores, importances

**Key dependencies:**
- `ModelsTable` component (table rendering)
- `UnifiedModelAnalysis` component (comparison UI)
- `ROCCurveComponent` (Plotly ROC curve)
- `FeatureImportanceModal` (bar chart)

---

### `Outcomes.js` – Label Editor

**Responsibilities:**
- Create/edit/delete label categories (outcome definitions)
- Select outcome type: Classification or Survival
- Edit patient labels in table format (react-table with inline editing)
- Upload labels from CSV
- Save labels to backend

**Label format (Classification):**
```javascript
{
  patient_id: "Patient_001",
  label_content: { "Outcome": "1" }  // Binary classification
}
```

**Label format (Survival):**
```javascript
{
  patient_id: "Patient_001",
  label_content: {
    "Time": "36.5",   // Survival time (months)
    "Event": "1"      // Event occurred (1) or censored (0)
  }
}
```

---

### `ClinicalFeatures.js` – Clinical Feature Editor

**Workflow:**
1. Upload CSV with clinical features (columns = feature names, rows = patients)
2. Backend guesses feature types (Number vs Categorical)
3. User edits feature definitions (type, encoding, missing value strategy)
4. Save definitions + values to backend
5. Clinical features are included in model training alongside radiomic features

**Clinical Feature Definition Schema:**
```javascript
{
  name: "Age",
  feat_type: "Number",
  encoding: "Normalization",
  missing_values: "Mean",
  album_id: "album-123"
}
```

---

### `DataSplitting.js` – Train/Test Split Configuration

**Modes:**
- **Full Dataset** – Cross-validation only (no held-out test set)
- **Train/Test Split** – User-defined or auto train/test split

**Split types (when Train/Test):**
- **Automatic** – Backend splits by stratified sampling (80/20 default)
- **Manual** – User drags patients between Training and Test lists

**State managed in parent `Features.js` as `patients = { training: [...], test: [...] }`**

---

### `Study.js` – DICOM Study Viewer

**Responsibilities:**
- Displays DICOM metadata for a single study (Patient Name, Study Date, Modality, Series, etc.)
- Uses `DicomFields` mappings (DICOM tag → field name)

---

### `Profile.js` – User Profile

**Displays:**
- Keycloak user info (name, email, username)
- User ID (UUID)

---

### `FeaturePresets.js` & `FeaturePresetCreate.js` – Extraction Config Presets (Admin Only)

**FeaturePresets:**
- Lists available extraction config YAML presets
- Download/delete presets

**FeaturePresetCreate:**
- Monaco YAML editor with syntax highlighting
- Upload new extraction config preset

**Admin-only routes** (checked via `ProtectedRoute adminOnly={true}`).

---

## Development Patterns & Conventions

### Adding a New Page

1. Create component file in `src/` (e.g., `MyNewPage.js`)
2. Add route in `src/App.js`:
   ```javascript
   <Route
     path="/my-new-page"
     element={
       <ProtectedRoute>
         <MyNewPage />
       </ProtectedRoute>
     }
   />
   ```
3. Use `useKeycloak()` hook to access token:
   ```javascript
   const { keycloak } = useKeycloak();
   const data = await Backend.someMethod(keycloak.token, ...);
   ```

### Adding a New Backend API Method

1. Add method to `src/services/backend.js`:
   ```javascript
   async myNewMethod(token, param) {
     const url = `${endpoints.myEndpoint}/${param}`;
     return await request(url, { token, method: 'GET' });
   }
   ```
2. Define endpoint at top of file:
   ```javascript
   const endpoints = {
     // ...
     myEndpoint: `${baseEndpoint}/my-endpoint`,
   };
   ```

### Adding a Reusable Component

1. Create file in `src/components/` (e.g., `MyComponent.js`)
2. Export as default:
   ```javascript
   export default function MyComponent({ prop1, prop2 }) { ... }
   ```
3. Import in parent component:
   ```javascript
   import MyComponent from './components/MyComponent';
   ```

### Using Socket.IO for Real-Time Updates

**Pattern:**
```javascript
import SocketContext from './context/SocketContext';
import { SOCKETIO_MESSAGES } from './config/constants';

function MyComponent() {
  const socket = useContext(SocketContext);

  const handleUpdate = useCallback((data) => {
    console.log('Received update:', data);
    // Update state...
  }, []);

  useEffect(() => {
    socket.on(SOCKETIO_MESSAGES.MY_EVENT, handleUpdate);
    return () => socket.off(SOCKETIO_MESSAGES.MY_EVENT, handleUpdate);
  }, [socket, handleUpdate]);
}
```

**Available events:**
- `SOCKETIO_MESSAGES.EXTRACTION_STATUS` – Feature extraction progress
- `SOCKETIO_MESSAGES.FEATURE_STATUS` – Individual feature computation status
- `SOCKETIO_MESSAGES.TRAINING_STATUS` – Model training progress

### Displaying Metrics with Confidence Intervals

Use `formatMetric()` from `utils/feature-utils.js`:

```javascript
import { formatMetric } from '../utils/feature-utils';

const metric = { mean: 0.85, inf_value: 0.82, sup_value: 0.88 };
const formatted = formatMetric(metric);  // "0.850 (0.820 - 0.880)"
```

### Creating Tables with react-table

**Pattern (v7 API):**
```javascript
import { useTable, useSortBy } from 'react-table';

function MyTable({ data }) {
  const columns = useMemo(() => [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Value', accessor: 'value' },
  ], []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  return (
    <Table {...getTableProps()}>
      <thead>
        {headerGroups.map(hg => (
          <tr {...hg.getHeaderGroupProps()}>
            {hg.headers.map(col => (
              <th {...col.getHeaderProps(col.getSortByToggleProps())}>
                {col.render('Header')}
                {col.isSorted ? (col.isSortedDesc ? ' 🔽' : ' 🔼') : ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
```

### Using Web Workers

**Example (feature filtering):**
```javascript
// Start worker
if (window.Worker) {
  const worker = new Worker('/workers/my-worker.js');
  
  worker.postMessage({ data: myData });
  
  worker.onmessage = (event) => {
    const result = event.data;
    // Process result...
  };
}
```

**Worker files** live in `public/workers/` (not bundled by webpack).

### Downloading Files

**Pattern:**
```javascript
import { downloadFile } from '../services/common';
import { saveAs } from 'file-saver';

const { filename, content } = await downloadFile(url, keycloak.token);
saveAs(content, filename);
```

Or use `fileDownload` from `js-file-download`:
```javascript
import fileDownload from 'js-file-download';
fileDownload(content, filename);
```

---

## Authentication & Authorization Flow

```
Frontend (React)
  │
  ├─ User not authenticated → Keycloak.login() → Keycloak login page
  │                                              │
  │                                              ▼
  │                          User logs in → Keycloak redirects back with auth code
  │                                              │
  │                                              ▼
  ├─ Keycloak exchanges code for JWT token (handled by @react-keycloak/web)
  │
  ├─ Token stored in Keycloak instance (keycloak.token)
  │
  ├─ All API requests include `Authorization: Bearer <token>`
  │     │
  │     ├─ Backend API: Validates JWT, extracts user ID from `sub` claim
  │     └─ Kheops API: Validates JWT, returns user's albums/studies
  │
  └─ Token auto-refreshed by @react-keycloak/web (before expiry)
```

**Admin role check:**
```javascript
keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS]
  [process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID]
  .roles.includes(KEYCLOAK_ADMIN_ROLE)
```

---

## Feature Extraction Flow

```
User clicks "Extract Features" in Dashboard
  │
  ├─ Opens FeaturesList modal (src/components/FeaturesList.js)
  │   User selects:
  │     - Studies
  │     - Modalities (CT, PET, MR)
  │     - ROIs
  │     - Extraction config preset (YAML)
  │
  ├─ User submits → POST /extractions
  │                     Backend:
  │                       - Creates FeatureExtraction + FeatureExtractionTask rows
  │                       - Dispatches Celery tasks (chord)
  │
  ├─ Socket.IO events: extraction-status (overall), feature-status (per-study)
  │     Frontend Dashboard subscribes to these events
  │     Updates extraction status in real-time (progress bar, completed/failed counts)
  │
  ├─ On completion:
  │     Backend emits final extraction-status with `ready: true`
  │     Frontend shows "Explore Features" button
  │
  └─ User clicks "Explore Features" → Navigate to /features/:albumID/overview
       Fetches feature data via GET /extractions/:id/feature-details
       Displays features in table (FeatureTable component)
```

---

## Model Training Flow

```
User navigates to /features/:albumID/train tab
  │
  ├─ Train.js component displays algorithm options (LR, SVM, RF, CoxPH, etc.)
  │
  ├─ User clicks "Train Model" button
  │     Calls trainModel() from utils/feature-utils.js
  │       POST /models/:albumID with:
  │         - extractionID
  │         - collectionID (if feature subset)
  │         - labelCategoryID
  │         - labels (tabular format)
  │         - dataSplittingType (fulldataset | traintest)
  │         - trainTestSplitType (automatic | manual)
  │         - trainingPatients, testPatients
  │         - usedModalities, usedROIs
  │
  │     Backend:
  │       - Fetches features from DB
  │       - Encodes labels
  │       - Splits train/test (if applicable)
  │       - Dispatches Celery task: quantimage2tasks.train
  │
  │     Backend returns: { training-id, n-steps }
  │
  ├─ Frontend subscribes to Socket.IO training-status event
  │     Updates displayed as { phase, current, total }
  │       phase: 'pending' | 'training' | 'testing'
  │
  │     Training phase: GridSearchCV iterates through folds
  │       Backend emits update per fold completion
  │
  │     Testing phase: Bootstrap iterations for test metrics
  │       Backend emits progress updates
  │
  ├─ On completion:
  │     Backend emits training-status with `complete: true` + model object
  │     Frontend adds model to list
  │     User navigates to /features/:albumID/models tab to view results
  │
  └─ ModelOverview displays trained models with metrics, ROC curves, feature importances
```

---

## Key Libraries

| Library | Where Used | Purpose |
|---|---|---|
| **React 18** | Everywhere | UI framework |
| **React Router v6** | `App.js` | Client-side routing |
| **@react-keycloak/web** | `AppWrapper.js` | Keycloak OIDC integration |
| **keycloak-js** | `AppWrapper.js` | Keycloak JavaScript client |
| **Socket.IO Client** | `AppWrapper.js` | WebSocket connection for real-time updates |
| **react-table** | Components | Table rendering with sorting/filtering |
| **reactstrap** | Everywhere | Bootstrap 4 React components |
| **Highcharts** | `Visualisation.js`, `ModelsTable.js` | Heatmaps, charts |
| **Plotly.js** | `ROCCurveComponent.js` | ROC curves, interactive plots |
| **react-alert** | `AppWrapper.js` | Toast notifications |
| **Monaco Editor** | `ConfigEditor.js` | YAML/code editor |
| **umap-js** | `UMAPAnalysis.js` | UMAP dimensionality reduction |
| **Formik** | Forms | Form state management |
| **Yup** | Forms | Form validation |
| **lodash** | Everywhere | Utility functions |
| **moment / luxon** | Date formatting | Date/time utilities |
| **papaparse** | CSV parsing | Client-side CSV parsing |
| **json2csv** | CSV export | Convert JSON to CSV |
| **file-saver** | Downloads | Trigger file downloads |

---

## Docker & Deployment

### Development

**Start:**
```bash
docker-compose up
```

**Dockerfile** mounts source code as volume → hot reload enabled.

**Port:** `localhost:3000`

### Production Build

**Dockerfile.prod:**
1. `yarn build` → generates optimized static files in `/build`
2. Copies build to nginx container
3. Serves via nginx on port 80

**nginx config:** `react.conf` (handles client-side routing)

**Traefik labels** in `docker-compose.prod.yml` for HTTPS termination.

---

## Important Notes

### Non-Breaking Hyphen in Feature IDs

**CRITICAL:** The `FEATURE_ID_SEPARATOR` is a **non-breaking hyphen** (`‑`, U+2011), NOT a regular hyphen (`-`).

```javascript
export const FEATURE_ID_SEPARATOR = '‑';  // U+2011
```

**Why:** ROI names can contain regular hyphens (e.g., `GTV-T`). Using a distinct separator prevents ambiguity when parsing feature IDs.

**Never replace this separator with a regular hyphen.**

**When constructing or parsing feature IDs:**
```javascript
import { FEATURE_ID_SEPARATOR } from './Visualisation';

const featureID = `${modality}${FEATURE_ID_SEPARATOR}${roi}${FEATURE_ID_SEPARATOR}${featureName}`;

const [modality, roi, featureName] = featureID.split(FEATURE_ID_SEPARATOR);
```

---

### Keycloak Token Expiry

**Token refresh** is handled automatically by `@react-keycloak/web`.

**Manual refresh:**
```javascript
await keycloak.updateToken(30);  // Refresh if expires within 30 seconds
```

---

### CORS

**Backend must allow frontend origin** via `CORS_ALLOWED_ORIGINS` environment variable.

**Development:** `http://localhost:3000`

**Production:** Your frontend domain (e.g., `https://quantimage.example.com`)

---

### Web Workers

**Files in `public/workers/` are NOT processed by webpack.** They are served as static files.

**Usage:**
- `filter-features.js` – Computes correlation matrix and filters features
- `spearson.js` – Spearman correlation calculation (imported by filter-features.js)

**Pattern:**
```javascript
const worker = new Worker('/workers/filter-features.js');
worker.postMessage(data);
worker.onmessage = (e) => { ... };
```

---

### State Management

**No Redux or global state library.** State is managed via:
- **React Context** for global data (User, Socket.IO)
- **useState** for component-local state
- **Props** for parent-child communication
- **URL params** for navigation state (album ID, collection ID, tab)

---

### Feature Collections (Subsets)

**What:** A subset of features from an extraction, used for training models with fewer features.

**How:**
1. User selects features in `Visualisation.js` (heatmap or tree)
2. Clicks "Save as Collection"
3. Backend creates `FeatureCollection` row with `feature_ids` (JSON array of feature ID strings)
4. Frontend navigates to `/features/:albumID/collection/:collectionID/:tab`
5. All subsequent operations (labeling, training) use only the selected features

**Collection object:**
```javascript
{
  collection: {
    id: 123,
    name: "Top 50 Features",
    feature_ids: [
      "CT‑GTV_T‑original_shape_Elongation",
      "CT‑GTV_T‑original_firstorder_Mean",
      // ...
    ],
    training_patients: [...],  // Can override extraction-level split
    test_patients: [...]
  }
}
```

---

### Clinical Features

**Stored separately** from radiomic features. Have their own DB tables (`ClinicalFeatureDefinition`, `ClinicalFeatureValue`).

**Workflow:**
1. Upload CSV (columns = feature names, rows = patient IDs)
2. Backend guesses types (Number vs Categorical)
3. User confirms/edits feature definitions
4. Save to backend
5. When training, backend merges clinical + radiomic features into single matrix

**Clinical Feature IDs do NOT use `FEATURE_ID_SEPARATOR`.** They are plain strings (e.g., `"Age"`, `"Gender"`).

---

### Exit Prompts for Unsaved Changes

**Pattern:**
```javascript
import useExitPrompt from './utils/useExitPrompt';

function MyComponent() {
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [, setShowExitPrompt] = useExitPrompt(false);

  useEffect(() => {
    setShowExitPrompt(hasPendingChanges);
  }, [hasPendingChanges, setShowExitPrompt]);

  useEffect(() => {
    return () => setShowExitPrompt(false);  // Cleanup on unmount
  }, [setShowExitPrompt]);
}
```

**Browser will show "Leave site?" confirmation if user tries to navigate away or close tab.**

---

### Model Columns & Metrics

**Classification Metrics:**
- AUC (Area Under ROC Curve)
- Accuracy
- Sensitivity (Recall)
- Specificity
- Precision

**Survival Metrics:**
- C-index (Concordance Index)

**Metrics format (bootstrapped):**
```javascript
{
  mean: 0.85,
  inf_value: 0.82,  // Lower bound of 95% CI
  sup_value: 0.88   // Upper bound of 95% CI
}
```

**Display format:** `0.850 (0.820 - 0.880)` via `formatMetric()`

---

### Algorithm Methods

**Classification (from `Train.js` and backend):**
- `logistic_regression` – Logistic Regression (lbfgs or saga solver)
- `svm` – Support Vector Machine (RBF kernel)
- `random_forest` – Random Forest Classifier

**Survival:**
- `cox` – Cox Proportional Hazards
- `cox_elastic` – CoxNet with Elastic Net regularization
- `ipc` – Inverse Probability Censoring with Ridge

---

### Config Overrides (webpack)

**`config-overrides.js`:**
- Adds Monaco Editor webpack plugin
- Polyfills Node.js modules for browser (webpack 5 requirement):
  - `stream`, `buffer`, `crypto`, `path`, `http`, `https`, `url`, `os`, `util`
- Provides global `Buffer` and `process`
- Ignores Monaco TypeScript worker warnings

**Used by:** `react-app-rewired` (see `package.json` scripts)

---

### DICOM Field Mappings

**`src/dicom/fields.js`:**

Defines constants for DICOM tag names and their hex codes:
```javascript
export default {
  STUDY_UID: '0020000D',
  PATIENT_NAME: '00100010',
  VALUE: 'Value',
  ALPHABETIC: 'Alphabetic',
  // ...
}
```

**Usage:**
```javascript
import DicomFields from './dicom/fields';

const patientName = study[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][DicomFields.ALPHABETIC];
```

---

## Environment Setup

**Required environment variables** (create `.env.local` file in project root):

```env
REACT_APP_PYTHON_BACKEND_URL=http://localhost:5001
REACT_APP_KHEOPS_URL=http://localhost
REACT_APP_KEYCLOAK_URL=http://localhost:8081/auth
REACT_APP_KEYCLOAK_REALM=QuantImage-v2
REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID=quantimage2-frontend
```

**Note:** Create React App only loads env vars starting with `REACT_APP_`.

---

## Testing

**Test files:** `*.test.js` (e.g., `App.test.js`, `Home.test.js`)

**Run tests:**
```bash
yarn test
```

**Test utilities:** `src/test-utils.js` (custom render function with providers)

**Libraries:**
- `@testing-library/react` – Component testing
- `jest-dom` – Custom matchers

---

## Useful Commands

**Start development server:**
```bash
yarn start
```

**Build for production:**
```bash
yarn build
```

**Run tests:**
```bash
yarn test
```

**Start with Docker:**
```bash
docker-compose up
```

**Build production Docker image:**
```bash
docker build -f Dockerfile.prod -t quantimage2-frontend:prod .
```

---

## Troubleshooting

### Token expired errors

**Solution:** `@react-keycloak/web` should auto-refresh. If not, manually:
```javascript
await keycloak.updateToken(30);
```

### Socket.IO not connecting

**Check:**
1. `REACT_APP_PYTHON_BACKEND_URL` is correct
2. Backend Socket.IO server is running
3. CORS is configured on backend (`CORS_ALLOWED_ORIGINS`)

### Features not displaying

**Check:**
1. Extraction is complete (`extraction.status.ready === true`)
2. `/extractions/:id/feature-details` endpoint returns data
3. Check browser console for parsing errors

### DICOM field not found

**Check:**
1. Field exists in `src/dicom/fields.js`
2. Use nested access pattern: `study[DicomFields.FIELD_NAME][DicomFields.VALUE][0]`

### Web Worker errors

**Check:**
1. Worker file exists in `public/workers/`
2. Worker path starts with `/workers/` (absolute from public root)
3. Worker file has no import statements (use `importScripts()` instead)

---

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

## Security & Medical Data Handling

### Token Flow

```
User → Keycloak login page → JWT issued
  → @react-keycloak/web stores token in memory (NOT localStorage)
  → All API calls include Authorization: Bearer <token>
  → Backend validates JWT via KeycloakOpenID.decode_token()
  → Kheops validates same JWT (shared Keycloak realm)
```

### Rules

- **Never display or log** patient identifiers, DICOM UIDs, or JWT tokens in production UI.
- Use `console.debug()` (not `console.log()`) for development-only diagnostics that include patient data.
- Patient IDs in the UI are derived from DICOM `PatientName` — display only when necessary for labeling/identification.
- **CORS**: Backend must whitelist the frontend origin via `CORS_ALLOWED_ORIGINS`.
- No sensitive data is stored client-side. All medical data remains in Kheops (images) or the backend DB (features, labels, models).
- Feature extraction YAML configs may contain PHI-adjacent information (ROI names) — treat them as sensitive.

---

## Docker & Container Networking

### Development Setup

```
Frontend (this repo)                 Backend (separate repo)
  docker-compose.yml                   docker-compose.yml
    └─ web (node:16, port 3000)          ├─ backend (Flask, port 5000)
                                         ├─ celery_extraction
                                         ├─ celery_training
                                         ├─ db (MySQL)
                                         ├─ redis
                                         └─ redis-socket

External services:
  ├─ Kheops (PACS, port 80)
  └─ Keycloak (auth, port 8081)
```

### Connectivity

| From | To | Via | Notes |
|---|---|---|---|
| Browser | Frontend | `http://localhost:3000` | Webpack dev server |
| Browser | Backend API | `REACT_APP_PYTHON_BACKEND_URL` | REST + Socket.IO |
| Browser | Kheops | `REACT_APP_KHEOPS_URL` | DICOMweb API (albums, studies) |
| Browser | Keycloak | `REACT_APP_KEYCLOAK_URL` | OIDC login/token refresh |

**All external calls go from the browser** (not server-side) — the frontend is a pure SPA. This means:
- All service URLs must be **browser-accessible** (not Docker-internal hostnames like `db` or `redis`).
- CORS must be configured on backend and Kheops for the frontend's origin.
- Environment variables are baked in at **build time** (`REACT_APP_*` prefix required).

### Production Deployment

- `Dockerfile.prod` builds static files with `yarn build`, then serves via nginx.
- `react.conf` configures nginx for client-side routing (all paths → `index.html`).
- `docker-compose.prod.yml` adds Traefik labels for HTTPS reverse proxy.
- Environment variables must be set at build time (not runtime) since they're compiled into the JS bundle.

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

## Deployment Commands

### Development

```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn start
```

### Production

```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Workflow Prompts

The following reusable prompts are available in `.github/prompts/` for common workflows:

| Prompt | Purpose |
|---|---|
| `verify-app` | End-to-end verification after any change (build, lint, containers, connectivity) |
| `build-validator` | Validate Docker builds, compose configs, env vars |
| `code-architect` | Review code for architecture consistency (component patterns, service layer, auth) |
| `code-simplifier` | Post-implementation cleanup (dead code, naming, hooks optimization) |
| `oncall-guide` | Production troubleshooting reference (Docker, nginx, env vars, common issues) |
