## Development Patterns & Conventions

### Adding a New Page

1. Create component file in `src/` (e.g., `MyNewPage.js`)
2. Add route in `src/App.js`:
   ```javascript
   <Route
     path="/my-new-page"
     element={
       <ProtectedRoute>
         <MyNewPage />
       </ProtectedRoute>
     }
   />
   ```
3. Use `useKeycloak()` hook to access token:
   ```javascript
   const { keycloak } = useKeycloak();
   const data = await Backend.someMethod(keycloak.token, ...);
   ```

### Adding a New Backend API Method

1. Add method to `src/services/backend.js`:
   ```javascript
   async myNewMethod(token, param) {
     const url = `${endpoints.myEndpoint}/${param}`;
     return await request(url, { token, method: 'GET' });
   }
   ```
2. Define endpoint at top of file:
   ```javascript
   const endpoints = {
     // ...
     myEndpoint: `${baseEndpoint}/my-endpoint`,
   };
   ```

### Adding a Reusable Component

1. Create file in `src/components/` (e.g., `MyComponent.js`)
2. Export as default:
   ```javascript
   export default function MyComponent({ prop1, prop2 }) { ... }
   ```
3. Import in parent component:
   ```javascript
   import MyComponent from './components/MyComponent';
   ```

### Using Socket.IO for Real-Time Updates

**Pattern:**
```javascript
import SocketContext from './context/SocketContext';
import { SOCKETIO_MESSAGES } from './config/constants';

function MyComponent() {
  const socket = useContext(SocketContext);

  const handleUpdate = useCallback((data) => {
    console.log('Received update:', data);
    // Update state...
  }, []);

  useEffect(() => {
    socket.on(SOCKETIO_MESSAGES.MY_EVENT, handleUpdate);
    return () => socket.off(SOCKETIO_MESSAGES.MY_EVENT, handleUpdate);
  }, [socket, handleUpdate]);
}
```

**Available events:**
- `SOCKETIO_MESSAGES.EXTRACTION_STATUS` – Feature extraction progress
- `SOCKETIO_MESSAGES.FEATURE_STATUS` – Individual feature computation status
- `SOCKETIO_MESSAGES.TRAINING_STATUS` – Model training progress

### Displaying Metrics with Confidence Intervals

Use `formatMetric()` from `utils/feature-utils.js`:

```javascript
import { formatMetric } from '../utils/feature-utils';

const metric = { mean: 0.85, inf_value: 0.82, sup_value: 0.88 };
const formatted = formatMetric(metric);  // "0.850 (0.820 - 0.880)"
```

### Creating Tables with react-table

**Pattern (v7 API):**
```javascript
import { useTable, useSortBy } from 'react-table';

function MyTable({ data }) {
  const columns = useMemo(() => [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Value', accessor: 'value' },
  ], []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data }, useSortBy);

  return (
    <Table {...getTableProps()}>
      <thead>
        {headerGroups.map(hg => (
          <tr {...hg.getHeaderGroupProps()}>
            {hg.headers.map(col => (
              <th {...col.getHeaderProps(col.getSortByToggleProps())}>
                {col.render('Header')}
                {col.isSorted ? (col.isSortedDesc ? ' 🔽' : ' 🔼') : ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
```

### Using Web Workers

**Example (feature filtering):**
```javascript
// Start worker
if (window.Worker) {
  const worker = new Worker('/workers/my-worker.js');
  
  worker.postMessage({ data: myData });
  
  worker.onmessage = (event) => {
    const result = event.data;
    // Process result...
  };
}
```

**Worker files** live in `public/workers/` (not bundled by webpack).

### Downloading Files

**Pattern:**
```javascript
import { downloadFile } from '../services/common';
import { saveAs } from 'file-saver';

const { filename, content } = await downloadFile(url, keycloak.token);
saveAs(content, filename);
```

Or use `fileDownload` from `js-file-download`:
```javascript
import fileDownload from 'js-file-download';
fileDownload(content, filename);
```

---

