import React, { useMemo } from 'react';
import { useTable, usePagination, useFilters } from 'react-table';

import './FeatureTable.css';
import { NON_FEATURE_FIELDS } from '../Train';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { formatFeatureColumn } from '../utils/feature-label';
import { SelectColumnFilter } from '../utils/feature-utils';

import _ from 'lodash';

export function FeatureTable({ columns, data }) {
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
    usePagination
  );

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
    state: { pageIndex, pageSize },
  } = tableInstance;

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
            onClick={previousPage}
            disabled={!canPreviousPage}
          >
            <FontAwesomeIcon icon="angle-left" />
          </Button>{' '}
          <span>
            Page <strong>{pageIndex + 1}</strong> of{' '}
            <strong>{pageOptions.length}</strong>{' '}
          </span>
          <Button color="link" onClick={nextPage} disabled={!canNextPage}>
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

export default function RadiomicsFeatureTable({ featuresTabular }) {
  console.log('featuresTabular', featuresTabular);
  const data = featuresTabular;

  const COLUMN_GROUP_METADATA = 'Metadata';
  const COLUMN_GROUP_FEATURES = 'Features';

  const columnsDefinitions = useMemo(() => {
    let featureGroups = {};
    const header =
      _.uniq(_.flatten(featuresTabular.map((f) => Object.keys(f)))) || [];

    let presentModalities = _.uniq(featuresTabular.map((f) => f.Modality));

    // Group features like the Feature Selection tree
    // (Shape / Intensity / Texture › family), in order of appearance
    for (let featureName of header.filter(
      (c) => !NON_FEATURE_FIELDS.includes(c)
    )) {
      const { group, name } = formatFeatureColumn(
        featureName,
        presentModalities
      );

      featureGroups[group] = featureGroups[group] || [];
      featureGroups[group].push({ featureName, name });
    }

    console.log('feature groups', featureGroups);

    let featureColumns = Object.keys(featureGroups).map((featureGroup) => ({
      Header: featureGroup,
      id: featureGroup,
      columns: featureGroups[featureGroup].map(({ featureName, name }) => ({
        Header: () => <span title={featureName}>{name}</span>,
        accessor: featureName,
        disableFilters: true,
      })),
    }));

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

    console.log('columns definitions', columnsDefinitions);
    return columnsDefinitions;
  }, [featuresTabular]);

  const columns = useMemo(() => columnsDefinitions, [columnsDefinitions]);

  return (
    <div>
      <FeatureTable data={data} columns={columns} />
    </div>
  );
}
