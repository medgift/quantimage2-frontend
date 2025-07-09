import React, { useMemo, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';
import Backend from '../services/backend';

const ROCCurveComponent = ({ 
  selectedModel, 
  selectedModels, 
  plotType, 
  threshold = 0.5, 
  height = 500, 
  onClose, 
  hideContainer = false, 
  token 
}) => {
  const rocPlotRef = useRef(null);
  const rocDivRef = useRef(null);
  const [rocData, setRocData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Determine which models to process - priority: selectedModels > selectedModel
  const modelsToProcess = useMemo(() => {
    if (selectedModels && Array.isArray(selectedModels) && selectedModels.length > 0) {
      return selectedModels;
    } else if (selectedModel && selectedModel.id) {
      return [selectedModel.id];
    }
    return [];
  }, [selectedModels, selectedModel]);

  // DEBUG: Add console logs to see what props are being passed
  useEffect(() => {
    console.log('=== ROC Component Props Debug ===');
    console.log('selectedModel:', selectedModel);
    console.log('selectedModels:', selectedModels);
    console.log('modelsToProcess:', modelsToProcess);
    console.log('token exists:', !!token);
    console.log('plotType:', plotType);
    console.log('=== End Props Debug ===');
  }, [selectedModel, selectedModels, modelsToProcess, token, plotType]);

  // Fetch ROC curve data from backend when models or plotType changes
  useEffect(() => {
    console.log('=== useEffect triggered ===');
    console.log('modelsToProcess:', modelsToProcess);
    console.log('token check:', !!token);
    
    if (!modelsToProcess || modelsToProcess.length === 0 || !token) {
      console.log('Conditions not met - clearing rocData');
      setRocData(null);
      return;
    }

    console.log('All conditions met - fetching ROC data...');

    const fetchROCData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('=== Starting API Call ===');
        console.log('Models to process:', modelsToProcess);
        console.log('Plot Type:', plotType);
        
        let response;
        if (plotType === 'test') {
          console.log('Calling getROCCurveTestData...');
          response = await Backend.getROCCurveTestData(token, modelsToProcess);
        } else if (plotType === 'train') {
          console.log('Calling getROCCurveTrainData...');
          response = await Backend.getROCCurveTrainData(token, modelsToProcess);
        } else {
          console.log('Default to test data...');
          response = await Backend.getROCCurveTestData(token, modelsToProcess);
        }

        console.log('=== API Response ===');
        console.log('Response:', response);
        console.log('Response is array:', Array.isArray(response));
        console.log('Response length:', response?.length);

        if (response && Array.isArray(response) && response.length > 0) {
  console.log('Setting ROC data with', response.length, 'models');
  console.log('ROC Response Data:', response); // ADD THIS LINE
  console.log('First model data:', response[0]); // ADD THIS LINE
  setRocData(response);
} else {
          console.log('No valid data in response');
          setError('No ROC data returned from server');
        }
      } catch (err) {
        console.error('=== Error fetching ROC data ===');
        console.error('Error object:', err);
        console.error('Error message:', err.message);
        setError(err.message || 'Failed to fetch ROC curve data');
      } finally {
        setLoading(false);
      }
    };

    fetchROCData();
  }, [modelsToProcess, plotType, token]);

  // Calculate current threshold point on ROC curve for single model
  const currentROCPoint = useMemo(() => {
    if (!rocData || !threshold || rocData.length !== 1 || !rocData[0].thresholds) return null;
    
    const modelData = rocData[0];
    const { thresholds, fpr, tpr } = modelData;
    
    // Find the closest threshold index
    let closestIdx = 0;
    let minDiff = Math.abs(thresholds[0] - threshold);
    
    for (let i = 1; i < thresholds.length; i++) {
      const diff = Math.abs(thresholds[i] - threshold);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    return { 
      fpr: fpr[closestIdx], 
      tpr: tpr[closestIdx] 
    };
  }, [rocData, threshold]);

  // Create/Update ROC Plot using Plotly
  useEffect(() => {
    if (!rocData || !rocDivRef.current || loading) return;
    
    const traces = [];
    const colors = ['#2E86AB', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#9b59b6']; // Multiple colors

    // Create traces for each model
    rocData.forEach((modelData, index) => {
      console.log(`Processing model ${modelData.model_id}:`, modelData);
      if (modelData.error) {
        console.warn(`Skipping model ${modelData.model_id} due to error: ${modelData.error}`);
        return;
      }
        // ADD THESE SAFETY CHECKS:
  if (!modelData.fpr || !modelData.tpr || modelData.fpr.length === 0 || modelData.tpr.length === 0) {
    console.warn(`Skipping model ${modelData.model_id} - missing or empty FPR/TPR data`);
    console.log('FPR:', modelData.fpr);
    console.log('TPR:', modelData.tpr);
    return;
  }
      const color = colors[index % colors.length];
      
      traces.push({
        x: modelData.fpr,
        y: modelData.tpr,
        mode: 'lines',
        name: `${modelData.model_name} (AUC = ${modelData.auc.toFixed(3)})`,
        line: { color: color, width: 3 },
        hovertemplate: `<b>${modelData.model_name}</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<br>AUC: ${modelData.auc.toFixed(3)}<extra></extra>`
      });
    });

    // Add random classifier line for reference
    traces.push({
      x: [0, 1],
      y: [0, 1],
      mode: 'lines',
      name: 'Random Classifier',
      line: { color: '#A23B72', width: 2, dash: 'dash' },
      hovertemplate: '<b>Random Classifier</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>'
    });

    // Add current threshold point (only for single model)
    if (rocData.length === 1 && currentROCPoint) {
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

    const isMultiModel = rocData.length > 1;
    const titleText = isMultiModel 
      ? `ROC Curve Comparison - ${plotType === 'train' ? 'Training' : 'Test'} Set (${rocData.length} models)`
      : `ROC Curve - ${plotType === 'train' ? 'Training' : 'Test'} Set (n=${rocData[0].n_samples})`;

    const layout = {
      title: {
        text: titleText,
        font: { size: 16, family: 'Arial, sans-serif' }
      },
      xaxis: {
        title: {
          text: 'False Positive Rate (1 - Specificity)',
          font: { size: 15, family: 'Arial, sans-serif' }
        },
        range: [0, 1],
        gridcolor: '#e1e5ea',
        zeroline: false
      },
      yaxis: {
        title: {
          text: 'True Positive Rate (Sensitivity)',
          font: { size: 15, family: 'Arial, sans-serif' }
        },
        range: [0, 1],
        gridcolor: '#e1e5ea',
        zeroline: false
      },
      showlegend: true,
      legend: {
        orientation: isMultiModel ? 'v' : 'h',
        x: isMultiModel ? 1.02 : 0,
        y: isMultiModel ? 1 : -0.25,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1
      },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',
      margin: { 
        l: 60, 
        r: isMultiModel ? 200 : 30, // More space for legend in multi-model
        t: 80, 
        b: isMultiModel ? 60 : 110 
      },
      height: height
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
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
  }, [rocData, threshold, currentROCPoint, plotType, height, loading]);

  // DEBUG: Show current state
  console.log('Current render state:', {
    hasModelsToProcess: modelsToProcess.length > 0,
    hasToken: !!token,
    loading,
    error,
    hasRocData: !!rocData,
    rocDataLength: rocData?.length || 0
  });

  // Loading state
  if (loading) {
    console.log('Rendering loading state');
    if (hideContainer) {
      return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: `${height}px` }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading ROC curve...</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header">
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          ROC Curve - Loading...
        </div>
        <div className="card-body d-flex justify-content-center align-items-center" style={{ height: `${height}px` }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading ROC curve...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    console.log('Rendering error state:', error);
    if (hideContainer) {
      return (
        <div className="alert alert-danger">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          Error loading ROC curve: {error}
          <br />
          <small>Debug: Check browser console for detailed error information</small>
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            <FontAwesomeIcon icon="chart-line" className="me-2" />
            ROC Curve - Error
          </div>
          {onClose && (
            <button className="btn btn-sm btn-secondary" onClick={onClose}>
              <FontAwesomeIcon icon="times" className="me-1" />
              Close
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="alert alert-danger">
            <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
            Error loading ROC curve: {error}
            <br />
            <small>Debug: Check browser console for detailed error information</small>
          </div>
        </div>
      </div>
    );
  }

  // No models selected
  if (!modelsToProcess || modelsToProcess.length === 0 || !token) {
    console.log('Rendering "no models selected" state');
    
    if (hideContainer) {
      return (
        <div className="alert alert-info">
          Please select model(s) to view the ROC curve.
          <br />
          <small>Debug: models={modelsToProcess.length}, token={!!token ? 'exists' : 'missing'}</small>
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header">
          ROC Curve
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            Please select model(s) to view the ROC curve.
            <br />
            <small>Debug: models={modelsToProcess.length}, token={!!token ? 'exists' : 'missing'}</small>
          </div>
        </div>
      </div>
    );
  }

  // No data available
  if (!rocData) {
    if (hideContainer) {
      return (
        <div className="alert alert-warning">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          No ROC data available for the selected model(s).
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            ROC Curve - {modelsToProcess.length} model(s)
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
            No ROC data available for the selected model(s).
          </div>
        </div>
      </div>
    );
  }

  // Render the plot
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

  const isMultiModel = rocData.length > 1;
  const headerTitle = isMultiModel 
    ? `ROC Curve Comparison (${rocData.length} models)`
    : `ROC Curve - ${rocData[0]?.model_name || 'Model'}`;

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          {headerTitle}
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