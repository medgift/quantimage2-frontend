# Kheops PACS Integration

Guide for adding or modifying interactions with the Kheops DICOMweb PACS server from the QuantImage v2 frontend.

## Requirements

- **What to build**: [DESCRIBE THE KHEOPS INTEGRATION]
- **DICOM resource**: [albums | studies | series | instances | metadata]
- **Read or write**: [fetching data | uploading | sharing]

## Architecture Overview

```
src/services/kheops.js — Kheops API client (6 static methods)
  ├── getAlbums(token) — list user's albums
  ├── getAlbumStudies(token, albumID) — studies in an album
  ├── getStudySeries(token, studyUID) — series in a study
  ├── getSeriesInstances(token, studyUID, seriesUID) — instances in a series
  ├── getStudyMetadata(token, studyUID) — DICOM metadata (JSON)
  └── getSeriesThumbnail(token, studyUID, seriesUID) — preview image

src/config/constants.js — DICOM field tag constants
```

## DICOM Field Constants

```javascript
// From src/config/constants.js:
export const DicomFields = {
  STUDY_UID: '0020000D',
  SERIES_UID: '0020000E',
  MODALITY: '00080060',
  PATIENT_ID: '00100020',
  PATIENT_NAME: '00100010',
  STUDY_DATE: '00080020',
  STUDY_DESCRIPTION: '00081030',
  SERIES_DESCRIPTION: '0008103E',
  SERIES_NUMBER: '00200011',
  NUM_INSTANCES: '00201208',
  // ... additional tags
};
```

**Usage pattern** for reading DICOM JSON:
```javascript
const patientID = study[DicomFields.PATIENT_ID]?.Value?.[0]?.Alphabetic
  || study[DicomFields.PATIENT_ID]?.Value?.[0];
const modality = series[DicomFields.MODALITY]?.Value?.[0];
```

## Checklist

### Adding a New Kheops API Method

1. Open `src/services/kheops.js`.
2. Add a static method using the `request()` helper with Kheops base URL:

```javascript
/**
 * Fetch DICOM resource from Kheops.
 * @param {string} token - Keycloak Bearer token
 * @param {string} studyUID - DICOM Study Instance UID
 * @returns {Promise<Object>} DICOMweb JSON response
 */
static getResource(token, studyUID) {
  return request(
    token,
    `/studies/${studyUID}/resource`,
    {},
    process.env.REACT_APP_KHEOPS_URL
  );
}
```

3. The `request()` helper automatically adds `Authorization: Bearer ${token}`.
4. Kheops returns DICOMweb JSON format — nested objects with tag keys.

### Album & Study Patterns

5. Dashboard lists albums via `Kheops.getAlbums(token)`.
6. Each album has a unique `album_id` (not a DICOM UID — it's a Kheops internal ID).
7. Studies within an album: `Kheops.getAlbumStudies(token, albumID)`.
8. Each study has a `StudyInstanceUID` (DICOM tag `0020000D`).
9. Patient ↔ Study mapping: a patient may have multiple studies. Patient ID is `0010,0020`.

### OHIF Viewer Integration

10. The frontend links to OHIF viewer for DICOM image viewing.
11. OHIF URL pattern: `${REACT_APP_OHIF_URL}/viewer/${studyUID}`.
12. OHIF is configured separately (see `ohif/ohif-config.js`).
13. Always open OHIF links in a new tab: `target="_blank" rel="noopener noreferrer"`.

### Displaying DICOM Data

14. Parse DICOMweb JSON carefully — values are nested:
```javascript
// Correct pattern:
const value = dicomJSON[tag]?.Value?.[0];

// For Person Name (PN VR):
const name = dicomJSON[DicomFields.PATIENT_NAME]?.Value?.[0]?.Alphabetic;

// For arrays:
const values = dicomJSON[tag]?.Value || [];
```

15. Always handle missing/null fields — DICOM data is frequently incomplete.
16. For date fields (DA VR), format with `moment` or `luxon`:
```javascript
import moment from 'moment';
const dateStr = dicomJSON[DicomFields.STUDY_DATE]?.Value?.[0];
const formatted = dateStr ? moment(dateStr, 'YYYYMMDD').format('DD/MM/YYYY') : 'N/A';
```

### Security

17. **Never display raw DICOM patient data** (name, ID, DOB) without explicit user context.
18. Never log DICOM UIDs or patient identifiers to the console in production.
19. Always pass `keycloak.token` — never cache or persist tokens.
20. Kheops enforces album-level access control: users can only see studies in albums they belong to.

### Environment Variables

21. `REACT_APP_KHEOPS_URL` — Kheops PACS base URL (e.g., `http://localhost:8042`).
22. `REACT_APP_OHIF_URL` — OHIF viewer URL (e.g., `http://localhost:3001`).
23. Both are set at build time. Changes require rebuild.

### Common Patterns in Existing Code

24. **Album listing** (Dashboard.js):
```javascript
const albums = await Kheops.getAlbums(keycloak.token);
// Each album: { album_id, name, description, number_of_studies, ... }
```

25. **Study listing** (Features.js, Study.js):
```javascript
const studies = await Kheops.getAlbumStudies(keycloak.token, albumID);
// Each study: DICOMweb JSON object with tag-keyed fields
```

26. **Series listing** (Study.js):
```javascript
const series = await Kheops.getStudySeries(keycloak.token, studyUID);
// Each series: { modality, seriesDescription, numberOfInstances, ... }
```
