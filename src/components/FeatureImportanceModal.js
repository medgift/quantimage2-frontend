import React, { useState, useEffect } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import Plotly from 'plotly.js-dist';
import MyModal from './MyModal';
import Backend from '../services/backend';

const FeatureImportanceModal = ({ isOpen, toggle, modelId, modelName }) => {
  const [featureData, setFeatureData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [maxFeatures, setMaxFeatures] = useState(10);
  const { keycloak } = useKeycloak();

  useEffect(() => {
    const fetchFeatureImportances = async () => {
      if (!isOpen || !modelId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await Backend.getFeatureImportances(keycloak.token, modelId);
        setFeatureData(response);
      } catch (err) {
        console.error('Error fetching feature importances:', err);
        setError('Failed to load feature importance data');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatureImportances();
  }, [isOpen, modelId, keycloak.token]);

  // Separate useEffect for plot creation/updates
  useEffect(() => {
    console.log(`useEffect triggered - featureData: ${!!featureData}, loading: ${loading}, maxFeatures: ${maxFeatures}`);
    if (featureData && !loading) {
      setTimeout(() => createPlot(featureData, maxFeatures), 100);
    }
  }, [featureData, maxFeatures, loading]);

  const createPlot = (data, maxFeaturesToShow = 10) => {
    if (!data?.feature_importances) return;

    const plotDiv = document.getElementById('feature-importance-plot');
    if (!plotDiv) return;

    console.log(`Creating plot with ${maxFeaturesToShow} features out of ${data.feature_importances.length} total`);
    console.log('Raw feature data:', data.feature_importances);

    // Sort features by importance value and take top N (or all if -1)
    const sortedFeatures = data.feature_importances
      .sort((a, b) => Math.abs(b.importance_value) - Math.abs(a.importance_value));
    
    console.log('Sorted features:', sortedFeatures);
    
    const featuresToShow = maxFeaturesToShow === -1 ? sortedFeatures : sortedFeatures.slice(0, maxFeaturesToShow);

    console.log(`Displaying ${featuresToShow.length} features:`, featuresToShow);

    const trace = {
      x: featuresToShow.map(item => item.importance_value),
      y: featuresToShow.map(item => item.feature_name),
      type: 'bar',
      orientation: 'h',
      marker: {
        color: 'rgba(54, 162, 235, 0.8)',
        line: {
          color: 'rgba(54, 162, 235, 1)',
          width: 1
        }
      },
      hovertemplate: '<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>'
    };

    const layout = {
      title: {
        text: maxFeaturesToShow === -1 ? 'All Features' : `Top ${maxFeaturesToShow} Features`,
        font: { size: 16 }
      },
      xaxis: {
        title: 'Importance Value',
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      yaxis: {
        title: 'Features',
        automargin: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        // Force all categories to be shown
        type: 'category',
        categoryorder: 'array',
        categoryarray: featuresToShow.map(item => item.feature_name)
      },
      margin: { l: 200, r: 50, t: 60, b: 50 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { size: 12 },
      // Dynamic height based on number of features
      height: Math.max(400, featuresToShow.length * 25 + 100)
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      displaylogo: false
    };

    Plotly.newPlot(plotDiv, [trace], layout, config);
  };

  const handleMaxFeaturesChange = (event) => {
    const newMaxFeatures = parseInt(event.target.value);
    console.log(`Dropdown changed to: ${newMaxFeatures}`);
    setMaxFeatures(newMaxFeatures);
    // The useEffect will handle plot recreation
  };

  return (
    <MyModal
      isOpen={isOpen}
      toggle={toggle}
      title="Feature Importance"
      size="xl"
    >
      <div className="container-fluid p-0">
        {/* Elegant control header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <p className="text-muted mb-0 small">
              {featureData ? `Analyzing ${featureData.feature_importances?.length || 0} features` : 'Loading analysis...'}
            </p>
          </div>
          {featureData && (
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Display:</span>
              <select
                className="form-select form-select-sm border-0 bg-light"
                style={{ width: 'auto', minWidth: '120px' }}
                value={maxFeatures}
                onChange={handleMaxFeaturesChange}
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={-1}>All features</option>
              </select>
            </div>
          )}
        </div>

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
            style={{ 
              height: maxFeatures === -1 ? 'auto' : '600px',
              minHeight: '400px'
            }}
          ></div>
        )}
      </div>
    </MyModal>
  );
};

export default FeatureImportanceModal;
