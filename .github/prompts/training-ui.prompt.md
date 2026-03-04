# Training UI & Model Management

Guide for adding or modifying ML model training UI, progress display, metrics visualization, or model comparison features.

## Requirements

- **What to build**: [DESCRIBE THE TRAINING/MODEL UI CHANGE]
- **Affected area**: [train tab | model overview | model comparison | metrics display]
- **New algorithm?**: [yes / no — if yes, coordinate with backend `new-ml-method` prompt]

## Architecture Overview

```
src/Train.js — Training configuration & launch
  ├── Algorithm selection (Classification or Survival)
  ├── Data splitting (full dataset, auto split, manual split)
  ├── Feature collection selection
  └── Launch button → Backend.trainModel()

src/ModelOverview.js — Results after training
  ├── ModelDetails.js — Single model metrics display
  │     ├── MetricsTable.js — AUC, accuracy, C-index, etc.
  │     ├── ROCCurve.js — Highcharts ROC plot
  │     ├── ConfusionMatrix.js — Plotly confusion matrix
  │     ├── SurvivalCurve.js — Kaplan-Meier plot
  │     ├── FeatureImportanceChart.js — Permutation importance
  │     └── BootstrapCI.js — Confidence intervals
  ├── ModelComparison.js — Side-by-side comparison
  └── ModelCard.js — Summary card per model
```

## Key Constants

```javascript
// From src/config/constants.js:
export const MODEL_TYPES = { CLASSIFICATION: 'Classification', SURVIVAL: 'Survival' };

export const DATA_SPLITTING_TYPES = {
  FULL_DATASET: 'full-dataset',
  TRAIN_TEST_SPLIT: 'train-test-split',
};

export const TRAIN_TEST_SPLIT_TYPES = { AUTO: 'auto', MANUAL: 'manual' };

export const CLASSIFICATION_METHODS = {
  LOGISTIC_REGRESSION_LBFGS: 'Logistic Regression (lbfgs)',
  LOGISTIC_REGRESSION_SAGA: 'Logistic Regression (saga)',
  SVM: 'SVM',
  RANDOM_FOREST: 'Random Forest',
};

export const SURVIVAL_METHODS = {
  COXPH: 'CoxPH',
  COXNET: 'CoxNet Elastic Net',
  IPC_RIDGE: 'IPC Ridge',
};
```

## Checklist

### Training Launch Flow

1. User configures training on the `Train` tab (algorithm, split type, collection).
2. `Train.js` calls `Backend.trainModel(token, albumID, params)`:
   - `params`: `{ extractionID, collectionID, labelCategoryID, modelType, algorithm, dataSplittingType, trainTestSplitType, testPatientIDs?, ... }`
3. Backend returns immediately with `{ task_id }`. Actual training is async (Celery).
4. Frontend subscribes to Socket.IO `training-status` events for real-time progress.

### Socket.IO Training Events

5. Subscribe in the component that shows progress:

```jsx
import { SocketContext } from '../context/SocketContext';

function TrainingProgress({ trainingID }) {
  const socket = useContext(SocketContext);
  const [progress, setProgress] = useState({ status: 'pending', percent: 0 });

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data) => {
      if (data.training_id === trainingID) {
        setProgress(data);
      }
    };

    socket.on('training-status', handleStatus);
    return () => socket.off('training-status', handleStatus);
  }, [socket, trainingID]);

  // Render progress bar, status text, etc.
}
```

6. Training status event payload:
```javascript
{
  training_id: "...",
  status: "started" | "training" | "testing" | "complete" | "error",
  progress: 0.0 - 1.0,
  current_fold: 3,
  total_folds: 50,  // CV_SPLITS * CV_REPEATS (5 * 10)
  message: "..."
}
```

### Metrics Display

7. Use `formatMetric(value, metricName)` from utils for consistent decimal formatting.
8. Classification metrics: AUC, Accuracy, Sensitivity, Specificity, F1, PPV, NPV.
9. Survival metrics: C-index.
10. All metrics include confidence intervals from bootstrap (lower, mean, upper).
11. Display pattern:
```jsx
<span>{formatMetric(metric.mean)} [{formatMetric(metric.lower)} – {formatMetric(metric.upper)}]</span>
```

### Adding a New Algorithm (Frontend Side)

12. Add the algorithm to the appropriate object in `src/config/constants.js` (`CLASSIFICATION_METHODS` or `SURVIVAL_METHODS`).
13. The Train.js component dynamically renders algorithm options from these constants.
14. Coordinate with backend: the algorithm string must match exactly what the backend expects.
15. Some algorithms have special parameters — add UI controls in Train.js if needed.

### Model Comparison

16. `ModelComparison.js` displays side-by-side metrics for multiple models.
17. Uses DeLong test (classification) or permutation test (survival) for statistical comparison.
18. Chart data comes from `Backend.getChartData(token, modelIDs)`.

### Data Splitting UI

19. `DataSplitting.js` manages train/test patient assignment.
20. Auto split: backend randomly splits patients (stratified by label).
21. Manual split: user drags patients between train/test groups.
22. Split is saved per extraction: `Backend.saveDataSplit(token, extractionID, testPatientIDs)`.
23. Patient list comes from Kheops album metadata.

### Feature Importance Display

24. After training, models store per-feature permutation importance.
25. `FeatureImportanceChart.js` renders a horizontal bar chart (Highcharts).
26. Feature names are displayed using `convertFeatureName()` from `utils/feature-naming.js`.
27. Use the `FEATURE_ID_SEPARATOR` (U+2011) when parsing feature IDs in importance data.

## Conventions

28. Never block the UI during training — always use Socket.IO for progress.
29. Show `<Spinner />` during the brief period between clicking "Train" and receiving the first Socket.IO event.
30. Use reactstrap `Progress` component for training progress bars.
31. Use consistent color coding: success (green) for good metrics, warning (yellow) for mediocre, danger (red) for poor.
32. All model-related API calls go through `Backend` service class — never call fetch directly.
