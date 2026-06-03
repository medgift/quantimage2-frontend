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

