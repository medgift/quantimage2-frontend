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

**Stored separately** from radiomic features. Have their own DB tables (`ClinicalFeatureFile`, `ClinicalFeatureDefinition`, `ClinicalFeatureValue`).

**Multiple CSV files per album.** Each upload creates a new `ClinicalFeatureFile`; uploading **appends** (it does not delete existing files). Files can be renamed/deleted individually. The backend enforces unique file names within an album (suffixing ` (n)` on collision, 409 on rename collision).

**Workflow:**
1. Upload CSV (columns = feature names, rows = patient IDs)
2. Backend guesses types (Number vs Categorical)
3. User confirms/edits feature definitions
4. Save to backend (definitions + values are scoped to the new file)
5. When training, backend merges clinical + radiomic features into single matrix

**Clinical Feature IDs are namespaced `<file_id>::<name>`** (e.g., `"3::Age"`) so two files can share a column name. They still do **not** contain `FEATURE_ID_SEPARATOR` (U+2011), which is how they're told apart from radiomics IDs. Build/parse them via `utils/clinical-feature-id.js` (`makeClinicalFeatureId`, `clinicalFeatureIdPrefix`) — never hand-concatenate `::`. Legacy collections stored bare names (e.g. `"Age"`); the backend resolves those to the definition with the lowest `clinical_feature_file_id` (the migration-backfilled "Legacy" file), and `Visualisation.getNodeIDsFromFeatureIDs` mirrors that fallback.

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

