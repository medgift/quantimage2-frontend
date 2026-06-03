## Project Overview

QuantImage v2 is a **radiomics research platform** for medical imaging. The frontend is a **React single-page application** that allows clinicians to:
- Browse DICOM medical images (MRI, CT, PET/CT scans) from **Kheops** (PACS viewer)
- Extract radiomic features from those images
- Train and evaluate machine learning models for outcome prediction (classification or survival analysis)
- Visualize features through heatmaps and UMAP plots
- Compare trained models and analyze feature importance

This repository is the **frontend only**. It communicates with:
- **Backend API** (Python Flask + Celery) for feature extraction and ML model training
- **Kheops PACS** (DICOMweb API) for medical image metadata and albums
- **Keycloak** auth server for authentication via OpenID Connect (OIDC)
- **Socket.IO** server (via backend) for real-time progress updates

---

## Architecture: Services & Dependencies

### Frontend Service (This App)

**Development:**
- Docker container running `yarn start` (webpack dev server)
- Port 3000 exposed to host
- Source code mounted as volume for hot reload

**Production:**
- Built with `yarn build` → static files
- Served via nginx (see `Dockerfile.prod` and `react.conf`)
- Traefik reverse proxy for HTTPS (see `docker-compose.prod.yml`)

### External Services (Separate Repos/Containers)

| Service | Base URL Env Var | Role |
|---|---|---|
| **Backend API** | `REACT_APP_PYTHON_BACKEND_URL` | REST API + Socket.IO server |
| **Kheops PACS** | `REACT_APP_KHEOPS_URL` | DICOM metadata, albums, studies (DICOMweb) |
| **Keycloak** | `REACT_APP_KEYCLOAK_URL` | OpenID Connect auth server (JWT tokens) |

**Environment Variables:**

| Variable | Example | Description |
|---|---|---|
| `REACT_APP_PYTHON_BACKEND_URL` | `http://localhost:5001` | Backend Flask API base URL |
| `REACT_APP_KHEOPS_URL` | `http://localhost` | Kheops PACS base URL |
| `REACT_APP_KEYCLOAK_URL` | `http://localhost:8081/auth` | Keycloak auth server URL |
| `REACT_APP_KEYCLOAK_REALM` | `QuantImage-v2` | Keycloak realm name |
| `REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID` | `quantimage2-frontend` | Keycloak client ID for this app |

All `REACT_APP_*` variables are injected at **build time** by Create React App and accessible via `process.env.REACT_APP_*`.

---

