import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  Form,
  FormGroup,
  Label,
  Input,
} from 'reactstrap';
import Plotly from 'plotly.js-dist';
import ColorPickerPopover from './ColorPickerPopover';

const DEFAULT_COLORS = {
  negative: '#3498db',
  positive: '#e74c3c',
};

const InteractivePredictionsPlot = ({
  modelsData,
  plotType,
  onClose,
  externalThreshold = null,
  hideThresholdControl = false,
  hideContainer = false,
  onMetricsUpdate = null,
  externalHeight = null,
}) => {
  const [internalThreshold, setInternalThreshold] = useState(0.5);
  const [baseColors, setBaseColors] = useState({ ...DEFAULT_COLORS });

  const plotRef = useRef(null);
  const plotDivRef = useRef(null);

  const threshold = externalThreshold !== null ? externalThreshold : internalThreshold;
  const setThreshold = externalThreshold !== null ? () => {} : setInternalThreshold;

  const adjustColor = (hex, amt) => {
    let col = (hex || '#000000').replace('#', '');
    if (col.length === 3) col = col.split('').map((c) => c + c).join('');
    const num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0x00ff) + amt;
    let b = (num & 0x0000ff) + amt;
    r = Math.max(Math.min(255, r), 0);
    g = Math.max(Math.min(255, g), 0);
    b = Math.max(Math.min(255, b), 0);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  const calculateMetrics = (currentThreshold, data) => {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    data.forEach((model) => {
      model.patients.forEach((patient) => {
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
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
    return { tp, fp, tn, fn, accuracy, precision, recall, specificity, f1 };
  };

  useEffect(() => {
    if (!modelsData || modelsData.length === 0 || !plotDivRef.current) return;
    const traces = [];

    modelsData.forEach((model, modelIndex) => {
      const yPos = modelsData.length > 1 ? modelIndex * 0.4 : 0;
      const modelDisplayName = model.model_name || `Model ${model.model_id}`;
      const neg = baseColors.negative;
      const pos = baseColors.positive;

      const class0Data = model.patients.filter((p) => p.ground_truth === 0);
      if (class0Data.length > 0) {
        traces.push({
          x: class0Data.map((p) => p.probability),
          y: Array(class0Data.length).fill(yPos),
          mode: 'markers',
          name: `${modelDisplayName} - Negative`,
          legendgroup: `model_${modelIndex}`,
          marker: { color: neg, size: 8, symbol: 'circle', line: { color: adjustColor(neg, -30), width: 1 } },
          text: class0Data.map((p) => `Patient: ${p.patient_id}<br>Model: ${modelDisplayName}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Negative (0)<extra></extra>',
          type: 'scatter',
        });
      }

      const class1Data = model.patients.filter((p) => p.ground_truth === 1);
      if (class1Data.length > 0) {
        traces.push({
          x: class1Data.map((p) => p.probability),
          y: Array(class1Data.length).fill(yPos),
          mode: 'markers',
          name: `${modelDisplayName} - Positive`,
          legendgroup: `model_${modelIndex}`,
          marker: { color: pos, size: 8, symbol: 'circle', line: { color: adjustColor(pos, -30), width: 1 } },
          text: class1Data.map((p) => `Patient: ${p.patient_id}<br>Model: ${modelDisplayName}`),
          hovertemplate: '<b>%{text}</b><br>Probability: %{x:.3f}<br>Ground Truth: Positive (1)<extra></extra>',
          type: 'scatter',
        });
      }
    });

    traces.push({
      x: [threshold, threshold],
      y: [modelsData.length > 1 ? -0.3 : -0.5, modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5],
      mode: 'lines',
      name: `Threshold ${threshold.toFixed(3)}`,
      line: { color: '#F18F01', width: 3, dash: '10px,8px' },
      showlegend: true,
      hoverinfo: 'skip',
      legendgroup: 'threshold',
    });

    const layout = {
      xaxis: { title: { text: 'Probability of Class 1', font: { size: 15, family: 'Arial, sans-serif' } }, range: [-0.05, 1.05], gridcolor: '#e1e5e9', showgrid: true },
      yaxis: {
        title: { text: 'Models', font: { size: 14 } },
        showticklabels: modelsData.length > 1,
        tickmode: modelsData.length > 1 ? 'array' : 'auto',
        tickvals: modelsData.length > 1 ? modelsData.map((_, i) => i * 0.4) : undefined,
        ticktext: modelsData.length > 1 ? modelsData.map((model) => {
          const modelName = model.model_name || `Model ${model.model_id}`;
          return modelName.length > 20 ? modelName.substring(0, 17) + '...' : modelName;
        }) : undefined,
        range: modelsData.length > 1 ? [-0.3, (modelsData.length - 1) * 0.4 + 0.3] : [-0.5, 0.5],
        gridcolor: '#e1e5e9',
        tickfont: { size: 11 },
        automargin: true,
      },
      height: externalHeight || Math.max(500, modelsData.length * 120 + 200),
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: -0.2, bgcolor: 'rgba(255,255,255,0.9)', bordercolor: '#dee2e6', borderwidth: 1, font: { size: 11 } },
      margin: { l: 80, r: 30, t: 60, b: 140 },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      shapes: [{
        type: 'line',
        x0: threshold,
        x1: threshold,
        y0: -0.5,
        y1: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5,
        line: { color: '#F18F01', width: 3, dash: '10px,8px' },
      }],
      annotations: [{
        x: threshold,
        y: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.4 : 0.6,
        text: `Threshold: ${threshold.toFixed(2)}`,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#F18F01',
        bgcolor: '#F18F01',
        bordercolor: '#F18F01',
        font: { color: 'white', size: 12 },
      }],
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      editable: true,
      edits: { legendText: true, legendPosition: true, axisTitleText: true, annotationText: true, annotationPosition: true },
    };

    Plotly.newPlot(plotDivRef.current, traces, layout, config);
    plotRef.current = plotDivRef.current;
    const calculatedMetrics = calculateMetrics(threshold, modelsData);
    if (onMetricsUpdate) onMetricsUpdate(calculatedMetrics);
  }, [modelsData, plotType, threshold, onMetricsUpdate, externalHeight, baseColors]);

  const handleThresholdChange = (newThreshold) => {
    setThreshold(newThreshold);
    if (plotRef.current) {
      const update = {
        shapes: [{
          type: 'line',
          x0: newThreshold,
          x1: newThreshold,
          y0: -0.5,
          y1: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.3 : 0.5,
          line: { color: '#F18F01', width: 3, dash: '10px,8px' },
        }],
        annotations: [{
          x: newThreshold,
          y: modelsData.length > 1 ? (modelsData.length - 1) * 0.4 + 0.4 : 0.6,
          text: `Threshold: ${newThreshold.toFixed(2)}`,
          showarrow: true,
          arrowhead: 2,
          arrowcolor: '#F18F01',
          bgcolor: '#F18F01',
          bordercolor: '#F18F01',
          font: { color: 'white', size: 12 },
        }],
      };
      Plotly.relayout(plotRef.current, update);
    }
    const calculatedMetrics = calculateMetrics(newThreshold, modelsData);
    if (onMetricsUpdate) onMetricsUpdate(calculatedMetrics);
  };

  const resetColors = () => setBaseColors({ ...DEFAULT_COLORS });

  if (!modelsData || modelsData.length === 0) {
    return <div className="p-4 text-center text-muted">No data available for plotting</div>;
  }

  return (
    <div className={hideContainer ? '' : 'mt-4'}>
      {!hideContainer ? (
        <Card style={{ position: 'relative' }}>
          <CardHeader className="d-flex align-items-center justify-content-between">
            <h5 className="mb-0 text-secondary">Interactive Predictions</h5>
            <div className="d-flex align-items-center">
              <ColorPickerPopover
                id="color-btn"
                baseColors={baseColors}
                setBaseColors={setBaseColors}
                resetColors={resetColors}
                className="me-2 d-flex align-items-center"
              />
            </div>
          </CardHeader>

          <CardBody>
            {!hideThresholdControl && (
              <div className="mb-4 p-3 bg-light rounded">
                <Form>
                  <FormGroup>
                    <div className="d-flex align-items-center">
                      <Label className="fw-bold text-secondary me-3 mb-0" style={{ minWidth: 'fit-content' }}>
                        Decision Threshold:
                      </Label>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={threshold}
                        onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
                        className="flex-fill mx-3"
                        style={{ minWidth: '200px' }}
                      />
                      <Badge color="primary" className="ms-2">{threshold.toFixed(2)}</Badge>
                    </div>
                  </FormGroup>
                </Form>
              </div>
            )}

            <div
              ref={plotDivRef}
              className={hideContainer ? '' : 'border rounded mb-3'}
              style={{ width: '100%', height: `${externalHeight || Math.max(500, modelsData.length * 120 + 200)}px` }}
            />
          </CardBody>
        </Card>
      ) : (
        <div>
          <div className="d-flex justify-content-end mb-2">
            <ColorPickerPopover
              id="color-btn-embed"
              baseColors={baseColors}
              setBaseColors={setBaseColors}
              resetColors={resetColors}
            />
          </div>

          <div
            ref={plotDivRef}
            style={{ width: '100%', height: `${externalHeight || Math.max(500, modelsData.length * 120 + 200)}px` }}
          />
        </div>
      )}
    </div>
  );
};

export default InteractivePredictionsPlot;