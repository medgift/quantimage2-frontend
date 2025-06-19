import React, { useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';

const ROCCurveComponent = ({ selectedModel, plotData, plotType, threshold = 0.5, height = 500, onClose, hideContainer = false }) => {
  const rocPlotRef = useRef(null);
  const rocDivRef = useRef(null);

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

  // Calculate current threshold point on ROC curve
  const currentROCPoint = useMemo(() => {
    if (!rocData || !threshold) return null;
    
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
    const fpr = 1 - specificity;
    const tpr = sensitivity;
    
    return { fpr, tpr };
  }, [rocData, threshold]);

  // Create/Update ROC Plot using Plotly
  useEffect(() => {
    if (!rocData || !rocDivRef.current) return;
    
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
        zeroline: false
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.1,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1
      },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',
      margin: { l: 60, r: 30, t: 80, b: 80 },
      height: height
    };

    const config = {
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
    }
  }, [rocData, threshold, currentROCPoint, selectedModel, plotType, height]);
  if (!selectedModel || !plotData) {
    if (hideContainer) {
      return (
        <div className="alert alert-info">
          Please select a model and generate predictions to view the ROC curve.
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header">
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          ROC Curve
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            Please select a model and generate predictions to view the ROC curve.
          </div>
        </div>
      </div>
    );
  }

  if (!rocData) {
    if (hideContainer) {
      return (
        <div className="alert alert-warning">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          No prediction data available for ROC analysis.
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            <FontAwesomeIcon icon="chart-line" className="me-2" />
            ROC Curve - {selectedModel.name || `Model ${selectedModel.id}`}
          </div>
          {onClose && (
            <button className="btn btn-sm btn-secondary" onClick={onClose}>
              <FontAwesomeIcon icon="times" className="me-1" />
              Close
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="alert alert-warning">
            <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
            No prediction data available for ROC analysis.
          </div>
        </div>
      </div>
    );
  }

  if (hideContainer) {
    return (
      <div 
        ref={rocDivRef}
        style={{ 
          width: '100%', 
          height: `${height}px`
        }}
      />
    );
  }

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          ROC Curve - {selectedModel.name || `Model ${selectedModel.id}`}
        </div>
        {onClose && (
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <FontAwesomeIcon icon="times" className="me-1" />
            Close
          </button>
        )}
      </div>
      <div className="card-body p-0">
        <div 
          ref={rocDivRef}
          style={{ 
            width: '100%', 
            height: `${height}px`
          }}
        />
      </div>
    </div>
  );
};

export default ROCCurveComponent;
