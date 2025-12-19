import React, { useState, useEffect, useCallback } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import Plotly from 'plotly.js-dist';
import MyModal from './MyModal';
import Backend from '../services/backend';

const FeatureImportanceModal = ({ isOpen, toggle, modelId, modelName }) => {
  const [featureData, setFeatureData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // mapping original feature_name -> edited label
  const [featureLabels, setFeatureLabels] = useState({});
  const [editing, setEditing] = useState(false);
  const { keycloak } = useKeycloak();

  useEffect(() => {
    const fetchFeatureImportances = async () => {
      if (!isOpen || !modelId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await Backend.getFeatureImportances(keycloak.token, modelId);
        setFeatureData(response);
        setFeatureLabels({}); // reset any previous edits when new data arrives
      } catch (err) {
        console.error('Error fetching feature importances:', err);
        setError('Failed to load feature importance data');
      } finally {
        setLoading(false);
      }
    };
    fetchFeatureImportances();
  }, [isOpen, modelId, keycloak.token]);

  // createPlot is stable via useCallback so it can be included in effect deps
  const createPlot = useCallback((data) => {
    if (!data?.feature_importances) return;
    const plotDiv = document.getElementById('feature-importance-plot');
    if (!plotDiv) return;

    // Sort features by importance value (descending by abs value)
    let sortedFeatures = data.feature_importances
      .slice() // avoid mutating original
      .sort((a, b) => Math.abs(b.importance_value) - Math.abs(a.importance_value));

    // Remove features with 0 or negative importance
    sortedFeatures = sortedFeatures.filter(item => item.importance_value > 0);

    const featuresToShow = sortedFeatures;

    // Build display labels (apply user edits if present)
    const displayNames = featuresToShow.map(item => {
      const original = item.feature_name;
      const edited = featureLabels[original];
      return edited && edited.trim().length > 0 ? edited.trim() : original;
    }).reverse();

    const xValues = featuresToShow.map(item => item.importance_value).reverse();

    const hovertemplates = featuresToShow
      .map(item => {
        const original = item.feature_name;
        const edited = featureLabels[original];
        const label = edited && edited.trim().length > 0 ? edited.trim() : original;
        return `<b>${label}</b><br>Importance: %{x:.4f}<br>Original: ${original}<extra></extra>`;
      })
      .reverse();

    const trace = {
      x: xValues,
      y: displayNames,
      type: 'bar',
      orientation: 'h',
      marker: {
        color: 'rgba(54, 162, 235, 0.8)',
        line: {
          color: 'rgba(54, 162, 235, 1)',
          width: 1
        }
      },
      hovertemplate: hovertemplates,
    };

    const layout = {
      xaxis: {
        title: { text: 'Importance Value', font: { size: 14 } },
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      yaxis: {
        title: { text: 'Features', font: { size: 14 } },
        automargin: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        type: 'category',
        categoryorder: 'array',
        categoryarray: displayNames
      },
      margin: { l: 240, r: 50, t: 60, b: 50 }, // leave room for longer edited labels
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { size: 12 },
      height: Math.max(400, featuresToShow.length * 28 + 120)
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      displaylogo: false,
      editable: true,
      showEditInChartStudio: true,
      toImageButtonOptions: {
        format: 'png',
        filename: 'feature_importance',
        height: 600,
        width: 1000,
        scale: 1
      }
    };

    // Clear previous plot (avoid duplicates) and render
    try {
      if (plotDiv.data) {
        Plotly.purge(plotDiv);
      }
    } catch (e) {
      // ignore purge errors
    }

    Plotly.newPlot(plotDiv, [trace], layout, config);
  }, [featureLabels]);

  // re-create plot when data or labels change
  useEffect(() => {
    if (!featureData || loading) return;
    const t = setTimeout(() => createPlot(featureData), 100);
    return () => clearTimeout(t);
  }, [featureData, loading, createPlot]);

  // handlers for label editing UI
  const startEditing = () => setEditing(true);
  const stopEditing = () => setEditing(false);
  const resetLabels = () => setFeatureLabels({});

  const updateLabel = (original, value) => {
    setFeatureLabels(prev => ({ ...prev, [original]: value }));
  };

  // Render editing panel that lists editable inputs for visible features
  const renderEditingPanel = () => {
    if (!featureData?.feature_importances) return null;
    // replicate same filtering and sorting to keep order consistent with plot
    let sortedFeatures = featureData.feature_importances
      .slice()
      .sort((a, b) => Math.abs(b.importance_value) - Math.abs(a.importance_value))
      .filter(item => item.importance_value > 0);

    return (
      <div className="mb-3 p-2 bg-light rounded" style={{ maxHeight: 260, overflow: 'auto' }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <strong className="small text-muted">Edit feature labels</strong>
          <div>
            <button className="btn btn-sm btn-outline-secondary me-1" onClick={resetLabels}>Reset</button>
            <button className="btn btn-sm btn-primary" onClick={stopEditing}>Done</button>
          </div>
        </div>

        <div>
          {sortedFeatures.map((f, idx) => {
            const original = f.feature_name;
            return (
              <div key={original} className="mb-2">
                <label className="small mb-1 d-block text-truncate" style={{ maxWidth: '100%' }}>
                  <span className="text-muted">#{idx + 1}</span> &nbsp;
                  <strong>{original}</strong>
                </label>
                <input
                  className="form-control form-control-sm"
                  value={featureLabels[original] ?? ''}
                  onChange={(e) => updateLabel(original, e.target.value)}
                  placeholder="Enter custom label (leave empty to use original)"
                  aria-label={`Edit label for ${original}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <MyModal
      isOpen={isOpen}
      toggle={toggle}
      title={`Feature Importance${modelName ? ` — ${modelName}` : ''}`}
      size="xl"
    >
      <div className="container-fluid p-0">
        <div className="mb-3 d-flex align-items-center justify-content-between">
          <div>
            <p className="text-muted mb-0 small">
              {featureData ? `Analyzing ${featureData.feature_importances?.filter(f => f.importance_value > 0).length || 0} features (excluding zero or negative importance)` : 'Loading analysis...'}
            </p>
          </div>
          <div>
            <button className="btn btn-sm btn-outline-secondary me-2" onClick={startEditing} disabled={loading || !featureData}>
              Edit labels
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={resetLabels} disabled={loading || !featureData}>
              Reset edits
            </button>
          </div>
        </div>

        {editing && renderEditingPanel()}

        {loading && (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {featureData && !loading && (
          <div
            id="feature-importance-plot"
            className="w-100"
            style={{ minHeight: '400px' }}
          />
        )}
      </div>
    </MyModal>
  );
};

export default FeatureImportanceModal;
