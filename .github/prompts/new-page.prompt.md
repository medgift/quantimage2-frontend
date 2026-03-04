# New Page Component

Guide for adding a new page (route-level component) to the QuantImage v2 frontend.

## Requirements

- **Page name**: [NAME]
- **Route path**: [e.g. `/my-page/:albumID`]
- **Authentication required**: [yes / no]
- **Sidebar/navigation**: [should it appear in the nav?]

## Architecture Overview

```
src/App.js — React Router v6
  <Routes>
    <Route path="/..." element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
  </Routes>
```

**Key files:**
- `src/App.js` — all route definitions and layout structure
- `src/AppWrapper.js` — Keycloak provider + Router + context providers
- `src/utils/ProtectedRoute.js` — redirects unauthenticated users
- `src/context/UserContext.js` — current user data
- `src/context/SocketContext.js` — Socket.IO connection

## Checklist

### 1. Create the Page Component File

1. Create `src/MyPage.js` (or `src/pages/MyPage.js` if restructuring).
2. Use a **functional component** with hooks:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { Container, Row, Col, Spinner } from 'reactstrap';
import Backend from './services/backend';

function MyPage() {
  const { albumID } = useParams();
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await Backend.myMethod(keycloak.token, albumID);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [keycloak.token, albumID]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Spinner />;

  return (
    <Container fluid className="mt-4">
      <Row>
        <Col>
          <h2>My Page</h2>
          {/* Content */}
        </Col>
      </Row>
    </Container>
  );
}

export default MyPage;
```

### 2. Register the Route

3. In `src/App.js`, import the component and add a `<Route>`:

```jsx
import MyPage from './MyPage';
// Inside <Routes>:
<Route
  path="/my-page/:albumID"
  element={
    <ProtectedRoute>
      <MyPage />
    </ProtectedRoute>
  }
/>
```

4. If the page does NOT require auth, omit the `<ProtectedRoute>` wrapper.

### 3. Add Navigation (if needed)

5. Add a link in the relevant nav component (e.g., sidebar in `Features.js`, or `Dashboard.js`).
6. Use React Router's `<Link>` or `<NavLink>`, NOT `<a href>`:

```jsx
import { Link } from 'react-router-dom';
<Link to={`/my-page/${albumID}`}>My Page</Link>
```

### 4. Backend Data (if needed)

7. Add the API method to `src/services/backend.js` following the existing `request()` pattern:

```javascript
static myMethod(token, albumID) {
  return request(token, `/my-endpoint/${albumID}`);
}
```

8. See `new-backend-api-method.prompt.md` for details.

### 5. Socket.IO Events (if real-time updates needed)

9. Import and use the Socket context:

```jsx
import { SocketContext } from './context/SocketContext';
const socket = useContext(SocketContext);

useEffect(() => {
  if (!socket) return;
  socket.on('my-event', handleEvent);
  return () => socket.off('my-event', handleEvent);
}, [socket]);
```

10. Event names must match `MessageType` enum values from the backend.

### 6. UI Patterns

11. Use **reactstrap** components (Container, Row, Col, Card, Button, Badge, Modal, Spinner, etc.).
12. Use **Bootstrap 4** utility classes for spacing/layout (`mt-3`, `mb-2`, `d-flex`, `justify-content-between`).
13. For icons, use `react-icons` (FontAwesome, Material Design, etc.).
14. For loading states, use `<Spinner />` from reactstrap.
15. For error display, use `<Alert color="danger">` from reactstrap.

### 7. Conventions

16. File name = component name in PascalCase (e.g., `MyPage.js` exports `function MyPage()`).
17. One page component per file.
18. Destructure props: `function MyPage({ prop1, prop2 })`.
19. Use `useCallback` for functions passed as deps to `useEffect` or child components.
20. Use `useMemo` for expensive computed values.
21. Never store Keycloak tokens in state or localStorage — always read from `keycloak.token`.
22. Pass `keycloak.token` as the first argument to all Backend/Kheops service methods.
