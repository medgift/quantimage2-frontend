import { useSortBy, useTable } from 'react-table';
import React, { useState } from 'react';
import { Badge, Button, Collapse, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DATA_SPLITTING_TYPES } from '../config/constants';

export default function ModelsTable({
  title,
  columns,
  data,
  dataPoints,
  albumExtraction,
  collectionInfos,
  handleDeleteModelClick,
  handleShowFeatureNames,
  handleShowPatientIDs,
  formatMetrics,
  bestModel
}) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow
  } = useTable(
    {
      columns,
      data,
      initialState: {
        sortBy: [{ id: 'created_at', desc: true }]
      }
    },
    useSortBy
  );

  const [openModelID, setOpenModelID] = useState(-1);

  const toggleModel = modelID => {
    setOpenModelID(m => (m !== modelID ? modelID : -1));
  };

  const generateNbObservations = row => {
    let isTrainTest =
      row.original.data_splitting_type ===
      DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT;

    let trainingPatientIDs = isTrainTest
      ? row.original.training_patient_ids
      : dataPoints;

    return (
      <>
        <tr>
          <td>
            Number of Observations
            {isTrainTest && ' (Training)'}
          </td>
          <td>
            {trainingPatientIDs.length}
            {' - '}
            <Button
              color="link"
              onClick={event => {
                event.preventDefault();
                handleShowPatientIDs(
                  trainingPatientIDs.sort((p1, p2) =>
                    p1.localeCompare(p2, undefined, {
                      numeric: true,
                      sensitivity: 'base'
                    })
                  )
                );
              }}
              className="p-0"
            >
              Show {isTrainTest && 'Training'} Patient IDs
            </Button>
          </td>
        </tr>
        {isTrainTest && (
          <tr>
            <td>Number of Observations (Test)</td>
            <td>
              {row.original.test_patient_ids.length}
              {' - '}
              <Button
                color="link"
                onClick={event => {
                  event.preventDefault();
                  handleShowPatientIDs(
                    row.original.test_patient_ids.sort((p1, p2) =>
                      p1.localeCompare(p2, undefined, {
                        numeric: true,
                        sensitivity: 'base'
                      })
                    )
                  );
                }}
                className="p-0"
              >
                Show Test Patient IDs
              </Button>
            </td>
          </tr>
        )}
      </>
    );
  };

  if (data.length === 0) return null;

  return (
    <>
      <h4 className="mt-3">{title}</h4>
      <Table {...getTableProps()} className="m-3 models-summary">
        <thead>
          {headerGroups.map(headerGroup => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              <th> </th>
              {headerGroup.headers.map(column => (
                // Add the sorting props to control sorting. For this example
                // we can add them into the header props
                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render('Header')}
                  {/* Add a sort direction indicator */}
                  <span>
                    {column.isSorted ? (
                      column.isSortedDesc ? (
                        <>
                          {' '}
                          <FontAwesomeIcon
                            style={{ color: 'grey' }}
                            icon="caret-up"
                          />
                          <FontAwesomeIcon icon="caret-down" />
                        </>
                      ) : (
                        <>
                          {' '}
                          <FontAwesomeIcon icon="caret-up" />
                          <FontAwesomeIcon
                            style={{ color: 'grey' }}
                            icon="caret-down"
                          />
                        </>
                      )
                    ) : (
                      <>
                        {' '}
                        <FontAwesomeIcon
                          style={{ color: 'grey' }}
                          icon="caret-up"
                        />
                        <FontAwesomeIcon
                          style={{ color: 'grey' }}
                          icon="caret-down"
                        />
                      </>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row, i) => {
            prepareRow(row);
            return (
              <React.Fragment key={row.getRowProps().key}>
                <tr
                  {...row.getRowProps()}
                  className={`model-row ${row.original.id === bestModel.id &&
                    'text-success'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleModel(row.original.id)}
                >
                  <td style={{ width: '40px' }} className="model-row-icon">
                    <FontAwesomeIcon
                      icon={
                        openModelID === row.original.id
                          ? 'minus-circle'
                          : 'plus-circle'
                      }
                    />
                  </td>
                  {row.cells.map(cell => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 0 }}>
                    <Collapse isOpen={openModelID === row.original.id}>
                      <div key={row.original.id} className="model-entry">
                        <h3>{row.name}</h3>
                        <div className="model-details-container">
                          <Table bordered className="model-details-table">
                            <tbody>
                              <tr>
                                <td>Created at</td>
                                <td>{row.original.created_at}</td>
                              </tr>
                              <tr>
                                <td>Model type</td>
                                <td>{row.original.type}</td>
                              </tr>
                              <tr>
                                <td>Algorithm Used</td>
                                <td>{row.original.algorithm}</td>
                              </tr>
                              <tr>
                                <td>Data Normalization</td>
                                <td>
                                  {row.data_normalization
                                    ? row.data_normalization
                                    : 'None'}
                                </td>
                              </tr>
                              {/* TODO - Put this back once it's implemented */}
                              {/*
                              <tr>
                                <td>Feature Selection</td>
                                <td>
                                  {row.feature_selection
                                    ? row.feature_selection
                                    : 'None'}
                                </td>
                              </tr>
                              */}
                              <tr>
                                <td>Modalities Used</td>
                                <td>
                                  {row.original.modalities.map(modality => (
                                    <Badge
                                      style={{ marginRight: '0.5em' }}
                                      color="primary"
                                      key={modality}
                                    >
                                      {modality}
                                    </Badge>
                                  ))}
                                </td>
                              </tr>
                              <tr>
                                <td>ROIs Used</td>
                                <td>
                                  {row.original.rois.map(roi => (
                                    <Badge
                                      style={{ marginRight: '0.5em' }}
                                      color="primary"
                                      key={roi}
                                    >
                                      {roi}
                                    </Badge>
                                  ))}
                                </td>
                              </tr>
                              <tr>
                                <td>Features Used</td>
                                <td>
                                  {collectionInfos
                                    ? collectionInfos.features.length
                                    : albumExtraction.feature_definitions
                                        .length}
                                  {' - '}
                                  <Button
                                    color="link"
                                    onClick={event => {
                                      event.preventDefault();
                                      handleShowFeatureNames(
                                        collectionInfos
                                          ? collectionInfos.features
                                          : albumExtraction.feature_definitions
                                      );
                                    }}
                                    className="p-0"
                                  >
                                    Show details
                                  </Button>
                                </td>
                              </tr>
                              {generateNbObservations(row)}
                              <tr>
                                <td>Validation Type</td>
                                <td>
                                  {row.original.data_splitting_type ===
                                  DATA_SPLITTING_TYPES.FULL_DATASET
                                    ? 'Cross-validation on Full Dataset'
                                    : 'Train/Test Split'}
                                </td>
                              </tr>
                              <tr>
                                <td>
                                  {row.original.data_splitting_type ===
                                    DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT &&
                                    'Training '}
                                  Validation Strategy
                                </td>
                                <td>
                                  {row.original.training_validation
                                    ? row.original.training_validation
                                    : 'None'}
                                </td>
                              </tr>
                              {row.original.data_splitting_type ===
                                DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                <tr>
                                  <td>Test Validation Strategy</td>
                                  <td>
                                    {row.original.test_validation
                                      ? row.original.test_validation
                                      : 'None'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                        <hr />
                        <div>
                          <strong>Model Metrics</strong>
                          {formatMetrics(row.original.metrics)}
                        </div>
                        <br />
                        <p>
                          <Button
                            color="danger"
                            onClick={() =>
                              handleDeleteModelClick(row.original.id)
                            }
                          >
                            Delete Model
                          </Button>
                        </p>
                      </div>
                    </Collapse>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
