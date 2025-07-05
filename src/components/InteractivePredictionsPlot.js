import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';

const InteractivePredictionsPlot = ({ 
  modelsData, 
  plotType, 
  onClose, 
  externalThreshold = null, 
  hideThresholdControl = false,
  hideContainer = false,
  onMetricsUpdate = null,
  externalHeight = null
}) => {
  const [internalThreshold, setInternalThreshold] = useState(0.5);
  const plotRef = useRef(null);
  const plotDivRef = useRef(null);

  // Use external threshold if provided, otherwise use internal
  const threshold = externalThreshold !== null ? externalThreshold : internalThreshold;
  const setThreshold = externalThreshold !== null ? () => {} : setInternalThreshold;

  // Calculate metrics for given threshold
  const calculateMetrics = (currentThreshold, data) => {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    
    data.forEach(model => {
      model.patients.forEach(patient => {
        const predicted = patient.probability >= currentThreshold ? 1 : 0;
        const actual = patient.ground_truth;
        
        if (actual === 1 && predicted === 1) tp++;
        else if (actual === 0 && predicted === 1) fp++;
        else if (actual === 0 && predicted === 0) tn++;
        else if (actual === 1 && predicted === 0) fn++;
      });
    });
    
    const total = tp + fp + tn + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;
    const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    return { tp, fp, tn, fn, accuracy, precision, recall, specificity, f1 };
  };
  // Create initial plot
  useEffect(() => {
    if (!modelsData || modelsData.length === 0 || !plotDivRef.current) return;
    const traces = [];
    // Consistent colors: Red for negative, Blue for positive
    // Simple points/circles for all cases - distinction through Y-positioning and colors only
    const baseColors = {
      negative: '#e74c3c',  // Red for negative cases
      positive: '#3498db'   // Blue for positive cases
    };

    // Create traces for each model and class
    modelsData.forEach((model, modelIndex) => {
      const yPos = modelsData.length > 1 ? modelIndex * 0.4 : 0;
      // Get model display name (use model name if available, otherwise ID)
      const modelDisplayName = model.model_name || `Model ${model.model_id}`;

      // Class 0 points (Negative cases) - Always RED circles
      const class0Data = model.patients.filter(p => p.ground_truth === 0);
      if (class0Data.length > 0) {
        traces.push({
          x: class0Data.map(p => p.probability),
          y: Array(class0Data.length).fill(yPos),
          mode: 'markers',
          name: `${modelDisplayName} - Negative`,
          legendgroup: `model_${modelIndex}`,
          marker: {
            color: baseColors.negative,
            size: 8,
            symbol: 'circle',
            line: { color: '#c0392b', width: 1 }
          },
          text: class0Data.map(p => `Patient: ${p.patient_id}<br>Model: ${modelDisplayName}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Negative (0)<extra></extra>',
          type: 'scatter'
        });
      }

      // Class 1 points (Positive cases) - Always BLUE circles
      const class1Data = model.patients.filter(p => p.ground_truth === 1);
      if (class1Data.length > 0) {
        traces.push({
          x: class1Data.map(p => p.probability),
          y: Array(class1Data.length).fill(yPos),
          mode: 'markers',
          name: `${modelDisplayName} - Positive`,
          legendgroup: `model_${modelIndex}`,
          marker: {
            color: baseColors.positive,
            size: 8,
            symbol: 'circle',
            line: { color: '#2980b9', width: 1 }
          },
          text: class1Data.map(p => `Patient: ${p.patient_id}<br>Model: ${modelDisplayName}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Positive (1)<extra></extra>',
          type: 'scatter'
        });
      }
    });

    // Add a dummy scatter trace for the threshold to show in the legend
    traces.push({
      x: [threshold, threshold],
      y: [
        modelsData.length > 1 ? -0.3 : -0.5,
        modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5
      ],
      mode: 'lines',
      name: `Threshold ${threshold.toFixed(3)}`,
      line: { color: '#F18F01', width: 3, dash: 'dash' },
      showlegend: true,
      hoverinfo: 'skip',
      legendgroup: 'threshold',
    });

    const layout = {

      xaxis: {
        title: {
          text: 'Predicted Probability',
          font: { size: 15, family: 'Arial, sans-serif' }
        },
        range: [-0.05, 1.05],
        gridcolor: '#e1e5e9',
        showgrid: true
      },
      yaxis: { 
        title: modelsData.length > 1 ? 'Models' : '',
        showticklabels: modelsData.length > 1,
        tickmode: modelsData.length > 1 ? 'array' : 'auto',
        tickvals: modelsData.length > 1 ? modelsData.map((_, i) => i * 0.4) : undefined,
        ticktext: modelsData.length > 1 ? modelsData.map((model, i) => {
          const modelName = model.model_name || `Model ${model.model_id}`;
          const auc = model.auc ? ` (AUC: ${model.auc.toFixed(3)})` : '';
          return `${modelName}`;
        }) : undefined,
        range: modelsData.length > 1 ? [-0.3, (modelsData.length - 1) * 0.4 + 0.3] : [-0.5, 0.5],
        gridcolor: '#e1e5e9'      },
      height: externalHeight || Math.max(500, modelsData.length * 120 + 200),
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.1,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1
      },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      shapes: [
        // Threshold line
        {
          type: 'line',
          x0: threshold,
          x1: threshold,
          y0: -0.5,
          y1: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5,
          line: { color: '#F18F01', width: 3, dash: 'dash' }
        }
      ],
      annotations: [
        // Threshold annotation
        {
          x: threshold,
          y: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.4 : 0.6,
          text: `Threshold: ${threshold.toFixed(2)}`,
          showarrow: true,
          arrowhead: 2,
          arrowcolor: '#F18F01',
          bgcolor: '#F18F01',
          bordercolor: '#F18F01',
          font: { color: 'white', size: 12 }
        }
      ]
    };

    const config = { 
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']    };
    
    Plotly.newPlot(plotDivRef.current, traces, layout, config);
    plotRef.current = plotDivRef.current;    // Calculate initial metrics
    const calculatedMetrics = calculateMetrics(threshold, modelsData);
    if (onMetricsUpdate) {
      onMetricsUpdate(calculatedMetrics);
    }
    
  }, [modelsData, plotType, threshold, onMetricsUpdate, externalHeight]);
  // Update plot when threshold changes
  const handleThresholdChange = (newThreshold) => {
    setThreshold(newThreshold);
    
    if (plotRef.current) {
      const update = {
        shapes: [
          {
            type: 'line',
            x0: newThreshold,
            x1: newThreshold,
            y0: -0.5,
            y1: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5,
            line: { color: '#F18F01', width: 3, dash: 'dash' }
          }
        ],
        annotations: [
          {
            x: newThreshold,
            y: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.4 : 0.6,
            text: `Threshold: ${newThreshold.toFixed(2)}`,
            showarrow: true,
            arrowhead: 2,
            arrowcolor: '#F18F01',
            bgcolor: '#F18F01',
            bordercolor: '#F18F01',
            font: { color: 'white', size: 12 }
          }
        ]
      };      Plotly.relayout(plotRef.current, update);
    }    // Update metrics
    const calculatedMetrics = calculateMetrics(newThreshold, modelsData);
    if (onMetricsUpdate) {
      onMetricsUpdate(calculatedMetrics);
    }
  };

  if (!modelsData || modelsData.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        No data available for plotting
      </div>
    );
  }
  return (
    <div style={{ 
      marginTop: hideContainer ? '0' : '30px', 
      padding: hideContainer ? '0' : '20px', 
      border: hideContainer ? 'none' : '1px solid #dee2e6', 
      borderRadius: hideContainer ? '0' : '8px',
      backgroundColor: hideContainer ? 'transparent' : '#ffffff'
    }}>      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h5 style={{ margin: 0, color: '#495057' }}>
        </h5>
        
      </div>{/* Model Summary - only show for multiple models */}
         {/* Threshold Slider - conditionally rendered */}
      {!hideThresholdControl && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <label style={{ fontWeight: 'bold', color: '#495057', minWidth: 'fit-content' }}>
              Decision Threshold:
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
              style={{ 
                flex: 1, 
                minWidth: '200px',
                height: '8px',
                background: '#dee2e6',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <span style={{ 
              backgroundColor: '#007bff', 
              color: 'white', 
              padding: '5px 10px', 
              borderRadius: '15px', 
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: 'fit-content'
            }}>
              {threshold.toFixed(2)}
            </span>
          </div>        </div>      )}

      {/* Plot Container */}
      <div 
        ref={plotDivRef}        style={{ 
          width: '100%', 
          height: `${externalHeight || Math.max(500, modelsData.length * 120 + 200)}px`,
          border: hideContainer ? 'none' : '1px solid #dee2e6', 
          borderRadius: hideContainer ? '0' : '4px',
          marginBottom: hideContainer ? '0' : '20px'
        }}/>

      
    </div>
  );
};

export default InteractivePredictionsPlot;