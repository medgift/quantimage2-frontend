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

  // Create/Update ROC Plot using Plotly (optimized)
  useEffect(() => {
    if (!rocData || !rocDivRef.current) return;

    const traces = [];
    const colors = [
  '#2ecc71',  // Green
  '#9b59b6',  // Purple
  '#f39c12',  // Orange
  '#8b4513',  // Brown
  '#2c3e50',  // Dark blue-gray
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

    // Add initial threshold points to the base plot
    if (currentROCPoints.length > 0) {
      const pointColors = [
  '#2ecc71',  // Green (matches ROC line colors)
  '#9b59b6',  // Purple
  '#f39c12',  // Orange
  '#8b4513',  // Brown
  '#2c3e50',  // Dark blue-gray
      ];

      currentROCPoints.forEach((point) => {
        const pointColor = pointColors[point.index % pointColors.length];

        traces.push({
          x: [point.fpr],
          y: [point.tpr],
          mode: 'markers',
          name:
            rocData.length === 1
              ? `Threshold ${threshold.toFixed(3)}`
              : `Threshold ${threshold.toFixed(3)}`,
          marker: {
            color: pointColor,
            size: 12,
            line: { color: '#ffffff', width: 2 },
            symbol: 'circle',
          },
          hovertemplate: `<b>Operating Point - ${
            point.modelName
          }</b><br>Threshold: ${threshold.toFixed(
            3
          )}<br>FPR: %{x:.3f}<br>TPR: %{y:.3f}<extra></extra>`,
          showlegend: true, // Show threshold points in legend
        });
      });
    }

    const isMultiModel = rocData.length > 1;
    const titleText = isMultiModel
      ? `ROC Curve Comparison - ${
          plotType === 'train' ? 'Training' : 'Test'
        } Set (${rocData.length} models)`
      : `ROC Curve - ${plotType === 'train' ? 'Training' : 'Test'} Set (n=${
          rocData[0].n_samples
        })`;

    const layout = {
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
        orientation: 'h',
        x: 0,
        y: -0.2,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1,
      },
      plot_bgcolor: '#ffffff',
      paper_bgcolor: '#ffffff',
      margin: {
        l: 60,
        r: 30,
        t: 80,
        b: 120,
      },
      height: height,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      editable: true,
      edits: {
        legendText: true,
        legendPosition: true,
        axisTitleText: true,
        colorbarTitleText: true,
        annotationText: true,
        annotationPosition: true,
      },
    };

    // Create or update the base plot (without threshold points)
    if (rocPlotRef.current) {
      Plotly.react(rocDivRef.current, traces, layout, config);
    } else {
      Plotly.newPlot(rocDivRef.current, traces, layout, config).then((plot) => {
        rocPlotRef.current = plot;
      });
    }
  }, [rocData, plotType, height, currentROCPoints, threshold]); // Added currentROCPoints and threshold

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
