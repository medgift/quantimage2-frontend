import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTable, usePagination, useRowSelect, useFilters } from 'react-table';

import './FeatureTable.css';
import { NON_FEATURE_FIELDS } from '../Train';
import { Alert, Button, FormGroup, Label, Input, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useKeycloak } from 'react-keycloak';

import Backend from '../services/backend';

// Generate indeterminate checkbox renderer
const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <>
        <input type="checkbox" ref={resolvedRef} {...rest} />
      </>
    );
  }
);

// Create an editable cell renderer
const EditableCell = ({
  value: initialValue,
  row: { index },
  column: { id },
  updateMyData, // This is a custom function that we supplied to our table instance
  editable,
}) => {
  // We need to keep and update the state of the cell normally
  const [value, setValue] = React.useState(initialValue);

  const onChange = (e) => {
    setValue(e.target.value);
  };

  // We'll only update the external data when the input is blurred
  const onBlur = () => {
    updateMyData(index, id, value);
  };

  // If the initialValue is changed externall, sync it up with our state
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!editable) {
    return `${initialValue}`;
  }

  return <input value={value} onChange={onChange} onBlur={onBlur} />;
};

// This is a custom filter UI for selecting
// a unique option from a list
function SelectColumnFilter({
  column: { filterValue, setFilter, preFilteredRows, id },
}) {
  // Calculate the options for filtering
  // using the preFilteredRows
  const options = React.useMemo(() => {
    const options = new Set();
    preFilteredRows.forEach((row) => {
      options.add(row.values[id]);
    });
    return [...options.values()];
  }, [id, preFilteredRows]);

  // Render a multi-select box
  return (
    <select
      value={filterValue}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
    >
      <option value="">All</option>
      {options.map((option, i) => (
        <option key={i} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function FeatureTable({
  features,
  header,
  featureExtractionID,
  setCollections,
  setActiveCollection,
}) {
  const [keycloak] = useKeycloak();
  const data = useMemo(() => features, []);
  const [collectionName, setCollectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCollectionNameChange = (e) => {
    setCollectionName(e.target.value);
  };

  const saveFeatures = async () => {
    setIsSaving(true);
    //console.log('going to save', { rows: selectedRows });
    let newCollection = await Backend.saveCollection(
      keycloak.token,
      featureExtractionID,
      collectionName,
      selectedRows
    );
    setIsSaving(false);
    setCollections((c) => [...c, newCollection]);
    setActiveCollection(newCollection.collection.id);
  };

  const getColumnClassName = (column) => {
    if (NON_FEATURE_FIELDS.includes(column)) {
      return 'align-left';
    } else {
      return 'align-right';
    }
  };

  const COLUMN_GROUP_METADATA = 'Metadata';
  const COLUMN_GROUP_FEATURES = 'Features';

  const columnsObject = useMemo(
    () =>
      header.reduce(
        (acc, column) => {
          let columnGroup = NON_FEATURE_FIELDS.includes(column)
            ? COLUMN_GROUP_METADATA
            : COLUMN_GROUP_FEATURES;

          acc[columnGroup].columns.push({
            Header: column,
            accessor: column,
            Filter: SelectColumnFilter,
            filter: 'includes',
            disableFilters: !NON_FEATURE_FIELDS.includes(column),
          });

          return acc;
        },
        {
          [COLUMN_GROUP_METADATA]: {
            Header: COLUMN_GROUP_METADATA,
            columns: [],
          },
          [COLUMN_GROUP_FEATURES]: {
            Header: COLUMN_GROUP_FEATURES,
            columns: [],
          },
        }
      ),
    []
  );

  const columns = useMemo(
    () =>
      /*header.map((column) => ({
        Header: column,
        accessor: column,
        Filter: SelectColumnFilter,
        filter: 'includes',
        disableFilters: !NON_FEATURE_FIELDS.includes(column),
      }))*/
      Object.values(columnsObject),
    []
  );

  // Set up the react-table instance
  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: {
        pageSize: 15,
      },
      //autoResetSelectedRows: false,
    },
    useFilters,
    usePagination,
    useRowSelect,
    (hooks) => {
      hooks.visibleColumns.push((columns) => [
        // Let's make a column for selection
        {
          id: 'selection',
          // The header can use the table's getToggleAllRowsSelectedProps method
          // to render a checkbox
          Header: ({ getToggleAllRowsSelectedProps }) => (
            <div>
              <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
            </div>
          ),
          // The cell can use the individual row's getToggleRowSelectedProps method
          // to the render a checkbox
          Cell: ({ row }) => (
            <div>
              <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
            </div>
          ),
        },
        ...columns,
      ]);
    }
  );

  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };

  // Get the various functions to render the table markup
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page, // Instead of using 'rows', we'll use page,
    // which has only the rows for the active page
    // The rest of these things are super handy, too ;)
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    selectedFlatRows,
    state: { pageIndex, pageSize, selectedRowIds },
  } = tableInstance;

  /*const selectedRows = selectedFlatRows.map((r) => {
    let currentRow = {};
    for (let field of NON_FEATURE_FIELDS) {
      currentRow[field] = r.original[field];
    }
    return currentRow;
  });*/

  const selectedRows = data
    .filter((row, i) => selectedRowIds[i] === true)
    .map((row) => {
      let currentRow = {};
      for (let field of NON_FEATURE_FIELDS) {
        currentRow[field] = row[field];
      }
      return currentRow;
    });

  return (
    <div>
      <div className="whole-table-container">
        <div className="table-container">
          {/* MAIN TABLE */}
          <table {...getTableProps()}>
            <thead>
              {
                // Loop over the header rows
                headerGroups.map((headerGroup) => (
                  // Apply the header row props
                  <tr {...headerGroup.getHeaderGroupProps()}>
                    {
                      // Loop over the headers in each row
                      headerGroup.headers.map((column) => (
                        // Apply the header cell props
                        <th {...column.getHeaderProps()}>
                          {
                            // Render the header
                            column.render('Header')
                          }
                          {
                            // Render the filter (if necessary)
                            <div>
                              {column.canFilter
                                ? column.render('Filter')
                                : null}
                            </div>
                          }
                        </th>
                      ))
                    }
                  </tr>
                ))
              }
            </thead>
            {/* Apply the table body props */}
            <tbody {...getTableBodyProps()}>
              {
                // Loop over the table rows
                page.map((row) => {
                  prepareRow(row);
                  return (
                    // Apply the row props
                    <tr {...row.getRowProps()}>
                      {
                        // Loop over the rows cells
                        row.cells.map((cell) => {
                          // Apply the cell props
                          return (
                            <td {...cell.getCellProps()}>
                              {
                                // Render the cell contents
                                cell.render('Cell')
                              }
                            </td>
                          );
                        })
                      }
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
        {/* PAGINATION CONTROLS */}
        <div className="pagination">
          <Button
            color="link"
            onClick={() => gotoPage(0)}
            disabled={!canPreviousPage}
          >
            <FontAwesomeIcon icon="angle-double-left" />
          </Button>{' '}
          <Button
            color="link"
            onClick={() => previousPage()}
            disabled={!canPreviousPage}
          >
            <FontAwesomeIcon icon="angle-left" />
          </Button>{' '}
          <span>
            Page <strong>{pageIndex + 1}</strong> of{' '}
            <strong>{pageOptions.length}</strong>{' '}
          </span>
          <Button
            color="link"
            onClick={() => nextPage()}
            disabled={!canNextPage}
          >
            <FontAwesomeIcon icon="angle-right" />
          </Button>{' '}
          <Button
            color="link"
            onClick={() => gotoPage(pageCount - 1)}
            disabled={!canNextPage}
          >
            <FontAwesomeIcon icon="angle-double-right" />
          </Button>{' '}
          <span>
            Go to page:{' '}
            <input
              type="number"
              defaultValue={pageIndex + 1}
              onChange={(e) => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                gotoPage(page);
              }}
              style={{ width: '100px' }}
            />
          </span>{' '}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
            }}
          >
            {[5, 15, 30, 45, 60].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Alert color="success">
        {JSON.stringify(Object.keys(selectedRowIds).length)}
        {'/'}
        {data.length} {selectedRowIds.length == 1 ? 'row' : 'rows'} selected
      </Alert>
      <FormGroup>
        {/*<Label for="collectionName">Collection Name</Label>*/}
        <Input
          type="text"
          name="collectionName"
          id="collectionName"
          placeholder="Name of your collection"
          value={collectionName}
          onChange={handleCollectionNameChange}
          disabled={Object.keys(selectedRowIds).length === 0}
        />
      </FormGroup>
      <Button
        color="primary"
        onClick={saveFeatures}
        disabled={Object.keys(selectedRowIds).length === 0}
      >
        {isSaving ? (
          <>
            <FontAwesomeIcon icon="spinner" spin /> Saving Custom Features
          </>
        ) : (
          'Save Custom Features'
        )}
      </Button>
    </div>
  );
}
