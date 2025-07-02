import { useSortBy, useTable } from 'react-table';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Table,
  Badge,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { DATA_SPLITTING_TYPES } from '../config/constants';
import MyModal from './MyModal';
import ListValues from './ListValues';
import FeatureImportanceModal from './FeatureImportanceModal';
import { saveAs } from 'file-saver';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './ModelsTable.css';
const MetricsComparison = ({ trainingMetrics, testMetrics, showTest, showTrainValues }) => {  
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
      icon: 'search-plus',
    },
    specificity: {
      name: 'Specificity',
      icon: 'filter',
    },
  };

  return (
    <div className="container-fluid">      
      <div className="row g-2 g-md-3">
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
            <div key={metricKey} className="col-12 col-sm-6 col-lg-4 col-xl">
              <div className="card h-100 metric-card-bootstrap position-relative">
                <div className="card-body p-2 p-md-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="metric-name-bootstrap text-uppercase fw-bold text-muted small">{def.name}</span>
                    {showTest && testMetric && showTrainValues && (
                      <span
                        className={`badge small ${
                          testValue >= trainValue ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {testValue >= trainValue ? '+' : ''}
                        {trainValue !== 0
                          ? (((testValue - trainValue) / trainValue) * 100).toFixed(
                              1
                            )
                          : '0.0'}
                        %
                      </span>
                    )}
                  </div>                  
                  {/* Stack values vertically on smaller screens, side by side on larger screens */}
                  <div className={`d-flex ${showTest && testMetric && showTrainValues ? 'flex-column flex-lg-row' : ''} align-items-center justify-content-center`}>
                    {/* Show test values first (primary) */}
                    {showTest && testMetric && (
                      <div className="text-center flex-fill mb-2 mb-lg-0">
                        <div className="fw-semibold text-primary metric-value-bold" style={{ fontSize: '0.9rem', lineHeight: '1.2' }}>
                          {formatValueWithRange(testMetric, testValue)}
                        </div>
                        <div className="text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>Test</div>
                      </div>
                    )}

                    {/* Show train values only when toggled or when there's no test data */}
                    {(showTrainValues || !showTest) && trainMetric && (
                      <>
                        {showTest && testMetric && showTrainValues && (
                          <div className="d-none d-lg-block vr mx-2" style={{ height: '40px' }}></div>
                        )}
                        <div className="text-center flex-fill">
                          <div className="fw-semibold text-primary metric-value-bold" style={{ fontSize: '0.9rem', lineHeight: '1.2' }}>
                            {formatValueWithRange(trainMetric, trainValue)}
                          </div>
                          <div className="text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>Train</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
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
  
  let [featureImportanceOpen, setFeatureImportanceOpen] = useState(false);
  let [featureImportanceModelId, setFeatureImportanceModelId] = useState(null);
  
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

  const toggleFeatureImportance = (modelId = null) => {
    setFeatureImportanceOpen((open) => !open);
    if (modelId) {
      setFeatureImportanceModelId(modelId);
    }
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
                                  {showTrainValues ? ' Hide' : ' Show'} Train Values
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
                                <Button
                                  size="sm"
                                  color="outline-primary"
                                  onClick={() => toggleFeatureImportance(row.original.id)}
                                  className="me-2"
                                >
                                  <FontAwesomeIcon 
                                    icon="chart-bar" 
                                    className="me-1" 
                                  />
                                  Feature Importance
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
                            <div className="row g-3">
                              <div className="col-md-6 col-lg-3">
                                <div className="card h-100">
                                  <div className="card-header bg-light">
                                    <span className="fw-semibold">Model Info</span>
                                  </div>
                                  <div className="card-body p-3">
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">
                                        Created
                                      </span>
                                      <span className="fw-medium small">
                                        {new Date(
                                          row.original.created_at
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">Type</span>
                                      <span className="fw-medium small">
                                        {row.original.type}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                      <span className="text-muted small">
                                        Algorithm
                                      </span>
                                      <span className="fw-medium small">
                                        {row.original.best_algorithm}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="col-md-6 col-lg-3">
                                <div className="card h-100">
                                  <div className="card-header bg-light">
                                    <span className="fw-semibold">Data Processing</span>
                                  </div>
                                  <div className="card-body p-3">
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">
                                        Normalization
                                      </span>
                                      <span className="fw-medium small">
                                        {row.original.best_data_normalization ||
                                          'None'}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                      <span className="text-muted small">
                                        Features
                                      </span>
                                      <span className="fw-medium small">
                                        <Badge color="secondary" className="me-1">
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
                                          className="p-0"
                                        >
                                          View
                                        </Button>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="col-md-6 col-lg-3">
                                <div className="card h-100">
                                  <div className="card-header bg-light">
                                    <span className="fw-semibold">Validation</span>
                                  </div>
                                  <div className="card-body p-3">
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">
                                        Strategy
                                      </span>
                                      <span className="fw-medium small">
                                        {row.original.data_splitting_type ===
                                        DATA_SPLITTING_TYPES.FULL_DATASET
                                          ? 'Cross-validation'
                                          : 'Train/Test Split'}
                                      </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">
                                        Training
                                      </span>
                                      <span className="fw-medium small">
                                        {row.original.training_validation ||
                                          'Default'}
                                      </span>
                                    </div>
                                    {row.original.data_splitting_type ===
                                      DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                      <div className="d-flex justify-content-between">
                                        <span className="text-muted small">Test</span>
                                        <span className="fw-medium small">
                                          {row.original.test_validation ||
                                            'Bootstrap'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="col-md-6 col-lg-3">
                                <div className="card h-100">
                                  <div className="card-header bg-light">
                                    <span className="fw-semibold">Dataset</span>
                                  </div>
                                  <div className="card-body p-3">
                                    <div className="d-flex justify-content-between mb-2">
                                      <span className="text-muted small">
                                        Training
                                      </span>
                                      <span className="fw-medium small">
                                        <Badge color="secondary" className="me-1">
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
                                          className="p-0"
                                        >
                                          View
                                        </Button>
                                      </span>
                                    </div>
                                    {row.original.data_splitting_type ===
                                      DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
                                      <div className="d-flex justify-content-between">
                                        <span className="text-muted small">Test</span>
                                        <span className="fw-medium small">
                                          <Badge color="secondary" className="me-1">
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
                                            className="p-0"
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
  <FontAwesomeIcon icon="trash-alt" />{' '}
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
      <FeatureImportanceModal
        isOpen={featureImportanceOpen}
        toggle={() => toggleFeatureImportance()}
        modelId={featureImportanceModelId}
      />
    </>
  );
}
