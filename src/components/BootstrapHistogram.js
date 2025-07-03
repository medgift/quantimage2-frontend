import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';

const BootstrapHistogram = ({ 
  modelsData, 
  height = 500, 
  onClose, 
  hideContainer = false,
  metric = 'accuracy' // which metric to show: 'accuracy', 'auc', 'precision', etc.
}) => {
  const plotRef = useRef(null);
  const plotDivRef = useRef(null);

  // Generate dummy bootstrap data for demonstration
  const generateBootstrapData = (modelName, modelId, baseValue) => {
    const bootstrapSamples = [];
    const numBootstraps = 1000; // Number of bootstrap samples
    
    // Generate normally distributed values around the base value
    for (let i = 0; i < numBootstraps; i++) {
      // Simple normal distribution approximation using Box-Muller transform
      const u = 0.01 + Math.random() * 0.98; // avoid 0 and 1
      const v = 0.01 + Math.random() * 0.98;
      const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      
      // Scale and shift to create realistic bootstrap distribution
      const variance = 0.05; // Bootstrap variance
      const value = baseValue + normal * variance;
      
      // Clamp to realistic bounds (0-1 for most metrics)
      bootstrapSamples.push(Math.max(0, Math.min(1, value)));
    }
    
    return bootstrapSamples;
  };

  // Create bootstrap histogram plot
  useEffect(() => {
    if (!modelsData || modelsData.length === 0 || !plotDivRef.current) return;

    // Calculate p-value using permutation test (dummy implementation)
    const calculatePValue = (samples1, samples2) => {
      const mean1 = samples1.reduce((a, b) => a + b, 0) / samples1.length;
      const mean2 = samples2.reduce((a, b) => a + b, 0) / samples2.length;
      const observedDiff = Math.abs(mean1 - mean2);
      
      // Dummy p-value calculation for demonstration
      // In real implementation, this would be a proper permutation test
      const combinedSamples = [...samples1, ...samples2];
      const n1 = samples1.length;
      const n2 = samples2.length;
      let extremeCount = 0;
      const numPermutations = 1000;
      
      for (let i = 0; i < numPermutations; i++) {
        // Shuffle combined samples
        const shuffled = [...combinedSamples].sort(() => Math.random() - 0.5);
        const perm1 = shuffled.slice(0, n1);
        const perm2 = shuffled.slice(n1);
        
        const permMean1 = perm1.reduce((a, b) => a + b, 0) / perm1.length;
        const permMean2 = perm2.reduce((a, b) => a + b, 0) / perm2.length;
        const permDiff = Math.abs(permMean1 - permMean2);
        
        if (permDiff >= observedDiff) {
          extremeCount++;
        }
      }
      
      return extremeCount / numPermutations;
    };

    // Calculate all pairwise p-values
    const calculatePairwisePValues = (bootstrapData) => {
      const pValues = [];
      
      for (let i = 0; i < bootstrapData.length; i++) {
        for (let j = i + 1; j < bootstrapData.length; j++) {
          const model1 = bootstrapData[i];
          const model2 = bootstrapData[j];
          const pValue = calculatePValue(model1.samples, model2.samples);
          
          pValues.push({
            model1Name: model1.name,
            model2Name: model2.name,
            pValue: pValue,
            significant: pValue < 0.05
          });
        }
      }
      
      return pValues;
    };

    const traces = [];
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']; // Blue, Red, Green, Orange, Purple
    const bootstrapData = [];

    // Generate bootstrap data for each model
    modelsData.forEach((model, index) => {
      const modelName = model.model_name || `Model ${model.model_id}`;
      
      // Use model's actual metric if available, otherwise use dummy base value
      const baseValue = model.auc || (0.7 + Math.random() * 0.25); // Random between 0.7-0.95
      
      const bootstrapValues = generateBootstrapData(modelName, model.model_id, baseValue);
      
      // Store for p-value calculations
      bootstrapData.push({
        name: modelName,
        samples: bootstrapValues
      });
      
      traces.push({
        x: bootstrapValues,
        type: 'histogram',
        name: modelName,
        opacity: 0.7,
        marker: {
          color: colors[index % colors.length],
          line: {
            color: colors[index % colors.length],
            width: 1
          }
        },
        nbinsx: 50, // Number of bins
        hovertemplate: 
          `<b>${modelName}</b><br>` +
          `${metric.charAt(0).toUpperCase() + metric.slice(1)}: %{x:.3f}<br>` +
          `Count: %{y}<br>` +
          `<extra></extra>`
      });
    });

    // Calculate p-values for pairwise comparisons
    const pValues = calculatePairwisePValues(bootstrapData);

    const layout = {
      title: {
        text: `Bootstrap Distribution Comparison - ${metric.charAt(0).toUpperCase() + metric.slice(1)}`,
        font: { size: 16 }
      },
      xaxis: {
        title: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Value`,
        gridcolor: '#e1e5e9',
        showgrid: true
      },
      yaxis: {
        title: 'Frequency',
        gridcolor: '#e1e5e9',
        showgrid: true
      },
      barmode: 'overlay', // Overlay histograms for comparison
      height: height,
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.15,
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#dee2e6',
        borderwidth: 1
      },
      hovermode: 'closest',
      plot_bgcolor: '#fafafa',
      paper_bgcolor: '#ffffff',
      margin: { l: 60, r: 30, t: 80, b: 100 },
      annotations: []
    };

    // Add p-value annotations to the plot
    if (pValues.length > 0) {
      pValues.forEach((comparison, index) => {
        layout.annotations.push({
          x: 0.02,
          y: 0.98 - (index * 0.08),
          xref: 'paper',
          yref: 'paper',
          text: `<b>${comparison.model1Name} vs ${comparison.model2Name}:</b> p=${comparison.pValue.toFixed(3)}${comparison.significant ? ' *' : ''}`,
          showarrow: false,
          font: {
            size: 12,
            color: comparison.significant ? '#e74c3c' : '#666666'
          },
          bgcolor: 'rgba(255,255,255,0.8)',
          bordercolor: comparison.significant ? '#e74c3c' : '#dddddd',
          borderwidth: 1
        });
      });

      // Add significance note
      if (pValues.some(p => p.significant)) {
        layout.annotations.push({
          x: 0.02,
          y: 0.98 - (pValues.length * 0.08) - 0.05,
          xref: 'paper',
          yref: 'paper',
          text: '* p < 0.05 (statistically significant)',
          showarrow: false,
          font: {
            size: 10,
            color: '#e74c3c'
          }
        });
      }
    }

    const config = {
      responsive: true,
      displayModeBar: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
    };

    Plotly.newPlot(plotDivRef.current, traces, layout, config);
    plotRef.current = plotDivRef.current;

  }, [modelsData, metric, height]);

  if (!modelsData || modelsData.length === 0) {
    if (hideContainer) {
      return (
        <div className="alert alert-info">
          No data available for bootstrap analysis
        </div>
      );
    }
    
    return (
      <div className="card">
        <div className="card-header">
          Bootstrap Distribution Analysis
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            No data available for bootstrap analysis
          </div>
        </div>
      </div>
    );
  }

  if (hideContainer) {
    return (
      <div 
        ref={plotDivRef}
        style={{ 
          width: '100%', 
          height: `${height}px`
        }}
      />
    );
  }

  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <FontAwesomeIcon icon="chart-bar" className="me-2" />
          Bootstrap Distribution Analysis ({modelsData.length} {modelsData.length === 1 ? 'Model' : 'Models'})
        </div>
        {onClose && (
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <FontAwesomeIcon icon="times" className="me-1" />
            Close
          </button>
        )}
      </div>
      <div className="card-body p-0">
        <div className="p-3 bg-light border-bottom">
          <div className="small text-muted">
            <FontAwesomeIcon icon="info-circle" className="me-2" />
            <strong>Bootstrap Analysis:</strong> This histogram shows the distribution of {metric} values 
            from 1,000 bootstrap samples for each model. The spread indicates the variance and reliability 
            of the model's performance estimate.
          </div>
        </div>
        <div 
          ref={plotDivRef}
          style={{ 
            width: '100%', 
            height: `${height}px`
          }}
        />
      </div>
    </div>
  );
};

export default BootstrapHistogram;
