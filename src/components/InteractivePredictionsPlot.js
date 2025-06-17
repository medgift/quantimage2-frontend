import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';

const InteractivePredictionsPlot = ({ modelsData, plotType, onClose }) => {
  const [threshold, setThreshold] = useState(0.5);
  const [metrics, setMetrics] = useState(null);
  const plotRef = useRef(null);
  const plotDivRef = useRef(null);

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
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12'];
    
    // Create traces for each model and class
    modelsData.forEach((model, modelIndex) => {
      const yPos = modelsData.length > 1 ? modelIndex * 0.3 : 0;
      
      // Class 0 points
      const class0Data = model.patients.filter(p => p.ground_truth === 0);
      if (class0Data.length > 0) {
        traces.push({
          x: class0Data.map(p => p.probability),
          y: Array(class0Data.length).fill(yPos),
          mode: 'markers',
          name: `Model ${model.model_id} - Class 0`,
          marker: { 
            color: colors[0], 
            size: 8,
            symbol: 'circle'
          },
          text: class0Data.map(p => `Patient: ${p.patient_id}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Class 0<extra></extra>',
          type: 'scatter'
        });
      }
      
      // Class 1 points
      const class1Data = model.patients.filter(p => p.ground_truth === 1);
      if (class1Data.length > 0) {
        traces.push({
          x: class1Data.map(p => p.probability),
          y: Array(class1Data.length).fill(yPos),
          mode: 'markers',
          name: `Model ${model.model_id} - Class 1`,
          marker: { 
            color: colors[1], 
            size: 8,
            symbol: 'circle'
          },
          text: class1Data.map(p => `Patient: ${p.patient_id}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Class 1<extra></extra>',
          type: 'scatter'
        });
      }
    });

    const layout = {
      title: {
        text: `Interactive ${plotType} Predictions`,
        font: { size: 18 }
      },
      xaxis: { 
        title: 'Probability of Class 1',
        range: [-0.05, 1.05],
        gridcolor: '#e1e5e9'
      },
      yaxis: { 
        title: modelsData.length > 1 ? 'Models' : '',
        showticklabels: modelsData.length > 1,
        gridcolor: '#e1e5e9'
      },
      height: 500,
      showlegend: true,
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      shapes: [
        // Threshold line
        {
          type: 'line',
          x0: threshold,
          x1: threshold,
          y0: -0.5,
          y1: modelsData.length * 0.3,
          line: { color: '#27ae60', width: 3, dash: 'dash' }
        }
      ]
    };

    const config = { 
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };
    
    Plotly.newPlot(plotDivRef.current, traces, layout, config);
    plotRef.current = plotDivRef.current;
    
    // Calculate initial metrics
    setMetrics(calculateMetrics(threshold, modelsData));
    
  }, [modelsData, plotType, threshold]);

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
            y1: modelsData.length * 0.3,
            line: { color: '#27ae60', width: 3, dash: 'dash' }
          }
        ]
      };
      
      Plotly.relayout(plotRef.current, update);
    }
    
    // Update metrics
    setMetrics(calculateMetrics(newThreshold, modelsData));
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
      marginTop: '30px', 
      padding: '20px', 
      border: '1px solid #dee2e6', 
      borderRadius: '8px',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h5 style={{ margin: 0, color: '#495057' }}>
          <FontAwesomeIcon icon="chart-line" className="me-2" />
          Interactive {plotType} Predictions
        </h5>
        <Button color="secondary" size="sm" onClick={onClose}>
          <FontAwesomeIcon icon="times" className="me-1" />
          Close
        </Button>
      </div>

      {/* Threshold Slider */}
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
        </div>
      </div>

      {/* Plot Container */}
      <div 
        ref={plotDivRef}
        style={{ 
          width: '100%', 
          height: '500px',
          border: '1px solid #dee2e6', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}
      />

      {/* Metrics Display */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {/* Performance Metrics */}
          <div style={{ border: '1px solid #007bff', borderRadius: '8px', padding: '15px', backgroundColor: '#f8f9ff' }}>
            <h6 style={{ color: '#007bff', fontWeight: 'bold', marginBottom: '15px' }}>Performance Metrics</h6>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Accuracy:</span>
                <span style={{ fontWeight: 'bold', color: '#28a745' }}>{metrics.accuracy.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Precision:</span>
                <span style={{ fontWeight: 'bold', color: '#007bff' }}>{metrics.precision.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recall:</span>
                <span style={{ fontWeight: 'bold', color: '#6610f2' }}>{metrics.recall.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Specificity:</span>
                <span style={{ fontWeight: 'bold', color: '#6c757d' }}>{metrics.specificity.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2' }}>
                <span>F1-Score:</span>
                <span style={{ fontWeight: 'bold', color: '#fd7e14' }}>{metrics.f1.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Confusion Matrix */}
          <div style={{ border: '1px solid #6c757d', borderRadius: '8px', padding: '15px', backgroundColor: '#f8f9fa' }}>
            <h6 style={{ color: '#6c757d', fontWeight: 'bold', marginBottom: '15px' }}>Confusion Matrix</h6>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <table style={{ borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #6c757d', padding: '8px', backgroundColor: '#e9ecef' }}></th>
                    <th style={{ border: '1px solid #6c757d', padding: '8px', backgroundColor: '#e9ecef' }}>Pred 0</th>
                    <th style={{ border: '1px solid #6c757d', padding: '8px', backgroundColor: '#e9ecef' }}>Pred 1</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th style={{ border: '1px solid #6c757d', padding: '8px', backgroundColor: '#e9ecef' }}>Actual 0</th>
                    <td style={{ border: '1px solid #6c757d', padding: '12px', backgroundColor: '#d4edda', fontWeight: 'bold', color: '#155724' }}>
                      {metrics.tn}
                    </td>
                    <td style={{ border: '1px solid #6c757d', padding: '12px', backgroundColor: '#f8d7da', fontWeight: 'bold', color: '#721c24' }}>
                      {metrics.fp}
                    </td>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid #6c757d', padding: '8px', backgroundColor: '#e9ecef' }}>Actual 1</th>
                    <td style={{ border: '1px solid #6c757d', padding: '12px', backgroundColor: '#fff3cd', fontWeight: 'bold', color: '#856404' }}>
                      {metrics.fn}
                    </td>
                    <td style={{ border: '1px solid #6c757d', padding: '12px', backgroundColor: '#d4edda', fontWeight: 'bold', color: '#155724' }}>
                      {metrics.tp}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '15px', color: '#6c757d', fontSize: '14px' }}>
        <FontAwesomeIcon icon="info-circle" className="me-1" />
        Drag the threshold slider to see how different decision boundaries affect model performance.
        The green dashed line shows the current threshold.
      </div>
    </div>
  );
};

export default InteractivePredictionsPlot;