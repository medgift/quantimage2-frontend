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

