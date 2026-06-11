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

