# Oncall Guide — Frontend Production Troubleshooting

Reference guide for diagnosing and resolving production issues with the QuantImage v2 frontend.

## Deployment Commands

**Production:**
```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Development:**
```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn start
```

## Common Issues & Fixes

### 1. Blank Page / White Screen

**Symptoms:** Browser shows blank page, no React content.

**Check browser console for errors:**
- `ChunkLoadError` → stale cached files after deployment
  - Fix: hard refresh (Ctrl+Shift+R) or clear browser cache
  - Verify nginx config serves correct `index.html`
- `SyntaxError` or `ReferenceError` → build issue
  - Fix: rebuild `docker compose -f docker-compose.yml -f docker-compose.prod.yml build`
- `REACT_APP_*` undefined → env vars not set at build time
  - Fix: set vars in `.env.production.local`, rebuild

### 2. Login Loop / Keycloak Redirect Error

**Symptoms:** Page keeps redirecting to Keycloak and back.

```bash
# Check Keycloak is reachable from browser
curl -sf ${REACT_APP_KEYCLOAK_URL}/realms/QuantImage-v2/.well-known/openid-configuration | head -5

# Common causes:
# - REACT_APP_KEYCLOAK_URL points to wrong host
# - Keycloak client redirect URIs don't include the frontend URL
# - Browser cookies blocked (third-party cookie issue)
```

### 3. API Calls Failing (CORS Errors)

**Symptoms:** Browser console shows `Access-Control-Allow-Origin` errors.

```bash
# Check backend CORS config
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend env | grep CORS

# CORS_ALLOWED_ORIGINS must match the frontend's exact origin (including protocol and port)
```

**Fix:** Update `CORS_ALLOWED_ORIGINS` in backend `.env`, restart backend.

### 4. Socket.IO Not Connecting

**Symptoms:** Feature extraction or training starts but no progress updates appear.

```bash
# Check backend Socket.IO is reachable
curl -sf http://localhost:5000/socket.io/?EIO=3&transport=polling | head -5

# Check backend Redis (Socket.IO message queue)
cd /srv/quantimage-v2/quantimage2_backend
docker compose exec redis-socket redis-cli ping
```

Browser console should show Socket.IO connection established, not repeated reconnection attempts.

### 5. Build Fails

**Symptoms:** `yarn build` or Docker build fails.

```bash
cd /srv/quantimage-v2/quantimage2-frontend

# Check for ESLint errors (warnings treated as errors in build)
npx eslint src/ 2>&1 | tail -20

# Check for missing dependencies
yarn install 2>&1 | tail -5

# Common causes:
# - New dependency not in yarn.lock → run `yarn install`
# - Node version mismatch → Dockerfile uses node:16
# - Webpack config issue → check config-overrides.js
```

### 6. Features/Charts Not Loading

**Symptoms:** Feature table or visualizations show spinner indefinitely.

```bash
# Check backend extraction endpoint
curl -H "Authorization: Bearer <token>" http://localhost:5000/extractions/<id>/feature-details -o /dev/null -w "%{http_code}"

# Common causes:
# - Backend not responding → check backend container
# - Extraction not complete → check Celery logs
# - Multipart parsing error → check multipart-parser.js
```

### 7. Nginx Issues (Production)

**Symptoms:** Routes return 404, static assets missing.

```bash
cd /srv/quantimage-v2/quantimage2-frontend
# Check nginx config
docker compose exec web cat /etc/nginx/conf.d/default.conf

# Check nginx logs
docker compose logs --tail=30 web

# The react.conf must route all paths to index.html for client-side routing
```

### 8. Environment Variables

All `REACT_APP_*` variables are baked into the JS bundle at **build time**. Changing `.env` files requires a **rebuild**:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Check what's compiled into the bundle:
```bash
docker compose exec web grep -r "REACT_APP" /usr/share/nginx/html/static/js/ | head -5
```

## Monitoring

### Container Status
```bash
docker compose ps
docker compose logs --tail=30 web
```

### Backend Stack Status
```bash
cd /srv/quantimage-v2/quantimage2_backend
docker compose ps
docker compose logs --tail=20 backend 2>&1 | grep -iE "error|exception" | head -5
```

## Quick Recovery

If everything is broken, full restart:
```bash
# Frontend
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Backend
cd /srv/quantimage-v2/quantimage2_backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
