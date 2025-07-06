import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Plotly from 'plotly.js-dist';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

const BootstrapHistogram = ({ 
  modelsData, 
  height = 500, 
  onClose, 
  hideContainer = false,
  metric = 'auc' // Fixed to AUC for bootstrap analysis
}) => {
  const plotRef = useRef(null);
  const plotDivRef = useRef(null);
  const [bootstrapData, setBootstrapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pValues, setPValues] = useState([]);
  const { keycloak } = useKeycloak();

  // Fetch real bootstrap data from backend
  useEffect(() => {
    const fetchBootstrapData = async () => {
      if (!modelsData || modelsData.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = [];
        
        for (const model of modelsData) {
          const modelId = model.model_id || model.id;
          const modelName = model.model_name || `Model ${modelId}`;
          
          try {
            const response = await Backend.getTestScoresValues(keycloak.token, modelId);
            
            // Debug log to see the actual response structure
            console.log(`Response for model ${modelId}:`, response);
            
            // Additional debug: Let's compare the first few values of different metrics
            if (response.test_scores && Array.isArray(response.test_scores) && response.test_scores.length > 0) {
              const firstScores = response.test_scores.slice(0, 5);
              console.log(`First 5 test scores for model ${modelId}:`, firstScores);
              
              // Extract values for different metrics for comparison
              const accuracyValues = firstScores.map(s => s.accuracy).filter(v => v !== undefined);
              const aucValues = firstScores.map(s => s.auc).filter(v => v !== undefined);
              const precisionValues = firstScores.map(s => s.precision).filter(v => v !== undefined);
              
              console.log(`Comparison for model ${modelId}:`, {
                accuracy: accuracyValues,
                auc: aucValues,
                precision: precisionValues,
                requestedMetric: metric,
                requestedValues: firstScores.map(s => s[metric]).filter(v => v !== undefined)
              });
            }
            
            if (response.test_scores && Array.isArray(response.test_scores)) {
              // Debug: log a sample of the test scores structure
              console.log(`Sample test score objects for model ${modelId}:`, response.test_scores.slice(0, 3));
              
              // Extract the specific metric values from the test scores objects
              const metricValues = response.test_scores
                .map((scoreObj, index) => {
                  if (typeof scoreObj === 'object' && scoreObj !== null) {
                    // Debug: log the specific metric extraction for first few items
                    if (index < 3) {
                      console.log(`Score object ${index}:`, scoreObj);
                      console.log(`Available keys:`, Object.keys(scoreObj));
                      console.log(`Looking for metric '${metric}':`, scoreObj[metric]);
                      console.log(`Has auc:`, scoreObj.auc);
                      console.log(`Has accuracy:`, scoreObj.accuracy);
                    }
                    
                    // Extract the metric value (auc, accuracy, precision, etc.)
                    const metricValue = scoreObj[metric];
                    if (metricValue !== undefined && metricValue !== null) {
                      return metricValue;
                    }
                    
                    // If the requested metric is not found, return undefined instead of falling back
                    // This prevents mixing different metrics
                    if (index < 3) {
                      console.warn(`Metric '${metric}' not found in score object. Available keys:`, Object.keys(scoreObj));
                    }
                    return undefined;
                  }
                  return scoreObj; // In case it's already a number
                })
                .filter(score => 
                  score !== undefined && 
                  score !== null &&
                  typeof score === 'number' && 
                  !isNaN(score) && 
                  isFinite(score)
                )
                .map(score => Number(score)); // Ensure numbers
              
              if (metricValues.length > 0) {
                // Debug: show statistics of extracted values
                const min = Math.min(...metricValues);
                const max = Math.max(...metricValues);
                const mean = metricValues.reduce((a, b) => a + b, 0) / metricValues.length;
                
                console.log(`Model ${modelId} - ${metric} values:`, {
                  count: metricValues.length,
                  min: min,
                  max: max,
                  mean: mean,
                  first5: metricValues.slice(0, 5),
                  last5: metricValues.slice(-5),
                  allValues: metricValues.slice(0, 20) // Show first 20 values for comparison
                });
                
                data.push({
                  name: modelName,
                  modelId: modelId,
                  algorithm: response.algorithm || 'Unknown',
                  normalization: response.normalization || 'Unknown',
                  samples: metricValues
                });
                
                console.log(`Model ${modelId}: ${metricValues.length} valid ${metric} scores out of ${response.test_scores.length} total`);
              } else {
                console.warn(`Model ${modelId}: No valid ${metric} scores found in test_scores objects`);
                console.warn(`Available metrics in first test score:`, response.test_scores[0] ? Object.keys(response.test_scores[0]) : 'No test scores');
              }
            } else {
              console.warn(`Model ${modelId}: Invalid test_scores format:`, response.test_scores);
            }
          } catch (modelError) {
            console.warn(`Failed to fetch test scores for model ${modelId}:`, modelError);
            // Continue with other models even if one fails
          }
        }

        // Debug: Final summary of all extracted data
        console.log(`=== BOOTSTRAP DATA SUMMARY for metric '${metric}' ===`);
        data.forEach((model, index) => {
          const samples = model.samples;
          if (samples && samples.length > 0) {
            console.log(`Model ${index + 1} (${model.name}):`, {
              sampleCount: samples.length,
              min: Math.min(...samples),
              max: Math.max(...samples),
              mean: samples.reduce((a, b) => a + b, 0) / samples.length,
              samplePreview: samples.slice(0, 10),
              uniqueValues: [...new Set(samples)].slice(0, 10), // Show unique values
              histogram: samples.reduce((acc, val) => {
                const bin = Math.floor(val * 10) / 10; // Round to 1 decimal place
                acc[bin] = (acc[bin] || 0) + 1;
                return acc;
              }, {})
            });
          }
        });
        console.log(`=== END SUMMARY ===`);
        
        setBootstrapData(data);
      } catch (err) {
        console.error('Error fetching bootstrap data:', err);
        setError(err.message || 'Failed to fetch bootstrap data');
      } finally {
        setLoading(false);
      }
    };

    fetchBootstrapData();
  }, [modelsData, keycloak.token, metric]);

  // Fetch p-values from backend when bootstrapData is ready
  useEffect(() => {
    if (!bootstrapData || bootstrapData.length < 2) {
      setPValues([]);
      return;
    }
    const fetchPValues = async () => {
      try {
        const modelIds = bootstrapData.map(m => m.modelId);
        const result = await Backend.compareModelsData(keycloak.token, modelIds);
        // Convert backend p_values to the frontend format for annotations
        const pValueList = [];
        for (let i = 0; i < modelIds.length; i++) {
          for (let j = i + 1; j < modelIds.length; j++) {
            const id1 = modelIds[i];
            const id2 = modelIds[j];
            const p = result.p_values[`model_${id1}`][`model_${id2}`];
            pValueList.push({
              model1Name: bootstrapData[i].name,
              model2Name: bootstrapData[j].name,
              pValue: p,
              significant: p < 0.05
            });
          }
        }
        setPValues(pValueList);
      } catch (err) {
        setPValues([]);
        setError('Failed to fetch p-values from backend');
      }
    };
    fetchPValues();
  }, [bootstrapData, keycloak.token]);

  // Create bootstrap histogram plot
  useEffect(() => {
    if (!bootstrapData || bootstrapData.length === 0 || !plotDivRef.current || loading) return;

    const traces = [];
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']; // Blue, Red, Green, Orange, Purple

    // Create traces from real bootstrap data
    bootstrapData.forEach((model, index) => {
      // Additional validation before creating trace
      if (!model.samples || model.samples.length === 0) {
        console.warn(`Skipping model ${model.name}: no samples`);
        return;
      }
      
      // Ensure all samples are valid numbers
      const validSamples = model.samples.filter(sample => 
        typeof sample === 'number' && 
        !isNaN(sample) && 
        isFinite(sample)
      );
      
      if (validSamples.length === 0) {
        console.warn(`Skipping model ${model.name}: no valid samples`);
        return;
      }
      
      traces.push({
        x: validSamples,
        type: 'histogram',
        name: `${model.name} (${model.algorithm})`,
        opacity: 0.7,
        marker: {
          color: colors[index % colors.length],
          line: {
            color: colors[index % colors.length],
            width: 1
          }
        },
        nbinsx: Math.min(50, Math.max(10, Math.floor(validSamples.length / 10))), // Dynamic bin count
        hovertemplate: 
          `<b>${model.name}</b><br>` +
          `Algorithm: ${model.algorithm}<br>` +
          `Normalization: ${model.normalization}<br>` +
          `${metric.charAt(0).toUpperCase() + metric.slice(1)}: %{x:.3f}<br>` +
          `Count: %{y}<br>` +
          `<extra></extra>`
      });
    });

    // Check if we have any valid traces
    if (traces.length === 0) {
      console.error('No valid traces created for plotting');
      setError('No valid data available for plotting');
      return;
    }



    // Calculate data range for better axis configuration
    const allValues = traces.flatMap(trace => trace.x);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // Ensure valid range
    const safeRange = range > 0 ? range : 1;
    const padding = safeRange * 0.05; // 5% padding

    const layout = {

      xaxis: {
        title: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Score`,
        gridcolor: '#e1e5e9',
        showgrid: true,
        range: [minValue - padding, maxValue + padding],
        autorange: false
      },
      yaxis: {
        title: 'Frequency',
        gridcolor: '#e1e5e9',
        showgrid: true,
        autorange: true
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

    // Add p-value annotations to the plot using backend p-values
    if (pValues.length > 0) {
      pValues.forEach((comparison, index) => {
        // Display "< 0.001" for small values, but show exact value in hovertext (tooltip)
        let displayP = 'N/A';
        let hoverP = 'N/A';
        if (comparison.pValue !== undefined) {
          if (comparison.pValue < 0.001) {
            displayP = '< 0.001';
            hoverP = comparison.pValue.toExponential(3);
          } else {
            displayP = comparison.pValue.toFixed(3);
            hoverP = comparison.pValue.toExponential(3);
          }
        }
        layout.annotations.push({
          x: 0.02,
          y: 0.98 - (index * 0.08),
          xref: 'paper',
          yref: 'paper',
          text: `<b>${comparison.model1Name} vs ${comparison.model2Name}:</b> p=${displayP}${comparison.significant ? ' *' : ''}`,
          showarrow: false,
          font: {
            size: 12,
            color: comparison.significant ? '#e74c3c' : '#666666'
          },
          bgcolor: 'rgba(255,255,255,0.8)',
          bordercolor: comparison.significant ? '#e74c3c' : '#dddddd',
          borderwidth: 1,
          // Add hovertext for precision
          hovertext: `Exact p-value: ${hoverP}`,
          captureevents: true
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
      displaylogo: false,
      displayModeBar: true, // Enable the Plotly toolbar
      modeBarButtonsToRemove: ['lasso2d', 'select2d'] // Keep most tools but remove selection tools
    };

    try {
      Plotly.newPlot(plotDivRef.current, traces, layout, config);
      plotRef.current = plotDivRef.current;
    } catch (plotError) {
      console.error('Plotly error:', plotError);
      setError(`Failed to create plot: ${plotError.message}`);
    }

  }, [bootstrapData, metric, height, loading, pValues]);

  if (loading) {
    if (hideContainer) {
      return (
        <div className="text-center p-4">
          <FontAwesomeIcon icon="spinner" spin className="me-2" />
          Loading bootstrap data...
        </div>
      );
    }
    
    return (
      <div className="card mt-3">
        <div className="card-header">
          <FontAwesomeIcon icon="chart-bar" className="me-2" />
          Bootstrap Distribution Analysis
        </div>
        <div className="card-body text-center">
          <FontAwesomeIcon icon="spinner" spin className="me-2" />
          Loading bootstrap data...
        </div>
      </div>
    );
  }

  if (error) {
    if (hideContainer) {
      return (
        <div className="alert alert-danger">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          {error}
        </div>
      );
    }
    
    return (
      <div className="card mt-3">
        <div className="card-header">
          <FontAwesomeIcon icon="chart-bar" className="me-2" />
          Bootstrap Distribution Analysis
        </div>
        <div className="card-body">
          <div className="alert alert-danger">
            <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!bootstrapData || bootstrapData.length === 0) {
    if (hideContainer) {
      return (
        <div className="alert alert-info">
          No bootstrap test scores data available for analysis
        </div>
      );
    }
    
    return (
      <div className="card mt-3">
        <div className="card-header">
          Bootstrap Distribution Analysis
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            No bootstrap test scores data available for analysis. Make sure your models have test scores data.
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
          Bootstrap Test Scores Analysis ({bootstrapData.length} {bootstrapData.length === 1 ? 'Model' : 'Models'})
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
            <strong>Bootstrap Test Scores Analysis:</strong> This histogram shows the distribution of actual test scores 
            from your trained models. Each distribution represents the bootstrap samples used during model evaluation, 
            providing insights into model performance variability and statistical significance.
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
