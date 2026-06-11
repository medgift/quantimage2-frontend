## Authentication & Authorization Flow

```
Frontend (React)
  │
  ├─ User not authenticated → Keycloak.login() → Keycloak login page
  │                                              │
  │                                              ▼
  │                          User logs in → Keycloak redirects back with auth code
  │                                              │
  │                                              ▼
  ├─ Keycloak exchanges code for JWT token (handled by @react-keycloak/web)
  │
  ├─ Token stored in Keycloak instance (keycloak.token)
  │
  ├─ All API requests include `Authorization: Bearer <token>`
  │     │
  │     ├─ Backend API: Validates JWT, extracts user ID from `sub` claim
  │     └─ Kheops API: Validates JWT, returns user's albums/studies
  │
  └─ Token auto-refreshed by @react-keycloak/web (before expiry)
```

**Admin role check:**
```javascript
keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS]
  [process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID]
  .roles.includes(KEYCLOAK_ADMIN_ROLE)
```

---

## Security & Medical Data Handling

### Token Flow

```
User → Keycloak login page → JWT issued
  → @react-keycloak/web stores token in memory (NOT localStorage)
  → All API calls include Authorization: Bearer <token>
  → Backend validates JWT via KeycloakOpenID.decode_token()
  → Kheops validates same JWT (shared Keycloak realm)
```

### Rules

- **Never display or log** patient identifiers, DICOM UIDs, or JWT tokens in production UI.
- Use `console.debug()` (not `console.log()`) for development-only diagnostics that include patient data.
- Patient IDs in the UI are derived from DICOM `PatientName` — display only when necessary for labeling/identification.
- **CORS**: Backend must whitelist the frontend origin via `CORS_ALLOWED_ORIGINS`.
- No sensitive data is stored client-side. All medical data remains in Kheops (images) or the backend DB (features, labels, models).
- Feature extraction YAML configs may contain PHI-adjacent information (ROI names) — treat them as sensitive.

---

