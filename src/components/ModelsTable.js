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
import { saveAs } from 'file-saver';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './ModelsTable.css';
const MetricsComparison = ({ trainingMetrics, testMetrics, showTest, showTrainValues }) => {  
  const metricDefinitions = {
    auc: {
      name: 'AUC',
    },
    accuracy: {
      name: 'Accuracy',
    },
    precision: {
      name: 'Precision',
    },
    sensitivity: {
      name: 'Sensitivity',
    },
    specificity: {
      name: 'Specificity',
    },
  };

  return (
    <div className="metrics-modern-container">      
      <div className="metrics-grid-modern">
        {Object.keys(metricDefinitions).map((metricKey) => {
          const def = metricDefinitions[metricKey];
          const trainMetric = trainingMetrics[metricKey];
          const testMetric = testMetrics?.[metricKey];

          if (!trainMetric && !testMetric) return null;          const trainValue = trainMetric?.mean || trainMetric?.value || 0;
          const testValue = testMetric?.mean || testMetric?.value || 0;          // Format value with range for AUC
          const formatValueWithRange = (metric, value) => {
            if (metricKey === 'auc' && metric) {
              // Use inf_value and sup_value for confidence intervals
              const lowerCI = metric.inf_value;
              const upperCI = metric.sup_value;
              
              if (lowerCI !== undefined && upperCI !== undefined) {
                return `${value.toFixed(3)} [${lowerCI.toFixed(3)}-${upperCI.toFixed(3)}]`;
              }
            }
            return value.toFixed(3);
          };

          return (
            <div key={metricKey} className="metric-tile">
              <div className="metric-header">
                <FontAwesomeIcon
                  icon={def.icon}
                  className="metric-icon-small"
                />
                <span className="metric-name-small">{def.name}</span>
              </div>              <div className="metric-values-compact">
                {/* Show test values first (primary) */}
                {showTest && testMetric && (
                  <div className="metric-value-item">
                    <span className="value">{formatValueWithRange(testMetric, testValue)}</span>
                    <span className="label">Test</span>
                  </div>
                )}

                {/* Show train values only when toggled or when there's no test data */}
                {(showTrainValues || !showTest) && trainMetric && (
                  <>
                    {showTest && testMetric && <div className="metric-separator"></div>}
                    <div className="metric-value-item">
                      <span className="value">{formatValueWithRange(trainMetric, trainValue)}</span>
                      <span className="label">Train</span>
                    </div>
                  </>
                )}
              </div>              {showTest && testMetric && showTrainValues && (
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
  selectedModels = [],
  onModelSelectionChange,
  showSelection = false,
}) {  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [patientIDs, setPatientIDs] = useState(null);
  let [patientIDsOpen, setPatientIDsOpen] = useState(false);
  let [isCompareModelCorrect, setIsCompareModelCorrect] = useState(true);
  let [isCompareModelCorrectMessage, setIsCompareModelCorrectMessage] =
    useState('');
  let [showTrainValues, setShowTrainValues] = useState(false);

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
  // Create columns with optional checkbox column
  const columnsWithSelection = React.useMemo(() => {
    // We're rendering the checkbox column manually, so just return the original columns
    return columns;
  }, [columns]);

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
      columns: columnsWithSelection,
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
        <thead>          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {showSelection && (
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        onModelSelectionChange(data.map(model => model.id));
                      } else {
                        onModelSelectionChange([]);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    checked={data.length > 0 && selectedModels.length === data.length}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              <th> </th>
              {headerGroup.headers.map((column) => {
                // Skip the checkbox column since we're rendering it manually above
                if (column.accessor === 'selection') return null;
                
                return (
                  <th {...column.getHeaderProps(column.canSort !== false ? column.getSortByToggleProps() : {})} key={column.id}>
                    {column.render('Header')}
                    {/* Add a sort direction indicator only for sortable columns */}
                    {column.canSort !== false && (
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
                    )}                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row, i) => {
            prepareRow(row);
            return (
              <React.Fragment key={row.getRowProps().key}>                <tr
                  {...row.getRowProps()}
                  className="model-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleModel(row.original.id)}
                >
                  {showSelection && (
                    <td style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(row.original.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const modelId = row.original.id;
                          if (e.target.checked) {
                            onModelSelectionChange([...selectedModels, modelId]);
                          } else {
                            onModelSelectionChange(selectedModels.filter(id => id !== modelId));
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ width: '40px' }} className="model-row-icon">
                    <FontAwesomeIcon
                      icon={
                        openModelID === row.original.id
                          ? 'minus-circle'
                          : 'plus-circle'
                      }
                    />
                  </td>                  {row.cells.map((cell) => {
                    return (
                      <td {...cell.getCellProps()} key={cell.column.id}>{cell.render('Cell')}</td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={columnsWithSelection.length + (showSelection ? 2 : 1)} style={{ padding: 0 }}>
                    <Collapse isOpen={openModelID === row.original.id}>
                      <div key={row.original.id} className="model-entry">                        {/* Performance Metrics Section */}
                        <div className="performance-section">
                          <div className="section-header">
                            <h3>
                              <FontAwesomeIcon
                                icon="tachometer-alt"
                                className="me-2"
                              />
                              Performance Metrics
                            </h3>
                          </div>

                          <MetricsComparison
                            trainingMetrics={row.original.training_metrics}
                            testMetrics={row.original.test_metrics}
                            showTest={
                              row.original.data_splitting_type ===
                              DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT
                            }
                            showTrainValues={showTrainValues}
                          />

                          {row.original.data_splitting_type ===
                            DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT &&
                            row.original.test_bootstrap_values && (
                              <div className="performance-actions">
                                <Button
                                  size="sm"
                                  color="outline-secondary"
                                  onClick={() => setShowTrainValues(!showTrainValues)}
                                  className="me-2"
                                >
                                  <FontAwesomeIcon 
                                    icon={showTrainValues ? "eye-slash" : "eye"} 
                                    className="me-1" 
                                  />
                                  {showTrainValues ? 'Hide' : 'Show'} Train Values
                                </Button>
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
                            <span>Meta information</span>
                          </summary>

                          <div className="configuration-section">
                            <div className="config-cards">
                              <div className="config-card">
                                <div className="config-card-header">
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
                                      <Badge color="secondary">
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
                                        View
                                      </Button>
                                    </span>
                                  </div>
                                  {row.original.data_splitting_type ===
                                    DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                    <div className="config-item">
                                      <span className="config-label">Test</span>
                                      <span className="config-value">
                                        <Badge color="secondary">
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
                                          View
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
