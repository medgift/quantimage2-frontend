import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useTable, usePagination, useRowSelect, useFilters } from 'react-table';

import './FeatureTable.css';
import { NON_FEATURE_FIELDS } from '../Train';
import { Alert, Button, FormGroup, Label, Input, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useKeycloak } from 'react-keycloak';

import Backend from '../services/backend';

import _ from 'lodash';

const PYRADIOMICS_PREFIX = 'orig';

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

const CheckableColumnHeader = React.forwardRef(
  ({ updateSelectedFeature, column, inline }, ref) => {
    return (
      <div>
        <input
          id={`feature-column-${column}`}
          type="checkbox"
          defaultChecked
          ref={ref}
          onChange={(e) => updateSelectedFeature(column, e.target.checked)}
          //onChange={(e) => updateSelectedFeature(column, e.target.checked)}
        />
        {inline ? <br /> : ' '}
        <label htmlFor={`feature-column-${column}`}>{column}</label>
      </div>
    );
  }
);

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

  // Manage feature selection
  const selectedFeatures = useRef();
  const [selectedFeaturesLabel, setSelectedFeaturesLabel] = useState('');
  const featureCheckboxRefs = useRef({});

  const updateSelectedFeaturesLabel = (nbFeatures) => {
    let totalFeatures = header.filter((f) => !NON_FEATURE_FIELDS.includes(f))
      .length;
    setSelectedFeaturesLabel(
      `${
        nbFeatures !== undefined ? nbFeatures : totalFeatures
      }/${totalFeatures} selected`
    );
  };

  //const [selectedFeatures, setSelectedFeatures] = useState({});
  const updateSelectedFeature = (column, value) => {
    //setSelectedFeatures((f) => ({ ...f, [column]: value }));
    selectedFeatures.current[column] = value;
    updateSelectedFeaturesLabel(
      Object.values(selectedFeatures.current).filter((f) => f === true).length
    );
  };

  const updateSelectedFeatureGroups = (featureGroup, value) => {
    console.log('setting the group ' + featureGroup + ' to ' + value);

    // Identify the columns to uncheck
    let columnsToToggle = header.filter((f) => f.includes(featureGroup));

    for (let columnToToggle of columnsToToggle) {
      featureCheckboxRefs.current[columnToToggle].checked = value;
      selectedFeatures.current[columnToToggle] = value;
    }

    updateSelectedFeaturesLabel(
      Object.values(selectedFeatures.current).filter((f) => f === true).length
    );
  };

  // Initialize number of selected features
  useEffect(() => {
    updateSelectedFeaturesLabel();
  }, []);

  useEffect(() => {
    let defaultFeatures = {};
    for (let feature of header) {
      if (!NON_FEATURE_FIELDS.includes(feature))
        defaultFeatures[feature] = true;
    }

    selectedFeatures.current = defaultFeatures;

    //setSelectedFeatures(defaultFeatures);
  }, []);

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
      //selectedRows,
      Object.keys(_.pickBy(selectedFeatures.current))
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

  const columnsDefinitions = useMemo(() => {
    let featureGroups = {};
    let currentFeatureGroup = '';

    // Make groups of features
    for (let featureName of header.filter(
      (c) => !NON_FEATURE_FIELDS.includes(c)
    )) {
      // TODO - Make this more elegant, maybe a convention for feature names is needed
      // Group PyRadiomics features by the second level,
      // first level for other backens so far
      let featureGroupName;
      if (featureName.startsWith(PYRADIOMICS_PREFIX)) {
        featureGroupName = featureName.split('_')[1];
      } else {
        featureGroupName =
          featureName.split('_')[0] + '_' + featureName.split('_')[1];
      }

      if (featureGroupName !== currentFeatureGroup) {
        featureGroups[featureGroupName] = [];
        currentFeatureGroup = featureGroupName;
      }

      featureGroups[featureGroupName].push(featureName);
    }

    console.log('feature groups', featureGroups);

    let featureColumns = Object.keys(featureGroups).map((featureGroup) => ({
      /*Header: () => (
        <CheckableColumnHeader
          updateSelectedFeature={updateSelectedFeatureGroups}
          column={featureGroup}
        />
      ),*/
      Header: featureGroup,
      id: featureGroup,
      columns: featureGroups[featureGroup].map((featureName) => ({
        /*Header: () => (
          <CheckableColumnHeader
            updateSelectedFeature={updateSelectedFeature}
            column={featureName}
            ref={(ref) => {
              featureCheckboxRefs.current[featureName] = ref;
            }}
            inline
          />
        ),*/
        Header: featureName,
        accessor: featureName,
        disableFilters: true,
      })),
    }));

    console.log('feature columns', featureColumns);

    let columnsDefinitions = [
      {
        Header: COLUMN_GROUP_METADATA,
        columns: NON_FEATURE_FIELDS.map((field) => ({
          Header: field,
          accessor: field,
          Filter: SelectColumnFilter,
          filter: 'equals',
        })),
      },
      {
        Header: COLUMN_GROUP_FEATURES,
        columns: featureColumns,
      },
    ];

    return columnsDefinitions;
  }, []);

  const columns = useMemo(
    () =>
      /*header.map((column) => ({
        Header: column,
        accessor: column,
        Filter: SelectColumnFilter,
        filter: 'includes',
        disableFilters: !NON_FEATURE_FIELDS.includes(column),
      }))*/
      columnsDefinitions,
    [columnsDefinitions]
  );

  // Set up the react-table instance
  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: {
        pageSize: 20,
      },
      //autoResetSelectedRows: false,
    },
    useFilters,
    usePagination,
    //useRowSelect,
    (hooks) => {
      /*hooks.visibleColumns.push((columns) => [
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
      ]);*/
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
    state: { pageIndex, pageSize /*selectedRowIds*/ },
  } = tableInstance;

  /*const selectedRows = selectedFlatRows.map((r) => {
    let currentRow = {};
    for (let field of NON_FEATURE_FIELDS) {
      currentRow[field] = r.original[field];
    }
    return currentRow;
  });*/

  /*const selectedRows = data
    .filter((row, i) => selectedRowIds[i] === true)
    .map((row) => {
      let currentRow = {};
      for (let field of NON_FEATURE_FIELDS) {
        currentRow[field] = row[field];
      }
      return currentRow;
    });*/

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
            {[10, 20, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
