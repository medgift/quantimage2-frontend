import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Alert } from 'reactstrap';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';
import ModelsTable from './components/ModelsTable';
import ROCCurveComponent from './components/ROCCurveComponent';
import {
  CLASSIFICATION_COLUMNS,
  MODEL_TYPES,
  SURVIVAL_COLUMNS,
} from './config/constants';
import InteractivePredictionsPlot from './components/InteractivePredictionsPlot';

export default function ModelOverview({ albums }) {
  const navigate = useNavigate();

  const { keycloak } = useKeycloak();
  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [models, setModels] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [plotType, setPlotType] = useState('test');  const [plotError, setPlotError] = useState(null);
  const [isPlotting, setIsPlotting] = useState(false);  const [plotHtml, setPlotHtml] = useState(null);
  const [threshold, setThreshold] = useState(0.5);
  const [predictionMetrics, setPredictionMetrics] = useState(null);

  const { albumID } = useParams();
  const collectionColumn = useMemo(
    () => ({
      Header: 'Collection',
      accessor: (r) => {
        const collection = collections.find(
          (c) => c.id === r.feature_collection_id
        );

        return collection ? collection.name : '<original>';
      },
    }),
    [collections]
  );

  const modelIDColumn = useMemo(
    () => ({
      Header: 'Model ID',
      accessor: (r) => r.id,
    }),
    []
  );
  // Model table header
  const columnsClassification = React.useMemo(
    () => [modelIDColumn, collectionColumn, ...CLASSIFICATION_COLUMNS],
    [collectionColumn, modelIDColumn]
  );
  const columnsSurvival = React.useMemo(
    () => [modelIDColumn, collectionColumn, ...SURVIVAL_COLUMNS],
    [collectionColumn, modelIDColumn]
  );

  // Get feature extraction
  useEffect(() => {
    async function getExtraction() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      setFeatureExtractionID(latestExtraction.id);
    }

    getExtraction();
  }, [albumID, keycloak.token]);

  useEffect(() => {
    async function fetchModels() {
      let models = await Backend.models(keycloak.token, albumID);

      // Filter out models that are not for this collection / original feature set
      let filteredModels = models.filter(
        (m) => m.feature_extraction_id === featureExtractionID
      );

      let sortedModels = filteredModels.sort(
        (m1, m2) => new Date(m2.created_at) - new Date(m1.created_at)
      );

      setModels(sortedModels);
    }

    if (featureExtractionID) fetchModels();
  }, [keycloak.token, albumID, featureExtractionID]);

  // Get collections
  useEffect(() => {
    async function getCollections() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      const collections = await Backend.collectionsByExtraction(
        keycloak.token,
        latestExtraction.id
      );

      setCollections(collections.map((c) => c.collection));
    }

    getCollections();
  }, [albumID, keycloak.token]);

  const album = albums.find((a) => a.album_id === albumID);
  const handleDeleteModelClick = async (id) => {
    await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter((model) => model.id !== id));
    // Remove from selection if it was selected
    setSelectedModels(selectedModels.filter((modelId) => modelId !== id));
  };

  const handleModelSelectionChange = (newSelectedModels) => {
    setSelectedModels(newSelectedModels);
    setPlotError(null); // Clear any previous errors when selection changes
  };

  const handlePlotModels = async () => {
    if (selectedModels.length === 0) {
      setPlotError('Please select at least one model to plot');
      return;
    }

    if (selectedModels.length > 5) {
      setPlotError(
        'Please select no more than 5 models for better visualization'
      );
      return;
    }
    setIsPlotting(true);
    setPlotError(null);

    // Debug: Log what models are selected
    console.log('Selected models for plotting:', selectedModels);
    console.log('Selected models type:', typeof selectedModels);
    console.log('Selected models length:', selectedModels.length);

    try {
      let result;
      if (plotType === 'test') {
        result = await Backend.plotTestPredictions(
          keycloak.token,
          selectedModels
        );
      } else {
        result = await Backend.plotTrainPredictions(
          keycloak.token,
          selectedModels
        );
      }
      console.log('Backend result:', result);
      console.log('Backend result length:', result?.length);
      console.log('Backend result type:', typeof result);

      // Show debug info if available
      if (result?.debug) {
        console.log('Backend debug info:', result.debug);
        alert('Backend debug info:\n' + JSON.stringify(result.debug, null, 2));
      }

      // Check if result is directly an array of models (new backend format)
      if (Array.isArray(result) && result.length > 0) {
        setPlotHtml(result); // Store the array of models directly
      } else if (result && result.data) {
        // Fallback for old format with data property
        setPlotHtml(result.data);
      } else {
        setPlotError('No plot data received from backend');
      }
    } catch (error) {
      console.error('Plot error:', error);
      setPlotError(`Failed to generate plot: ${error.message}`);
    } finally {
      setIsPlotting(false);
    }
  };

  return (
    albums.length > 0 && (
      <div>
        <h1>
          Model Overview for <strong>{album.name}</strong> album
        </h1>
        <div
          className="d-flex flex-column justify-content-start align-items-start tab-content"
          style={{ borderTop: '1px solid #dee2e6' }}
        >
          <Button
            color="link"
            onClick={() => navigate(`/features/${albumID}/overview`)}
          >
            <FontAwesomeIcon icon="arrow-left" /> Go Back
          </Button>{' '}
          {models.length > 0 ? (
            <div style={{ width: '98%' }}>
              <ModelsTable
                title="Classification Models"
                columns={columnsClassification}
                data={models.filter(
                  (m) => m.type === MODEL_TYPES.CLASSIFICATION
                )}
                handleDeleteModelClick={handleDeleteModelClick}
                showComparisonButtons={true}
                selectedModels={selectedModels}
                onModelSelectionChange={handleModelSelectionChange}
                showSelection={true}
              />
              <ModelsTable
                title="Survival Models"
                columns={columnsSurvival}
                data={models.filter((m) => m.type === MODEL_TYPES.SURVIVAL)}
                handleDeleteModelClick={handleDeleteModelClick}
                showComparisonButtons={true}
                selectedModels={selectedModels}
                onModelSelectionChange={handleModelSelectionChange}
                showSelection={true}
              />

              {/* Unified Plotting Interface */}
              {selectedModels.length > 0 && (
                <div
                  style={{
                    marginTop: '30px',
                    padding: '20px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: '#f8f9fa',
                  }}
                >
                  <h5 style={{ marginBottom: '15px', color: '#495057' }}>
                    <FontAwesomeIcon icon="chart-line" className="me-2" />
                    Plot Selected Models ({selectedModels.length} selected)
                  </h5>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ marginRight: '15px', fontWeight: 'bold' }}>
                      Plot Type:
                    </label>
                    <label style={{ marginRight: '15px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="test"
                        checked={plotType === 'test'}
                        onChange={(e) => setPlotType(e.target.value)}
                        style={{ marginRight: '5px' }}
                      />
                      Test Predictions
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        value="train"
                        checked={plotType === 'train'}
                        onChange={(e) => setPlotType(e.target.value)}
                        style={{ marginRight: '5px' }}
                      />
                      Training Predictions
                    </label>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <Button
                      color="primary"
                      onClick={handlePlotModels}
                      disabled={isPlotting || selectedModels.length === 0}
                      style={{ marginRight: '10px' }}
                    >
                      {isPlotting ? (
                        <>
                          <FontAwesomeIcon
                            icon="spinner"
                            spin
                            className="me-2"
                          />
                          Generating Plot...
                        </>
                      ) : (
                        <>
                          Generate {plotType === 'test'
                            ? 'Test'
                            : 'Training'}{' '}
                          Plot
                        </>
                      )}
                    </Button>

                    <Button
                      color="secondary"
                      onClick={() => setSelectedModels([])}
                      disabled={isPlotting}
                    >
                      Clear Selection
                    </Button>
                  </div>

                  {plotError && (
                    <Alert color="danger" style={{ marginBottom: '10px' }}>
                      {plotError}
                    </Alert>
                  )}
                  <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                    <FontAwesomeIcon icon="info-circle" className="me-1" />
                    Select up to 5 models using the checkboxes above, then
                    choose plot type and generate visualization.
                  </div>
                </div>              )}              {/* Single Model Analysis with separate components */}
              {selectedModels.length === 1 && plotHtml && (
                <>
                  {/* Shared Threshold Control */}
                  <div className="card mt-3">
                    <div className="card-header">
                      <FontAwesomeIcon icon="sliders-h" className="me-2" />
                      Model Analysis Controls
                    </div>
                    <div className="card-body">
                      <div className="mb-3 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
                        <label htmlFor="threshold-slider" className="form-label mb-2">
                          <strong>🎯 Decision Threshold: {threshold.toFixed(3)}</strong>
                        </label>                        <input
                          id="threshold-slider"
                          type="range"
                          className="form-range"
                          min="0"
                          max="1"
                          step="0.001"
                          value={threshold}
                          onChange={(e) => setThreshold(parseFloat(e.target.value))}
                          style={{ width: '100%' }}
                        />                        <div className="d-flex justify-content-between mt-1">
                          <small className="text-muted">0.000</small>
                          <small className="text-muted">1.000</small>
                        </div>                      </div>
                    </div>
                  </div>                  {/* Performance Metrics */}
                  {predictionMetrics && (
                    <div className="performance-section">
                      <div className="section-header">
                        <h5>
                          <FontAwesomeIcon icon="chart-bar" className="me-2" />
                          Performance Metrics at Threshold {threshold.toFixed(3)}
                        </h5>
                      </div>
                      <div className="container-fluid">
                        <div className="row g-3">
                          <div className="col-lg-2 col-md-3 col-sm-4 col-6">
                            <div className="card h-100 metric-card-bootstrap">
                              <div className="card-body p-3">
                                <div className="metric-name-bootstrap text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '0.8125rem' }}>Accuracy</div>
                                <div className="text-center">
                                  <div className="fs-5 fw-bold text-dark">{predictionMetrics.accuracy.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-2 col-md-3 col-sm-4 col-6">
                            <div className="card h-100 metric-card-bootstrap">
                              <div className="card-body p-3">
                                <div className="metric-name-bootstrap text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '0.8125rem' }}>Precision</div>
                                <div className="text-center">
                                  <div className="fs-5 fw-bold text-dark">{predictionMetrics.precision.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-2 col-md-3 col-sm-4 col-6">
                            <div className="card h-100 metric-card-bootstrap">
                              <div className="card-body p-3">
                                <div className="metric-name-bootstrap text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '0.8125rem' }}>Recall</div>
                                <div className="text-center">
                                  <div className="fs-5 fw-bold text-dark">{predictionMetrics.recall.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-2 col-md-3 col-sm-4 col-6">
                            <div className="card h-100 metric-card-bootstrap">
                              <div className="card-body p-3">
                                <div className="metric-name-bootstrap text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '0.8125rem' }}>Specificity</div>
                                <div className="text-center">
                                  <div className="fs-5 fw-bold text-dark">{predictionMetrics.specificity.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-2 col-md-3 col-sm-4 col-6">
                            <div className="card h-100 metric-card-bootstrap">
                              <div className="card-body p-3">
                                <div className="metric-name-bootstrap text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '0.8125rem' }}>F1-Score</div>
                                <div className="text-center">
                                  <div className="fs-5 fw-bold text-dark">{predictionMetrics.f1.toFixed(3)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row mt-3">
                    {/* Interactive Predictions Plot */}
                    <div className="col-md-6">
                      <div className="card">                        <div className="card-header">
                          <FontAwesomeIcon icon="chart-line" className="me-2" />
                          Interactive Predictions - {models.find(m => m.id === selectedModels[0])?.name || `Model ${selectedModels[0]}`}
                        </div>
                        <div className="card-body p-0">                          <InteractivePredictionsPlot
                            modelsData={plotHtml}
                            plotType={plotType}
                            externalThreshold={threshold}
                            hideThresholdControl={true}
                            hideContainer={true}
                            externalHeight={500}
                            onClose={() => setPlotHtml(null)}
                            onMetricsUpdate={setPredictionMetrics}
                          />
                        </div>
                      </div>
                    </div>
                     
                    {/* ROC Curve Component */}
                    <div className="col-md-6">
                      <div className="card">                        <div className="card-header">
                          <FontAwesomeIcon icon="chart-bar" className="me-2" />
                          ROC Curve - {models.find(m => m.id === selectedModels[0])?.name || `Model ${selectedModels[0]}`}
                        </div>
                        <div className="card-body p-0">
                          <ROCCurveComponent
                            selectedModel={models.find(m => m.id === selectedModels[0])}
                            plotData={plotHtml}
                            plotType={plotType}
                            threshold={threshold}
                            height={500}
                            hideContainer={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Multi-model comparison plot */}
              {selectedModels.length > 1 && plotHtml && (
                <InteractivePredictionsPlot
                  modelsData={plotHtml}
                  plotType={plotType}
                  onClose={() => setPlotHtml(null)}
                />
              )}
            </div>
          ) : (
            <h2 className="align-self-stretch">No Models Created Yet</h2>
          )}
        </div>
      </div>
    )
  );
}
