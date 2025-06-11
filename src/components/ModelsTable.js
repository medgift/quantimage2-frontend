import { useSortBy, useTable } from 'react-table';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Table,
  UncontrolledTooltip,
  Badge,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

import { DATA_SPLITTING_TYPES } from '../config/constants';
import MyModal from './MyModal';
import ListValues from './ListValues';
import { formatMetric } from '../utils/feature-utils';
import { saveAs } from 'file-saver';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './ModelsTable.css';
const MetricsComparison = ({ trainingMetrics, testMetrics, showTest }) => {
  const metricDefinitions = {
    auc: {
      name: 'AUC',
      icon: 'chart-area',
    },
    accuracy: {
      name: 'Accuracy',
      icon: 'bullseye',
    },
    precision: {
      name: 'Precision',
      icon: 'crosshairs',
    },
    sensitivity: {
      name: 'Sensitivity',
      icon: 'radar',
    },
    specificity: {
      name: 'Specificity',
      icon: 'shield-alt',
    },
  };

  // Function to determine color based on comparison
  const getComparisonClass = (value1, value2, isFirst) => {
    const diff = Math.abs(value1 - value2);
    // If difference is less than 0.001, consider them equal
    if (diff < 0.001) return 'equal';

    if (isFirst) {
      return value1 > value2 ? 'higher' : 'lower';
    } else {
      return value2 > value1 ? 'higher' : 'lower';
    }
  };

  return (
    <div className="metrics-modern-container">
      <div className="metrics-grid-modern">
        {Object.keys(metricDefinitions).map((metricKey) => {
          const def = metricDefinitions[metricKey];
          const trainMetric = trainingMetrics[metricKey];
          const testMetric = testMetrics?.[metricKey];

          if (!trainMetric && !testMetric) return null;

          const trainValue = trainMetric?.mean || trainMetric?.value || 0;
          const testValue = testMetric?.mean || testMetric?.value || 0;

          return (
            <div key={metricKey} className="metric-tile">
              <div className="metric-header">
                <FontAwesomeIcon
                  icon={def.icon}
                  className="metric-icon-small"
                />
                <span className="metric-name-small">{def.name}</span>
              </div>

              <div className="metric-values-compact">
                <div
                  className={`metric-value-item ${
                    showTest && testMetric
                      ? getComparisonClass(trainValue, testValue, true)
                      : ''
                  }`}
                >
                  <span className="value">{trainValue.toFixed(3)}</span>
                  <span className="label">Train</span>
                </div>

                {showTest && testMetric && (
                  <>
                    <div className="metric-separator"></div>
                    <div
                      className={`metric-value-item ${getComparisonClass(
                        trainValue,
                        testValue,
                        false
                      )}`}
                    >
                      <span className="value">{testValue.toFixed(3)}</span>
                      <span className="label">Test</span>
                    </div>
                  </>
                )}
              </div>

              {showTest && testMetric && (
                <div className="metric-diff">
                  <span
                    className={
                      testValue >= trainValue ? 'positive' : 'negative'
                    }
                  >
                    {testValue >= trainValue ? '+' : ''}
                    {trainValue !== 0
                      ? (((testValue - trainValue) / trainValue) * 100).toFixed(
                          1
                        )
                      : '0.0'}
                    %
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
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
  let [isCompareModelCorrectMessage, setIsCompareModelCorrectMessage] =
    useState('');

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
    // This function is not used with the new design
    return null;
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
        <div className="detail-row">
          <span className="detail-label">Training Set:</span>
          <span className="detail-value">
            {trainingPatientIDs.length} observations
            <Button
              color="link"
              size="sm"
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
              className="ms-2 p-0"
            >
              View IDs
            </Button>
          </span>
        </div>
        {isTrainTest && (
          <div className="detail-row">
            <span className="detail-label">Test Set:</span>
            <span className="detail-value">
              {row.original.test_patient_ids.length} observations
              <Button
                color="link"
                size="sm"
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
                className="ms-2 p-0"
              >
                View IDs
              </Button>
            </span>
          </div>
        )}
      </>
    );
  };
  const [configOpen, setConfigOpen] = useState(false);

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
      compareModelsArray = compareModelsValue
        .split(',')
        .filter(Number)
        .map(Number);
      if (compareModelsArray.length !== compareModelsValue.split(',').length) {
        setIsCompareModelCorrect(false);
        setIsCompareModelCorrectMessage(
          'Was not able to concert comma separated string to a list of number - please provide a list such as 1, 2, 3'
        );
      } else if (compareModelsArray.length === 1) {
        setIsCompareModelCorrect(false);
        setIsCompareModelCorrectMessage('Please provide more than one model');
      } else {
        for (const selectedModelTocompare of compareModelsArray) {
          if (!modelIds.includes(selectedModelTocompare)) {
            setIsCompareModelCorrect(false);
            setIsCompareModelCorrectMessage(
              `Please select models that exist - got ${selectedModelTocompare}`
            );
            existingModelsSelected = false;
          }
        }
        if (existingModelsSelected) {
          setIsCompareModelCorrect(true);
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
          {showComparisonButtons && (
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
                  fontSize: '14px',
                }}
              />
              <span className="button-spacer">
                {' '}
                {/* Empty spacer element */}
              </span>
              <Button
                size="sm"
                className="compare_button"
                onClick={handleCompareModels}
              >
                <FontAwesomeIcon icon="file-export" /> Compare Models
                (Classification Only)
              </Button>
            </>
          )}
          <Button
            size="sm"
            color="link"
            className="export-link"
            onClick={handleExportCSV}
          >
            <FontAwesomeIcon icon="file-export" /> Export as CSV
          </Button>
          {!isCompareModelCorrect && (
            <Alert color="danger">{isCompareModelCorrectMessage}</Alert>
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
                        {/* Performance Metrics Section */}
                        <div className="performance-section">
                          <div className="section-header">
                            <h5>
                              <FontAwesomeIcon
                                icon="tachometer-alt"
                                className="me-2"
                              />
                              Performance Metrics
                            </h5>
                          </div>

                          <MetricsComparison
                            trainingMetrics={row.original.training_metrics}
                            testMetrics={row.original.test_metrics}
                            showTest={
                              row.original.data_splitting_type ===
                              DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT
                            }
                          />

                          {row.original.data_splitting_type ===
                            DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT &&
                            row.original.test_bootstrap_values && (
                              <div className="performance-actions">
                                <Button
                                  size="sm"
                                  color="light"
                                  onClick={() =>
                                    handleDownloadTestBootstrapValues(
                                      row.original.id
                                    )
                                  }
                                >
                                  <FontAwesomeIcon icon="download" size="sm" />{' '}
                                  Bootstrap
                                </Button>
                                <Button
                                  size="sm"
                                  color="light"
                                  onClick={() =>
                                    handleDownloadTestScoresValues(
                                      row.original.id
                                    )
                                  }
                                >
                                  <FontAwesomeIcon icon="download" size="sm" />{' '}
                                  Scores
                                </Button>
                                <Button
                                  size="sm"
                                  color="light"
                                  onClick={() =>
                                    handleDownloadTestFeatureImportances(
                                      row.original.id
                                    )
                                  }
                                >
                                  <FontAwesomeIcon icon="download" size="sm" />{' '}
                                  Features
                                </Button>
                              </div>
                            )}
                        </div>

                        {/* Configuration Details Section */}
                        <details
                          className="configuration-details-accordion"
                          onToggle={(e) => setConfigOpen(e.target.open)}
                        >
                          <summary className="configuration-summary">
                            <FontAwesomeIcon
                              icon={configOpen ? 'minus-circle' : 'plus-circle'}
                              className="expand-icon"
                            />
                            <span>Configuration Details</span>
                          </summary>

                          <div className="configuration-section">
                            <div className="config-cards">
                              <div className="config-card">
                                <div className="config-card-header">
                                  <FontAwesomeIcon icon="info-circle" />
                                  <span>Model Info</span>
                                </div>
                                <div className="config-items">
                                  <div className="config-item">
                                    <span className="config-label">
                                      Created
                                    </span>
                                    <span className="config-value">
                                      {new Date(
                                        row.original.created_at
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="config-item">
                                    <span className="config-label">Type</span>
                                    <span className="config-value">
                                      {row.original.type}
                                    </span>
                                  </div>
                                  <div className="config-item">
                                    <span className="config-label">
                                      Algorithm
                                    </span>
                                    <span className="config-value">
                                      {row.original.best_algorithm}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="config-card">
                                <div className="config-card-header">
                                  <FontAwesomeIcon icon="database" />
                                  <span>Data Processing</span>
                                </div>
                                <div className="config-items">
                                  <div className="config-item">
                                    <span className="config-label">
                                      Normalization
                                    </span>
                                    <span className="config-value">
                                      {row.original.best_data_normalization ||
                                        'None'}
                                    </span>
                                  </div>
                                  <div className="config-item">
                                    <span className="config-label">
                                      Features
                                    </span>
                                    <span className="config-value">
                                      <Badge color="secondary">
                                        {row.original.feature_names.length}
                                      </Badge>
                                      <Button
                                        color="link"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleShowFeatureNames(
                                            row.original.feature_names
                                          );
                                        }}
                                        className="p-0 ms-2"
                                      >
                                        View
                                      </Button>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="config-card">
                                <div className="config-card-header">
                                  <FontAwesomeIcon icon="check-double" />
                                  <span>Validation</span>
                                </div>
                                <div className="config-items">
                                  <div className="config-item">
                                    <span className="config-label">
                                      Strategy
                                    </span>
                                    <span className="config-value">
                                      {row.original.data_splitting_type ===
                                      DATA_SPLITTING_TYPES.FULL_DATASET
                                        ? 'Cross-validation'
                                        : 'Train/Test Split'}
                                    </span>
                                  </div>
                                  <div className="config-item">
                                    <span className="config-label">
                                      Training
                                    </span>
                                    <span className="config-value">
                                      {row.original.training_validation ||
                                        'Default'}
                                    </span>
                                  </div>
                                  {row.original.data_splitting_type ===
                                    DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                    <div className="config-item">
                                      <span className="config-label">Test</span>
                                      <span className="config-value">
                                        {row.original.test_validation ||
                                          'Bootstrap'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="config-card">
                                <div className="config-card-header">
                                  <FontAwesomeIcon icon="users" />
                                  <span>Dataset</span>
                                </div>
                                <div className="config-items">
                                  <div className="config-item">
                                    <span className="config-label">
                                      Training
                                    </span>
                                    <span className="config-value">
                                      <Badge color="primary">
                                        {
                                          row.original.training_patient_ids
                                            .length
                                        }
                                      </Badge>
                                      <Button
                                        color="link"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleShowPatientIDs(
                                            row.original.training_patient_ids
                                          );
                                        }}
                                        className="p-0 ms-2"
                                      >
                                        IDs
                                      </Button>
                                    </span>
                                  </div>
                                  {row.original.data_splitting_type ===
                                    DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                    <div className="config-item">
                                      <span className="config-label">Test</span>
                                      <span className="config-value">
                                        <Badge color="success">
                                          {row.original.test_patient_ids.length}
                                        </Badge>
                                        <Button
                                          color="link"
                                          size="sm"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            handleShowPatientIDs(
                                              row.original.test_patient_ids
                                            );
                                          }}
                                          className="p-0 ms-2"
                                        >
                                          IDs
                                        </Button>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </details>

                        {/* Actions */}
                        <div className="model-actions">
                        <Button
  size="sm"
  color="danger"
  onClick={() =>
    handleDeleteModelClick(row.original.id)
  }
  className="ms-2"
  title="Delete this model permanently"
>
  <FontAwesomeIcon icon={faTrash} />{' '}
  Delete
</Button>
                        </div>
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
