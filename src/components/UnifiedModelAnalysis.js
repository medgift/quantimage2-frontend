import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';
import InteractivePredictionsPlot from './InteractivePredictionsPlot';

const UnifiedModelAnalysis = ({ selectedModel, plotData, plotType, onClose }) => {
  const [threshold, setThreshold] = useState(0.5);
  const [showROC, setShowROC] = useState(true);
  const [showPredictions, setShowPredictions] = useState(true);
  const [predictionMetrics, setPredictionMetrics] = useState(null);  const rocPlotRef = useRef(null);
  const rocDivRef = useRef(null);

  // Calculate shared height for both plots
  const plotHeight = useMemo(() => {
    if (!plotData || plotData.length === 0) return 500;
    return Math.max(500, plotData.length * 120 + 200);
  }, [plotData]);

  // Calculate ROC curve data from the plotData
  const rocData = useMemo(() => {
    if (!plotData || !selectedModel) return null;
    
    // Find the model data in plotData
    const modelData = plotData.find(m => m.model_id === selectedModel.id);
    if (!modelData || !modelData.patients) return null;
    
    const patients = modelData.patients;
    const predictions = patients.map(p => p.probability);
    const trueLabels = patients.map(p => p.ground_truth);
    
    // Generate thresholds from 0 to 1
    const thresholds = [];
    for (let i = 100; i >= 0; i--) {
      thresholds.push(i / 100);
    }
    
    // Calculate TPR and FPR for each threshold
    const fpr = [];
    const tpr = [];
    
    thresholds.forEach(thresh => {
      let tp = 0, fp = 0, tn = 0, fn = 0;
      
      for (let i = 0; i < predictions.length; i++) {
        const predicted = predictions[i] >= thresh ? 1 : 0;
        const actual = trueLabels[i];
        
        if (predicted === 1 && actual === 1) tp++;
        else if (predicted === 1 && actual === 0) fp++;
        else if (predicted === 0 && actual === 0) tn++;
        else if (predicted === 0 && actual === 1) fn++;
      }
      
      const tprValue = (tp + fn) > 0 ? tp / (tp + fn) : 0;
      const fprValue = (tn + fp) > 0 ? fp / (tn + fp) : 0;
      
      tpr.push(tprValue);
      fpr.push(fprValue);
    });
    
    // Calculate AUC using trapezoidal rule
    let auc = 0;
    for (let i = 1; i < fpr.length; i++) {
      auc += (fpr[i] - fpr[i-1]) * (tpr[i] + tpr[i-1]) / 2;
    }
    
    return {
      fpr,
      tpr,
      thresholds,
      auc: Math.abs(auc),
      predictions,
      trueLabels
    };
  }, [plotData, selectedModel]);

  // Calculate metrics for current threshold
  const currentMetrics = useMemo(() => {
    if (!rocData || !rocData.predictions || !rocData.trueLabels) {
      return null;
    }

    const predictions = rocData.predictions;
    const trueLabels = rocData.trueLabels;
    
    // Calculate confusion matrix for current threshold
    let tp = 0, fp = 0, tn = 0, fn = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i] >= threshold ? 1 : 0;
      const actual = trueLabels[i];
      
      if (predicted === 1 && actual === 1) tp++;
      else if (predicted === 1 && actual === 0) fp++;
      else if (predicted === 0 && actual === 0) tn++;
      else if (predicted === 0 && actual === 1) fn++;
    }
    
    const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    
    return {
      sensitivity: sensitivity.toFixed(3),
      specificity: specificity.toFixed(3),
      precision: precision.toFixed(3),
      accuracy: accuracy.toFixed(3),
      tp, fp, tn, fn
    };
  }, [rocData, threshold]);

  // Find closest point on ROC curve for current threshold
  const currentROCPoint = useMemo(() => {
    if (!rocData || !currentMetrics) return null;
    
    const fpr = 1 - parseFloat(currentMetrics.specificity);
    const tpr = parseFloat(currentMetrics.sensitivity);
    
    return { fpr, tpr };
  }, [rocData, currentMetrics]);  // Create/Update ROC Plot using Plotly
  useEffect(() => {
    if (!rocData || !rocDivRef.current || !showROC) return;
    
    const traces = [
      {
        x: rocData.fpr,
        y: rocData.tpr,
        mode: 'lines',
        name: 'ROC Curve',
        line: { color: '#2E86AB', width: 3 },
        hovertemplate: '<b>ROC Curve</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>'
      },
      {
        x: [0, 1],
        y: [0, 1],
        mode: 'lines',
        name: 'Random Classifier',
        line: { color: '#A23B72', width: 2, dash: 'dash' },
        hovertemplate: '<b>Random Classifier</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>'
      }
    ];

    // Add current threshold point
    if (currentROCPoint) {
      traces.push({
        x: [currentROCPoint.fpr],
        y: [currentROCPoint.tpr],
        mode: 'markers',
        name: `Threshold ${threshold.toFixed(3)}`,
        marker: {
          color: '#F18F01',
          size: 12,
          line: { color: '#ffffff', width: 2 }
        },
        hovertemplate: `<b>Current Operating Point</b><br>Threshold: ${threshold.toFixed(3)}<br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>`
      });
    }

    const layout = {
      title: {
        text: `ROC Curve - ${selectedModel?.name || 'Model'} (${plotType.charAt(0).toUpperCase() + plotType.slice(1)})`,
        font: { size: 16, family: 'Arial, sans-serif' }
      },
      xaxis: {
        title: 'False Positive Rate (1 - Specificity)',
        range: [0, 1],
        gridcolor: '#e1e5ea',
        zeroline: false
      },
      yaxis: {
        title: 'True Positive Rate (Sensitivity)',
        range: [0, 1],
        gridcolor: '#e1e5ea',
        zeroline: false      },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.1,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1
      },      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',      margin: { l: 60, r: 30, t: 80, b: 80 },
      height: plotHeight
    };const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };

    if (rocPlotRef.current) {
      // Update existing plot
      Plotly.react(rocDivRef.current, traces, layout, config);
    } else {
      // Create new plot
      Plotly.newPlot(rocDivRef.current, traces, layout, config).then((plot) => {
        rocPlotRef.current = plot;
      });
    }  }, [rocData, threshold, currentROCPoint, selectedModel, plotType, showROC, plotHeight]);
  if (!selectedModel || !plotData) {
    return (
      <div className="card mt-3">
        <div className="card-header">
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          Model Analysis
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            Please select a model and generate predictions to view the analysis.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          Interactive Model Analysis - {selectedModel.name || `Model ${selectedModel.id}`}
        </div>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>
          <FontAwesomeIcon icon="times" className="me-1" />
          Close
        </button>
      </div>
      
      <div className="card-body">
        {!rocData && (
          <div className="alert alert-warning">
            <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
            No prediction data available for analysis.
          </div>
        )}        {rocData && (
          <>
            {/* Plot Toggle Controls */}
            <div className="mb-3 d-flex gap-2">
              <button
                className={`btn ${showROC ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setShowROC(!showROC)}
              >
                <FontAwesomeIcon icon="chart-line" className="me-1" />
                ROC Curve
              </button>
              <button
                className={`btn ${showPredictions ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setShowPredictions(!showPredictions)}
              >
                <FontAwesomeIcon icon="scatter-chart" className="me-1" />
                Predictions Plot
              </button>
            </div>

            {/* Unified Threshold Control */}
            <div className="mb-4 p-3" style={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #007bff' }}>
              <div className="row align-items-center">
                <div className="col-md-12">
                  <label htmlFor="unified-threshold-slider" className="form-label mb-2">
                    <strong>🎯 Decision Threshold: {threshold.toFixed(3)}</strong>
                  </label>
                  <input
                    id="unified-threshold-slider"
                    type="range"
                    className="form-range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div className="d-flex justify-content-between mt-1">
                    <small className="text-muted">0.00</small>
                    <small className="text-muted">1.00</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            

            {/* Performance Metrics from Interactive Plot */}
            {predictionMetrics && (
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9ff', borderRadius: '8px', border: '1px solid #007bff' }}>
                <h6 style={{ color: '#007bff', fontWeight: 'bold', marginBottom: '15px' }}>Performance Metrics</h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Accuracy:</span>
                    <span style={{ fontWeight: 'bold', color: '#28a745' }}>{predictionMetrics.accuracy.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Precision:</span>
                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>{predictionMetrics.precision.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Recall:</span>
                    <span style={{ fontWeight: 'bold', color: '#6610f2' }}>{predictionMetrics.recall.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Specificity:</span>
                    <span style={{ fontWeight: 'bold', color: '#6c757d' }}>{predictionMetrics.specificity.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>F1-Score:</span>
                    <span style={{ fontWeight: 'bold', color: '#fd7e14' }}>{predictionMetrics.f1.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}            {/* Visualizations */}
            <div className="row">
              {showPredictions && (
                <div className={showROC ? "col-md-6" : "col-md-12"}>
                  <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>                    <InteractivePredictionsPlot
                      modelsData={plotData}
                      plotType={plotType}
                      externalThreshold={threshold}
                      hideThresholdControl={true}
                      hideContainer={true}
                      onClose={() => {}}
                      onMetricsUpdate={setPredictionMetrics}
                      externalHeight={plotHeight}
                    />
                  </div>
                </div>
              )}                {showROC && (
                <div className={showPredictions ? "col-md-6" : "col-md-12"}>
                  <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>                    <div 
                      ref={rocDivRef}
                      style={{ 
                        width: '100%', 
                        height: `${plotHeight}px`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>          </>
        )}
      </div>
    </div>
  );
};

export default UnifiedModelAnalysis;
