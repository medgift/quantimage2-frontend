# New Backend API Method

Guide for adding a new backend service method to communicate with the QuantImage v2 backend API or Kheops PACS.

## Requirements

- **Endpoint**: [METHOD /path]
- **Purpose**: [DESCRIBE]
- **Service file**: [backend.js | kheops.js]
- **Request body**: [JSON shape, if any]
- **Response shape**: [expected JSON]

## Architecture Overview

```
src/services/
  ├── backend.js   — All calls to Python Flask backend (40+ static methods)
  ├── kheops.js    — All calls to Kheops PACS DICOMweb API (6 static methods)
  └── common.js    — Shared helpers: request(), endpoints, headers
```

**Key pattern:** All service methods are `static` class methods. Token is always the first argument.

## Checklist

### Adding a Method to `backend.js`

1. Open `src/services/backend.js`.
2. Add a new static method using the `request()` helper from `common.js`:

```javascript
/**
 * Brief description of what this method does.
 * @param {string} token - Keycloak Bearer token
 * @param {string} albumID - Album identifier
 * @returns {Promise<Object>} Response data
 */
static myNewMethod(token, albumID) {
  return request(token, `/my-endpoint/${albumID}`);
}
```

3. For POST/PUT/DELETE requests with a body:

```javascript
static createSomething(token, albumID, data) {
  return request(token, `/my-endpoint/${albumID}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

4. For multipart/form-data uploads:

```javascript
static uploadFile(token, albumID, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(token, `/my-endpoint/${albumID}`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header — browser sets it with boundary
  });
}
```

5. For file downloads (binary responses):

```javascript
static downloadFile(token, extractionID) {
  return request(token, `/my-endpoint/${extractionID}/download`, {
    responseType: 'blob',
  });
}
```

### Understanding the `request()` Helper

6. Located in `src/services/common.js`.
7. Signature: `request(token, endpoint, options = {})`.
8. Automatically prepends `REACT_APP_PYTHON_BACKEND_URL` to the endpoint.
9. Automatically sets `Authorization: Bearer ${token}` header.
10. Automatically sets `Content-Type: application/json` unless body is `FormData`.
11. Returns parsed JSON by default; returns Blob if `responseType: 'blob'`.
12. Throws on non-2xx responses.

### Adding a Method to `kheops.js`

13. Kheops methods call the Kheops PACS API (DICOMweb), NOT the Python backend.
14. Base URL: `REACT_APP_KHEOPS_URL` environment variable.
15. Pattern:

```javascript
static getStudyMetadata(token, studyUID) {
  return request(
    token,
    `/studies/${studyUID}/metadata`,
    {},
    REACT_APP_KHEOPS_URL  // Override base URL
  );
}
```

16. DICOM field constants are in `src/config/constants.js` → `DicomFields`:
```javascript
export const DicomFields = {
  STUDY_UID: '0020000D',
  SERIES_UID: '0020000E',
  MODALITY: '00080060',
  PATIENT_ID: '00100020',
  // ...
};
```

### Using the New Method in a Component

17. Import the service class:
```javascript
import Backend from '../services/backend';
// or
import Kheops from '../services/kheops';
```

18. Always pass `keycloak.token` as the first argument:
```javascript
const { keycloak } = useKeycloak();
const result = await Backend.myNewMethod(keycloak.token, albumID);
```

19. Handle errors with try/catch:
```javascript
try {
  const result = await Backend.myNewMethod(keycloak.token, albumID);
  setData(result);
} catch (error) {
  console.error('API call failed:', error);
  setError(error.message);
}
```

### Conventions

20. Method names: camelCase, descriptive (`getExtractionDetails`, `saveCollectionNew`, `deleteModel`).
21. Always JSDoc the method with `@param` and `@returns`.
22. Never hardcode the backend URL — always use `request()` which reads from env.
23. Never store or cache tokens — always read fresh from `keycloak.token`.
24. For endpoints returning large data (features), check if the backend returns multipart and use `parseFeatureDetailsResponse()` from `utils/multipart-parser.js`.
25. Group methods logically in the class (extractions together, models together, labels together, etc.).

### Environment Variables

26. `REACT_APP_PYTHON_BACKEND_URL` — Python Flask backend base URL (e.g., `http://localhost:5000`).
27. `REACT_APP_KHEOPS_URL` — Kheops PACS base URL.
28. Both are set at **build time** (Create React App convention). Changes require a rebuild.
