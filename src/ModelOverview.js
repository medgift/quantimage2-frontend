import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Alert, Modal, ModalHeader, ModalBody } from 'reactstrap';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';
import ModelsTable from './components/ModelsTable';
import ROCCurveComponent from './components/ROCCurveComponent';
import BootstrapHistogram from './components/BootstrapHistogram';
import {
  CLASSIFICATION_COLUMNS,
  MODEL_TYPES,
  SURVIVAL_COLUMNS,
} from './config/constants';
import InteractivePredictionsPlot from './components/InteractivePredictionsPlot';


export default function ModelOverview({ albums, showBackButton = true, initialModels = null }) {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const toggleHelpModal = () => setHelpModalOpen((open) => !open);
  const navigate = useNavigate();

  // Place help button absolutely at the top right, as in Visualisation.js
  // Render help button and modal at the top of the returned JSX
  // ...existing code...

  const { keycloak } = useKeycloak();
  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [models, setModels] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [plotType, setPlotType] = useState('test');  const [plotError, setPlotError] = useState(null);
  const [isPlotting, setIsPlotting] = useState(false);  const [plotHtml, setPlotHtml] = useState(null);
  const [threshold, setThreshold] = useState(0.5);
  const [predictionMetrics, setPredictionMetrics] = useState(null);
  const [multiModelMetrics, setMultiModelMetrics] = useState(null);

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
    if (initialModels) {
      // Use the models passed from parent (Features component)
      setModels(initialModels);
      return;
    }

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
  }, [keycloak.token, albumID, featureExtractionID, initialModels]);

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
    setPlotHtml(null); // Clear plot data when selection changes
    setPredictionMetrics(null); // Clear metrics when selection changes
    setMultiModelMetrics(null); // Clear multi-model metrics when selection changes
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
      <div className="position-relative">
        {/* Contextual Help Button (top right, absolute, as in Visualisation.js) */}
        <button
          type="button"
          className="btn btn-link position-absolute"
          style={{ top: 10, right: 18, zIndex: 10, fontSize: 22, color: '#007bff' }}
          aria-label="Help"
          onClick={toggleHelpModal}
        >
          <FontAwesomeIcon icon="question-circle" />
        </button>
        <Modal isOpen={helpModalOpen} toggle={toggleHelpModal} size="lg">
          <ModalHeader toggle={toggleHelpModal}>Help & Documentation</ModalHeader>
          <ModalBody>
            <h5 className="mb-3">How to Use This Page</h5>
            <ul>
              <li><strong>Model Tables:</strong> View all classification and survival models for the selected album. Use the checkboxes to select models for comparison and plotting.</li>
              <li><strong>Plot Selected Models:</strong> After selecting up to 5 models, choose the plot type (Test or Training Predictions) and click <span className="badge badge-primary">Generate Performances Plots</span> to visualize predictions and performance.</li>
              <li><strong>Single Model Analysis:</strong> When one model is selected, you can interactively adjust the decision threshold, view performance metrics, ROC curve, and bootstrap AUC analysis.</li>
              <li><strong>Multi-Model Comparison:</strong> When multiple models are selected, compare their predictions and AUC distributions side by side.</li>
              <li><strong>Delete Models:</strong> Use the trash icon in the table to remove unwanted models.</li>
            </ul>
            <h5 className="mt-4 mb-2">Troubleshooting & Tips</h5>
            <ul>
              <li>If no models appear, ensure you have run feature extraction and model training for this album.</li>
              <li>If a plot fails to load, try reducing the number of selected models or check for error messages in the alert banners.</li>
              <li>Hover over <FontAwesomeIcon icon="info-circle" style={{ color: '#007bff' }} /> icons for additional explanations and tooltips throughout the page.</li>
              <li><strong>Exporting Charts:</strong> Each chart includes a built-in screenshot tool (camera icon) in the toolbar. Click it to quickly export the current chart as a PNG image, which you can easily paste into papers or presentations.</li>
            </ul>
            <h5 className="mt-4 mb-2">Performance Metrics Explained</h5>
            <ul>
              <li><strong>Accuracy:</strong> Proportion of correct predictions among all cases.</li>
              <li><strong>Precision:</strong> Proportion of positive identifications that were actually correct.</li>
              <li><strong>Recall:</strong> Proportion of actual positives that were identified correctly.</li>
              <li><strong>Specificity:</strong> Proportion of actual negatives that were identified correctly.</li>
              <li><strong>F1-Score:</strong> Harmonic mean of precision and recall.</li>
              <li><strong>AUC:</strong> Area under the ROC curve, summarizing model discrimination ability.</li>
            </ul>
          </ModalBody>
        </Modal>

        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <h1 className="mb-4">
                Model Overview for <strong>{album.name}</strong> album
              </h1>
            </div>
          </div>
          
          {showBackButton && (
            <div className="row mb-3">
              <div className="col-12">
                <Button
                  color="link"
                  onClick={() => navigate(`/features/${albumID}/overview`)}
                  className="p-0"
                >
                  <FontAwesomeIcon icon="arrow-left" /> Go Back
                </Button>
              </div>
            </div>
          )}

          {models.length > 0 ? (
            <div className="row">
              <div className="col-12">
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
                            Generate Performances Plots
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
                  </div>              )}

                {/* Single Model Analysis */}
                {selectedModels.length === 1 && plotHtml && (
                  <>
                    {/* Shared Threshold Control */}
                    <div className="card mt-4">
                      <div className="card-header">
                        <h5 className="mb-0">Model Analysis Controls</h5>
                      </div>
                      <div className="card-body">
                        <div className="p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
                          <label htmlFor="threshold-slider" className="form-label mb-2">
                            Decision Threshold: <strong>{threshold.toFixed(3)}</strong>
                          </label>
                          <input
                            id="threshold-slider"
                            type="range"
                            className="form-range"
                            min="0"
                            max="1"
                            step="0.001"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                          />
                          <div className="d-flex justify-content-between mt-1">
                            <small className="text-muted">0.000</small>
                            <small className="text-muted">1.000</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    {predictionMetrics && (
                      <div className="card mt-3">
                        <div className="card-header">
                          <h5 className="mb-0">
                            Performance Metrics at Threshold {threshold.toFixed(3)}
                          </h5>
                        </div>
                        <div className="card-body">
                          <div className="row g-3">
                            <div className="col-12 col-sm-6 col-lg-4 col-xl">
                              <div className="card h-100 border-primary">
                                <div className="card-body text-center">
                                  <span className="text-uppercase fw-bold text-muted small d-block mb-2">Accuracy</span>
                                  <div className="fw-semibold text-primary" style={{ fontSize: '1.5rem' }}>
                                    {predictionMetrics.accuracy.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-12 col-sm-6 col-lg-4 col-xl">
                              <div className="card h-100 border-primary">
                                <div className="card-body text-center">
                                  <span className="text-uppercase fw-bold text-muted small d-block mb-2">Precision</span>
                                  <div className="fw-semibold text-primary" style={{ fontSize: '1.5rem' }}>
                                    {predictionMetrics.precision.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-12 col-sm-6 col-lg-4 col-xl">
                              <div className="card h-100 border-primary">
                                <div className="card-body text-center">
                                  <span className="text-uppercase fw-bold text-muted small d-block mb-2">Recall</span>
                                  <div className="fw-semibold text-primary" style={{ fontSize: '1.5rem' }}>
                                    {predictionMetrics.recall.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-12 col-sm-6 col-lg-4 col-xl">
                              <div className="card h-100 border-primary">
                                <div className="card-body text-center">
                                  <span className="text-uppercase fw-bold text-muted small d-block mb-2">Specificity</span>
                                  <div className="fw-semibold text-primary" style={{ fontSize: '1.5rem' }}>
                                    {predictionMetrics.specificity.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="col-12 col-sm-6 col-lg-4 col-xl">
                              <div className="card h-100 border-primary">
                                <div className="card-body text-center">
                                  <span className="text-uppercase fw-bold text-muted small d-block mb-2">F1-Score</span>
                                  <div className="fw-semibold text-primary" style={{ fontSize: '1.5rem' }}>
                                    {predictionMetrics.f1.toFixed(3)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Two-column layout for plots */}
                    <div className="row mt-3 g-3">
                      {/* Interactive Predictions Plot */}
                      <div className="col-md-6">
                        <div className="card h-100">
                          <div className="card-header">
                            <h6 className="mb-0">Interactive Predictions - {models.find(m => m.id === selectedModels[0])?.name || `Model ${selectedModels[0]}`}</h6>
                          </div>
                          <div className="card-body p-0">
                            <InteractivePredictionsPlot
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
                        <div className="card h-100">
                          <div className="card-header">
                            <h6 className="mb-0">ROC Curve - {models.find(m => m.id === selectedModels[0])?.name || `Model ${selectedModels[0]}`}</h6>
                          </div>
                          <div className="card-body p-0">
                            <ROCCurveComponent
                             selectedModels={selectedModels}
                              plotData={plotHtml}
                              plotType={plotType}
                              threshold={threshold}
                              height={500}
                              hideContainer={true}
                              token={keycloak.token}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bootstrap Analysis - Only show for Test Predictions */}
                    {plotType === 'test' && (
                      <div className="card mt-3">
                        <div className="card-header">
                          <h5 className="mb-0">Bootstrap Analysis - AUC Distribution</h5>
                        </div>
                        <div className="card-body">
                          <BootstrapHistogram
                            modelsData={plotHtml}
                            height={400}
                            metric="auc"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Multi-model comparison */}
                {selectedModels.length > 1 && plotHtml && (
                  <>
                    {/* Shared Threshold Control for Multiple Models */}
                    <div className="card mt-3">
                      <div className="card-header">
                        <h5>Multi-Model Analysis Controls</h5>
                      </div>
                      <div className="card-body">
                        <div className="mb-3 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
                          <label htmlFor="multi-threshold-slider" className="form-label mb-2">
                            Decision Threshold (Applied to All Models): {threshold.toFixed(3)}
                          </label>
                          <input
                            id="multi-threshold-slider"
                            type="range"
                            className="form-range"
                            min="0"
                            max="1"
                            step="0.001"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                          />
                          <div className="d-flex justify-content-between mt-1">
                            <small className="text-muted">0.000</small>
                            <small className="text-muted">1.000</small>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Two-column layout for multi-model plots */}
                    <div className="row mt-3 g-3">
                      {/* Interactive Predictions Plot */}
                      <div className="col-md-6">
                        <div className="card h-100">
                          <div className="card-header">
                            <h6 className="mb-0">Interactive Predictions Comparison ({selectedModels.length} models)</h6>
                          </div>
                          <div className="card-body p-0">
                            <InteractivePredictionsPlot
                              modelsData={plotHtml}
                              plotType={plotType}
                              externalThreshold={threshold}
                              onClose={() => setPlotHtml(null)}
                              hideThresholdControl={true}
                              hideContainer={true}
                              externalHeight={500}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* ROC Curve Component for Multiple Models */}
                      <div className="col-md-6">
                        <div className="card h-100">
                          <div className="card-header">
                            <h6 className="mb-0">ROC Curves Comparison ({selectedModels.length} models)</h6>
                          </div>
                          <div className="card-body p-0">
                            <ROCCurveComponent
                              selectedModels={selectedModels}
                              plotData={plotHtml}
                              plotType={plotType}
                              threshold={threshold}
                              height={500}
                              hideContainer={true}
                              token={keycloak.token}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bootstrap Analysis for Multiple Models - Only show for Test Predictions */}
                    {plotType === 'test' && (
                      <div className="card mt-3">
                        <div className="card-header">
                          <h5 className="mb-0">Bootstrap Analysis - AUC Distribution (Multiple Models)</h5>
                        </div>
                        <div className="card-body">
                          <BootstrapHistogram
                            modelsData={plotHtml}
                            height={400}
                            metric="auc"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-12 text-center py-5">
                <h2>No Models Created Yet</h2>
                <p className="text-muted">Train some models to see them here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  );
}
