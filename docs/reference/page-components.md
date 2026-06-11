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

**Multiple files per album:** each upload creates a `ClinicalFeatureFile` and **appends** (existing files are kept). Files can be renamed/deleted individually; feature IDs are namespaced `<file_id>::<name>` (see `utils/clinical-feature-id.js`).

**Clinical Feature Definition Schema:**
```javascript
{
  id: 42,
  name: "Age",
  feat_type: "Number",
  encoding: "Normalization",
  missing_values: "Mean",
  album_id: "album-123",
  clinical_feature_file_id: 3   // FK to the ClinicalFeatureFile this column belongs to
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

