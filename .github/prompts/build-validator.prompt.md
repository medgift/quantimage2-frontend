# Build Validator — Docker Build & Deployment Validation

Run this prompt to validate Docker builds, configurations, and deployment readiness for the frontend.

## When to Use

- After modifying `Dockerfile`, `Dockerfile.prod`, `docker-compose*.yml`, `react.conf`, or `config-overrides.js`
- After adding/removing npm packages
- After changing environment variables (`REACT_APP_*`)
- Before deploying to production

## Checks to Perform

### 1. Package Installation

```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn install 2>&1 | tail -5
```

No errors or unresolved peer dependencies.

### 2. Environment Variables

All `REACT_APP_*` variables must be set at build time:

```bash
# Dev (.env.development)
cat .env.development

# Prod (.env.production or .env.production.local)
cat .env.production
cat .env.production.local 2>/dev/null
```

Required variables:
- `REACT_APP_PYTHON_BACKEND_URL` — Flask backend URL
- `REACT_APP_KHEOPS_URL` — Kheops PACS URL
- `REACT_APP_KEYCLOAK_URL` — Keycloak auth URL
- `REACT_APP_OHIF_URL` — OHIF viewer URL (optional)

### 3. Dev Build

```bash
yarn build 2>&1 | tail -10
```

Must output `Compiled successfully`. Check for:
- No TypeScript/ESLint errors treated as warnings
- No missing modules
- No webpack config issues (config-overrides.js)

### 4. Docker Build (Production)

```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build 2>&1 | tail -10
```

### 5. Docker Compose Validation

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet && echo "Prod config OK"
docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet 2>/dev/null && echo "Local config OK"
```

### 6. Nginx Config

Check `react.conf` for correct SPA routing:
- All paths should fall through to `index.html`
- Static assets served with correct MIME types
- No CORS headers in nginx (handled by backend)

### 7. Production Container Starts

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
curl -sf http://localhost:3000/ | head -3
```

### 8. Webpack Config (config-overrides.js)

If `config-overrides.js` was modified, verify:
- Monaco Editor plugin still works
- Node.js polyfills (buffer, stream, etc.) still resolve
- No duplicate or conflicting webpack rules

## Report Format

```
✓ yarn install: success
✓ Environment variables: complete
✓ Dev build: compiled successfully
✓ Docker build (prod): success
✓ Compose config: valid
✓ Nginx config: correct
✓ Production container: running
Overall: PASS
```
