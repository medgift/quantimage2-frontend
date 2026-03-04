# Verify App — End-to-End Frontend Verification

Run this prompt after any code change to validate the QuantImage v2 frontend is working.

## What to Verify

### 1. ESLint & Prettier Check

```bash
cd /srv/quantimage-v2/quantimage2-frontend
npx eslint <modified_files>
npx prettier --check <modified_files>
```

Zero errors = PASS. The project enforces `react-hooks/exhaustive-deps: "error"`.

### 2. Build Succeeds

**Development (fast check):**
```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn build 2>&1 | tail -10
```

Should output `Compiled successfully`.

**Production Docker:**
```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build 2>&1 | tail -10
```

### 3. Dev Server Starts

```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn start
```

Should compile without errors and be accessible at `http://localhost:3000`.

### 4. No Console Errors

Open `http://localhost:3000` in a browser. The browser console should show:
- No React errors or warnings
- No failed network requests (assuming backend is running)
- No unhandled promise rejections

### 5. Backend Connectivity

Verify the backend is reachable from the frontend:
```bash
curl -sf http://localhost:5000/ && echo "Backend OK" || echo "Backend unreachable"
```

If the backend is running, the frontend should be able to:
- Load the login page (Keycloak redirect)
- After login, load the dashboard (album list from Kheops)

### 6. Production Container

```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose ps
```

Container should be `Up`. Verify nginx serves the app:
```bash
curl -sf http://localhost:3000/ | head -5
```

Should return HTML with React root div.

### 7. Backend Stack (if full-stack verification)

```bash
cd /srv/quantimage-v2/quantimage2_backend
docker compose ps
docker compose logs --tail=20 backend 2>&1 | grep -iE "error|exception" | head -5
```

## Report Format

```
✓ ESLint: PASS (0 errors)
✓ Prettier: PASS
✓ Build: compiled successfully
✓ Dev server: running on :3000
✓ Backend: reachable on :5000
✓ Production build: success
Overall: PASS
```
