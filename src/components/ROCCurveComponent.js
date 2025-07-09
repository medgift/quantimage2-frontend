import React, { useMemo, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';
import Backend from '../services/backend';

const ROCCurveComponent = ({
  selectedModel,
  selectedModels,
  plotType,
  plotData,
  threshold = 0.5,
  height = 500,
  onClose,
  hideContainer = false,
  token,
}) => {
  const rocPlotRef = useRef(null);
  const rocDivRef = useRef(null);
  const [rocData, setRocData] = useState(null);
  const [error, setError] = useState(null);

  // Determine which models to process - priority: selectedModels > selectedModel
  const modelsToProcess = useMemo(() => {
    if (
      selectedModels &&
      Array.isArray(selectedModels) &&
      selectedModels.length > 0
    ) {
      return selectedModels;
    } else if (selectedModel && selectedModel.id) {
      return [selectedModel.id];
    }
    return [];
  }, [selectedModels, selectedModel]);

  // Fetch ROC curve data from backend when models or plotData changes
useEffect(() => {
  if (!modelsToProcess || modelsToProcess.length === 0 || !token) {
    setRocData(null);
    return;
  }

  if (!plotData || !Array.isArray(plotData) || plotData.length === 0) {
    setRocData(null);
    return;
  }

  const fetchROCData = async () => {
    setError(null);

    try {
      let response;
      if (plotType === 'test') {
        response = await Backend.getROCCurveTestData(token, modelsToProcess);
      } else if (plotType === 'train') {
        response = await Backend.getROCCurveTrainData(token, modelsToProcess);
      } else {
        response = await Backend.getROCCurveTestData(token, modelsToProcess);
      }

      if (response && Array.isArray(response) && response.length > 0) {
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
    }
  };

  fetchROCData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [modelsToProcess, plotData, token]); // plotType intentionally omitted

  // Calculate current threshold points for all models (memoized for performance)
  const currentROCPoints = useMemo(() => {
    if (!rocData || !threshold) return [];

    return rocData
      .map((modelData, index) => {
        if (!modelData.thresholds) return null;

        const { thresholds, fpr, tpr } = modelData;

        // Find the closest threshold index using binary search for better performance
        let closestIdx = 0;
        let minDiff = Math.abs(thresholds[0] - threshold);

        // For small arrays, linear search is fine. For larger arrays, consider binary search
        for (let i = 1; i < thresholds.length; i++) {
          const diff = Math.abs(thresholds[i] - threshold);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        return {
          fpr: fpr[closestIdx],
          tpr: tpr[closestIdx],
          modelId: modelData.model_id,
          modelName: modelData.model_name,
          index,
        };
      })
      .filter((point) => point !== null);
  }, [rocData, threshold]);

  // Debounced threshold for smoother performance
  const [debouncedThreshold, setDebouncedThreshold] = useState(threshold);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedThreshold(threshold);
    }, 50); // 50ms delay for smooth interaction

    return () => clearTimeout(timer);
  }, [threshold]);

  // Create/Update ROC Plot using Plotly (optimized)
  useEffect(() => {
    if (!rocData || !rocDivRef.current) return;

    const traces = [];
    const colors = [
      '#2E86AB',
      '#e74c3c',
      '#2ecc71',
      '#f39c12',
      '#9b59b6',
      '#1abc9c',
      '#e67e22',
      '#9b59b6',
    ];

    // Create traces for each model (these don't change with threshold)
    rocData.forEach((modelData, index) => {
      if (modelData.error) {
        console.warn(
          `Skipping model ${modelData.model_id} due to error: ${modelData.error}`
        );
        return;
      }

      if (
        !modelData.fpr ||
        !modelData.tpr ||
        modelData.fpr.length === 0 ||
        modelData.tpr.length === 0
      ) {
        console.warn(
          `Skipping model ${modelData.model_id} - missing or empty FPR/TPR data`
        );
        return;
      }

      const color = colors[index % colors.length];

      traces.push({
        x: modelData.fpr,
        y: modelData.tpr,
        mode: 'lines',
        name: `${modelData.model_name} (AUC = ${modelData.auc.toFixed(3)})`,
        line: { color: color, width: 3 },
        hovertemplate: `<b>${
          modelData.model_name
        }</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<br>AUC: ${modelData.auc.toFixed(
          3
        )}<extra></extra>`,
      });
    });

    // Add random classifier line for reference
    traces.push({
      x: [0, 1],
      y: [0, 1],
      mode: 'lines',
      name: 'Random Classifier',
      line: { color: '#A23B72', width: 2, dash: 'dash' },
      hovertemplate:
        '<b>Random Classifier</b><br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>',
    });

    const isMultiModel = rocData.length > 1;
    const titleText = isMultiModel
      ? `ROC Curve Comparison - ${
          plotType === 'train' ? 'Training' : 'Test'
        } Set (${rocData.length} models)`
      : `ROC Curve - ${plotType === 'train' ? 'Training' : 'Test'} Set (n=${
          rocData[0].n_samples
        })`;

    const layout = {
      title: {
        text: titleText,
        font: { size: 16, family: 'Arial, sans-serif' },
      },
      xaxis: {
        title: {
          text: 'False Positive Rate (1 - Specificity)',
          font: { size: 15, family: 'Arial, sans-serif' },
        },
        range: [0, 1],
        autorange: false, // Disable auto-ranging
        gridcolor: '#e1e5ea',
        zeroline: false,
      },
      yaxis: {
        title: {
          text: 'True Positive Rate (Sensitivity)',
          font: { size: 15, family: 'Arial, sans-serif' },
        },
        range: [0, 1],
        autorange: false, // Disable auto-ranging
        gridcolor: '#e1e5ea',
        zeroline: false,
      },
      showlegend: true,
      legend: {
        orientation: isMultiModel ? 'v' : 'h',
        x: isMultiModel ? 1.02 : 0,
        y: isMultiModel ? 1 : -0.25,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1,
      },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',
      margin: {
        l: 60,
        r: isMultiModel ? 200 : 30,
        t: 80,
        b: isMultiModel ? 60 : 110,
      },
      height: height,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    };

    // Create or update the base plot (without threshold points)
    if (rocPlotRef.current) {
      Plotly.react(rocDivRef.current, traces, layout, config);
    } else {
      Plotly.newPlot(rocDivRef.current, traces, layout, config).then((plot) => {
        rocPlotRef.current = plot;
      });
    }
  }, [rocData, plotType, height]); // Removed threshold dependency

  // Separate effect for updating threshold points (optimized for performance)
  useEffect(() => {
    if (!rocPlotRef.current || !currentROCPoints.length || !rocData) return;

    const pointColors = [
      '#F18F01',
      '#e74c3c',
      '#2ecc71',
      '#f39c12',
      '#9b59b6',
      '#1abc9c',
      '#e67e22',
      '#34495e',
    ];

    // Create updated traces with threshold points
    const baseTraces = rocDivRef.current.data.slice(0, rocData.length + 1); // ROC curves + random classifier

    const pointTraces = currentROCPoints.map((point) => {
      const pointColor = pointColors[point.index % pointColors.length];

      return {
        x: [point.fpr],
        y: [point.tpr],
        mode: 'markers',
        name:
          rocData.length === 1
            ? `Threshold ${debouncedThreshold.toFixed(3)}`
            : `${point.modelName} @ ${debouncedThreshold.toFixed(3)}`,
        marker: {
          color: pointColor,
          size: 12,
          line: { color: '#ffffff', width: 2 },
          symbol: 'circle',
        },
        hovertemplate: `<b>Operating Point - ${
          point.modelName
        }</b><br>Threshold: ${debouncedThreshold.toFixed(
          3
        )}<br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>`,
        showlegend: rocData.length > 1,
      };
    });

    // Efficiently update just the threshold points while preserving layout
    const allTraces = [...baseTraces, ...pointTraces];

    // Update traces first
    Plotly.react(rocDivRef.current, allTraces);

    // Then force the axis ranges to stay fixed (this ensures no auto-scaling occurs)
    Plotly.relayout(rocDivRef.current, {
      'xaxis.range': [0, 1],
      'yaxis.range': [0, 1],
      'xaxis.autorange': false,
      'yaxis.autorange': false,
    });
  }, [currentROCPoints, debouncedThreshold, rocData]);

  // Error state
  if (error) {
    console.log('Rendering error state:', error);
    if (hideContainer) {
      return (
        <div className="alert alert-danger">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          Error loading ROC curve: {error}
          <br />
          <small>
            Debug: Check browser console for detailed error information
          </small>
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
            <small>
              Debug: Check browser console for detailed error information
            </small>
          </div>
        </div>
      </div>
    );
  }

  // No models selected
  if (!modelsToProcess || modelsToProcess.length === 0 || !token) {
    if (hideContainer) {
      return (
        <div className="alert alert-info">
          Please select model(s) to view the ROC curve.
          <br />
          <small>
            Debug: models={modelsToProcess.length}, token=
            {!!token ? 'exists' : 'missing'}
          </small>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-header">ROC Curve</div>
        <div className="card-body">
          <div className="alert alert-info">
            Please select model(s) to view the ROC curve.
            <br />
            <small>
              Debug: models={modelsToProcess.length}, token=
              {!!token ? 'exists' : 'missing'}
            </small>
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
          <div>ROC Curve - {modelsToProcess.length} model(s)</div>
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
          height: `${height}px`,
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
            height: `${height}px`,
          }}
        />
      </div>
    </div>
  );
};

export default ROCCurveComponent;
