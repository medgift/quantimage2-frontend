import { useSortBy, useTable } from 'react-table';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Collapse, Table, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DATA_SPLITTING_TYPES } from '../config/constants';
import MyModal from './MyModal';
import ListValues from './ListValues';
import { formatMetric } from '../utils/feature-utils';
import { saveAs } from 'file-saver';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './ModelsTable.css';

export default function ModelsTable({
  title,
  columns,
  data,
  handleDeleteModelClick,
  showComparisonButtons = false,
}) {
  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [patientIDs, setPatientIDs] = useState(null);
  let [patientIDsOpen, setPatientIDsOpen] = useState(false);
  let [isCompareModelCorrect, setIsCompareModelCorrect] = useState(true);
  let [isCompareModelCorrectMessage, setIsCompareModelCorrectMessage] = useState("");

  const { keycloak } = useKeycloak();

  const toggleFeatureNames = () => {
    setFeatureNamesOpen((open) => !open);
  };

  const togglePatientIDs = () => {
    setPatientIDsOpen((open) => !open);
  };

  const handleShowFeatureNames = (names) => {
    setFeatureNames(names);
    toggleFeatureNames();
  };

  const handleShowPatientIDs = (ids) => {
    setPatientIDs(ids);
    togglePatientIDs();
  };

  // Handle download test metrics values
  const handleDownloadTestBootstrapValues = async (modelID) => {
    let { filename, content } = await Backend.downloadTestMetricsValues(
      keycloak.token,
      modelID
    );

    saveAs(content, filename);
  };

  // Handle download test scores values
  const handleDownloadTestScoresValues = async (modelID) => {
    let { filename, content } = await Backend.downloadTestScoresValues(
      keycloak.token,
      modelID
    );

    saveAs(content, filename);
  };

    // Handle download test scores values
    const handleDownloadTestFeatureImportances = async (modelID) => {
      let { filename, content } = await Backend.downloadTestFeatureImportances(
        keycloak.token,
        modelID
      );
  
      saveAs(content, filename);
    };

  const formatMetrics = (metrics, mode) => {
    let sortedMetrics = Object.fromEntries(
      Object.entries(metrics).sort(([k1, v1], [k2, v2]) => v1.order - v2.order)
    );

    let formattedOtherMetrics = Object.keys(sortedMetrics).map((metricName) => (
      <tr key={metricName}>
        <td>
          <strong>{metricName}</strong>
        </td>
        <td>{formatMetric(metrics[metricName])}</td>
      </tr>
    ));

    return (
      <>
        <Table className="metrics-table">
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>
                Metric Value{' '}
                <FontAwesomeIcon
                  icon="question-circle"
                  id={`ciTooltip-${mode}`}
                  style={{ cursor: 'pointer' }}
                />
                <UncontrolledTooltip
                  placement="right"
                  target={`ciTooltip-${mode}`}
                >
                  Shows the mean value & 95% confidence interval
                </UncontrolledTooltip>
              </th>
            </tr>
          </thead>
          <tbody>{formattedOtherMetrics}</tbody>
        </Table>
      </>
    );
  };

  const {
    flatHeaders,
    flatRows,
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
      initialState: {
        sortBy: [{ id: 'created_at', desc: true }],
      },
    },
    useSortBy
  );

  const [openModelID, setOpenModelID] = useState(-1);

  // If only a single model, expand it by default
  useEffect(() => {
    if (rows.length === 1) {
      let modelID = rows[0].original.id;
      setOpenModelID(modelID);
    }
  }, [rows]);

  const toggleModel = (modelID) => {
    setOpenModelID((m) => (m !== modelID ? modelID : -1));
  };

  const generateNbObservations = (row) => {
    let isTrainTest =
      row.original.data_splitting_type ===
      DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT;

    let trainingPatientIDs = row.original.training_patient_ids;

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
              onClick={(event) => {
                event.preventDefault();
                handleShowPatientIDs(
                  trainingPatientIDs.sort((p1, p2) =>
                    p1.localeCompare(p2, undefined, {
                      numeric: true,
                      sensitivity: 'base',
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
                onClick={(event) => {
                  event.preventDefault();
                  handleShowPatientIDs(
                    row.original.test_patient_ids.sort((p1, p2) =>
                      p1.localeCompare(p2, undefined, {
                        numeric: true,
                        sensitivity: 'base',
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

  const handleExportCSV = () => {
    let header = flatHeaders.map((h) => h.Header);
    let rows = flatRows.map((row) =>
      flatHeaders.map((header) =>
        row.values[header.id].props
          ? `"${row.values[header.id].props.children.join('')}"`
          : `"${row.values[header.id]}"`
      )
    );

    let data = [header, ...rows];

    let dataString = data.map((row) => row.join(',')).join('\n');

    let blob = new Blob([dataString], {
      type: 'text/csv;charset=utf-8',
    });

    saveAs(blob, 'models-export.csv');
  };

  const [compareModelsValue, setCompareModelsValue] = useState(''); // State variable for input value

  const handleCompareModelsChange = (event) => {
    setCompareModelsValue(event.target.value); // Update state on input change
  };

  const handleCompareModels = async () => {
    let modelIds = data.map((item) => item.id);
    let existingModelsSelected = true;
    if (compareModelsValue != null) {
      let compareModelsArray = null;
      compareModelsArray = compareModelsValue.split(",").filter(Number).map(Number);
      if (compareModelsArray.length !== compareModelsValue.split(",").length) {
        setIsCompareModelCorrect(false)
        setIsCompareModelCorrectMessage("Was not able to concert comma separated string to a list of number - please provide a list such as 1, 2, 3")
      }  else if (compareModelsArray.length === 1){
        setIsCompareModelCorrect(false)
        setIsCompareModelCorrectMessage("Please provide more than one model")
      } else {
        for (const selectedModelTocompare of compareModelsArray) {
          if (!modelIds.includes(selectedModelTocompare)){
            setIsCompareModelCorrect(false)
            setIsCompareModelCorrectMessage(`Please select models that exist - got ${selectedModelTocompare}`)
            existingModelsSelected = false
          }              
        }        
        if (existingModelsSelected){
          setIsCompareModelCorrect(true)
          let { filename, content } = await Backend.compareModels(
            keycloak.token,
            compareModelsArray
          );
          saveAs(content, filename);
        }
      }
    }
  };

  if (data.length === 0) return null;

  return (
    <>
      <h4 className="mt-3">
        {title}{' '}
        <div className="button-container">
          {showComparisonButtons &&
            <> 
              <input
                type="text"
                value={compareModelsValue}
                placeholder="Enter 2 Model IDs (e.g. 1,2)"
                onChange={handleCompareModelsChange}
                style={{ 
                  marginRight: '10px',
                  width: '300px',
                  padding: '5px',
                  fontSize: '14px'
                }}
              />
              <span className="button-spacer">  {/* Add an empty spacer element */}
              </span>
              <Button
                size="sm"
                className='compare_button'
                onClick={handleCompareModels}
              >
                <FontAwesomeIcon icon="file-export" /> Compare Models (Classification Only)
              </Button>
            </>
          }
          <Button
            size="sm"
            color="link"
            className="export-link"
            onClick={handleExportCSV}
          >
            <FontAwesomeIcon icon="file-export" /> Export as CSV
          </Button>
          {!isCompareModelCorrect && (
                <Alert color="danger">
                  {isCompareModelCorrectMessage}
                </Alert>
          )}
        </div>
      </h4>
      <Table {...getTableProps()} className="m-3 models-summary">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              <th> </th>
              {headerGroup.headers.map((column) => (
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
                  className="model-row"
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
                  {row.cells.map((cell) => {
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
                                <td>Best Algorithm</td>
                                <td>{row.original.best_algorithm}</td>
                              </tr>
                              <tr>
                                <td>Best Data Normalization</td>
                                <td>
                                  {row.original.best_data_normalization
                                    ? row.original.best_data_normalization
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
                                <td>Features Used</td>
                                <td>
                                  {row.original.feature_names.length}
                                  {' - '}
                                  <Button
                                    color="link"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      handleShowFeatureNames(
                                        row.original.feature_names
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
                                    : 'Training/Test Split'}
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
                        <div className="d-flex justify-content-center">
                          <div>
                            <strong>
                              Model Metrics (Training - Cross-Validation)
                            </strong>
                            {formatMetrics(
                              row.original.training_metrics,
                              'training'
                            )}
                          </div>
                          {row.original.data_splitting_type ===
                            DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                              <>
                                <div className="ml-5">
                                  <strong>
                                    Model Metrics (Test - Bootstrap){' '}
                                    {row.original.test_bootstrap_values && (
                                      <>
                                        <Button
                                          size="sm"
                                          color="link"
                                          onClick={() =>
                                            handleDownloadTestBootstrapValues(
                                              row.original.id
                                            )
                                          }
                                        >
                                          <FontAwesomeIcon icon="download" />{' '}
                                          <span>Download bootstrap</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          color="link"
                                          onClick={() =>
                                            handleDownloadTestScoresValues(
                                              row.original.id
                                            )
                                          }
                                        >
                                          <FontAwesomeIcon icon="download" />{' '}
                                          <span>Download scores</span>
                                        </Button>
                                        <Button
                                          size="sm"
                                          color="link"
                                          onClick={() =>
                                            handleDownloadTestFeatureImportances(
                                              row.original.id
                                            )
                                          }
                                        >
                                          <FontAwesomeIcon icon="download" />{' '}
                                          <span>Download feature importances</span>
                                        </Button>
                                      </>
                                    )}
                                  </strong>
                                  {formatMetrics(
                                    row.original.test_metrics,
                                    'test'
                                  )}
                                </div>
                              </>
                            )}
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
      <MyModal
        isOpen={featureNamesOpen}
        toggle={toggleFeatureNames}
        title={<span>Feature Names</span>}
      >
        <ListValues values={featureNames} />
      </MyModal>
      <MyModal
        isOpen={patientIDsOpen}
        toggle={togglePatientIDs}
        title={<span>Patient IDs</span>}
      >
        <ListValues values={patientIDs} />
      </MyModal>
    </>
  );
}
