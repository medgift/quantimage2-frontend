## Docker & Deployment

### Development

**Start:**
```bash
docker-compose up
```

**Dockerfile** mounts source code as volume → hot reload enabled.

**Port:** `localhost:3000`

### Production Build

**Dockerfile.prod:**
1. `yarn build` → generates optimized static files in `/build`
2. Copies build to nginx container
3. Serves via nginx on port 80

**nginx config:** `react.conf` (handles client-side routing)

**Traefik labels** in `docker-compose.prod.yml` for HTTPS termination.

---

## Docker & Container Networking

### Development Setup

```
Frontend (this repo)                 Backend (separate repo)
  docker-compose.yml                   docker-compose.yml
    └─ web (node:16, port 3000)          ├─ backend (Flask, port 5000)
                                         ├─ celery_extraction
                                         ├─ celery_training
                                         ├─ db (MySQL)
                                         ├─ redis
                                         └─ redis-socket

External services:
  ├─ Kheops (PACS, port 80)
  └─ Keycloak (auth, port 8081)
```

### Connectivity

| From | To | Via | Notes |
|---|---|---|---|
| Browser | Frontend | `http://localhost:3000` | Webpack dev server |
| Browser | Backend API | `REACT_APP_PYTHON_BACKEND_URL` | REST + Socket.IO |
| Browser | Kheops | `REACT_APP_KHEOPS_URL` | DICOMweb API (albums, studies) |
| Browser | Keycloak | `REACT_APP_KEYCLOAK_URL` | OIDC login/token refresh |

**All external calls go from the browser** (not server-side) — the frontend is a pure SPA. This means:
- All service URLs must be **browser-accessible** (not Docker-internal hostnames like `db` or `redis`).
- CORS must be configured on backend and Kheops for the frontend's origin.
- Environment variables are baked in at **build time** (`REACT_APP_*` prefix required).

### Production Deployment

- `Dockerfile.prod` builds static files with `yarn build`, then serves via nginx.
- `react.conf` configures nginx for client-side routing (all paths → `index.html`).
- `docker-compose.prod.yml` adds Traefik labels for HTTPS reverse proxy.
- Environment variables must be set at build time (not runtime) since they're compiled into the JS bundle.

---

## Deployment Commands

### Development

```bash
cd /srv/quantimage-v2/quantimage2-frontend
yarn start
```

### Production

```bash
cd /srv/quantimage-v2/quantimage2-frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

