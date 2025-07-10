import React, { useState, useEffect } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import Plotly from 'plotly.js-dist';
import MyModal from './MyModal';
import Backend from '../services/backend';

const FeatureImportanceModal = ({ isOpen, toggle, modelId, modelName }) => {
  const [featureData, setFeatureData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Always show all features, so no maxFeatures state
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
    if (featureData && !loading) {
      setTimeout(() => createPlot(featureData), 100);
    }
  }, [featureData, loading]);

  const createPlot = (data) => {
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

    const trace = {
      x: featuresToShow.map(item => item.importance_value).reverse(),
      y: featuresToShow.map(item => item.feature_name).reverse(),
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

      xaxis: {
        title: {
          text: 'Importance Value',
          font: { size: 14 }
        },
        gridcolor: 'rgba(128, 128, 128, 0.2)'
      },
      yaxis: {
        title: {
          text: 'Features',
          font: { size: 14 }
        },
        automargin: true,
        gridcolor: 'rgba(128, 128, 128, 0.2)',
        type: 'category',
        categoryorder: 'array',
        categoryarray: featuresToShow.map(item => item.feature_name).reverse()
      },
      margin: { l: 200, r: 50, t: 60, b: 50 },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { size: 12 },
      height: Math.max(400, featuresToShow.length * 25 + 100)
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

    Plotly.newPlot(plotDiv, [trace], layout, config);
  };

  // No dropdown or handler needed anymore

  return (
    <MyModal
      isOpen={isOpen}
      toggle={toggle}
      title="Feature Importance"
      size="xl"
    >
      <div className="container-fluid p-0">
        <div className="mb-4">
          <p className="text-muted mb-0 small">
            {featureData ? `Analyzing ${featureData.feature_importances?.filter(f => f.importance_value > 0).length || 0} features (excluding zero or negative importance)` : 'Loading analysis...'}
          </p>
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
            style={{ minHeight: '400px' }}
          ></div>
        )}
      </div>
    </MyModal>
  );
};

export default FeatureImportanceModal;
