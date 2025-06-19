import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Alert, Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { UMAP } from 'umap-js';
import ErrorBoundary from './utils/ErrorBoundary';

const UMAPAnalysis = ({
  filteredFeatures,
  sortedPatientIDs,
  sortedOutcomes,
  outcomeField,
  isComputingUmap,
  setIsComputingUmap,
}) => {
  // UMAP state
  const [umapData, setUmapData] = useState(null);
  const [umapError, setUmapError] = useState(null);
  const [selectedUmapFeatures, setSelectedUmapFeatures] = useState([]);
  const [useRandomSeed, setUseRandomSeed] = useState(true);

  const [supervisedStrength, setSupervisedStrength] = useState(0.5);

  // UMAP parameters
  const [umapParams, setUmapParams] = useState({
    nNeighbors: 15,
    minDist: 0.1,
    spread: 1.0,
    randomState: 42,
  });

  // Chart ref
  const umapChartRef = useRef(null);

  // Enhanced Radiomics UMAP Configuration Component
  const EnhancedRadiomicsUMAPConfiguration = ({
    filteredFeatures,
    selectedUmapFeatures,
    setSelectedUmapFeatures,
    sortedPatientIDs,
  }) => {
    // State for feature filtering and search
    const [featureSearch, setFeatureSearch] = useState('');
    const [advancedMode, setAdvancedMode] = useState(false);

    // Filter and format features for the UMAP analysis
    const availableFeatures = useMemo(() => {
      if (!filteredFeatures) return [];

      let features = filteredFeatures.filter((feature) => {
        const matchesSearch = feature.FeatureID.toLowerCase().includes(
          featureSearch.toLowerCase()
        );
        return matchesSearch;
      });

      // Add feature metadata for better selection
      return features
        .map((feature) => {
          const parts = feature.FeatureID.split('_');
          const category = parts[0] || 'unknown';
          const subcategory = parts[1] || '';

          return {
            value: feature.FeatureID,
            label: `${feature.FeatureID}`,
            category,
            subcategory,
            ranking: feature.Ranking,
            shortName: parts.slice(-1)[0],
          };
        })
        .sort((a, b) => {
          // Sort by category, then by ranking
          if (a.category !== b.category)
            return a.category.localeCompare(b.category);
          return (a.ranking || 999) - (b.ranking || 999);
        });
    }, [filteredFeatures, featureSearch]);

    // Calculate preprocessing statistics
    const preprocessingStats = useMemo(() => {
      if (!filteredFeatures || filteredFeatures.length === 0) return null;

      const featuresToUse =
        selectedUmapFeatures.length > 0
          ? filteredFeatures.filter((f) =>
              selectedUmapFeatures.includes(f.FeatureID)
            )
          : filteredFeatures;

      // Calculate basic statistics
      const stats = {
        totalFeatures: featuresToUse.length,
        patients: sortedPatientIDs.length,
        missingValueRate: 0,
        dimensionality: featuresToUse.length / sortedPatientIDs.length,
        correlatedFeatures: 0,
      };

      // Count missing values
      let totalValues = 0;
      let missingValues = 0;

      featuresToUse.forEach((feature) => {
        sortedPatientIDs.forEach((patient) => {
          totalValues++;
          const value = feature[patient];
          if (value === undefined || value === null || isNaN(+value)) {
            missingValues++;
          }
        });
      });

      stats.missingValueRate = (missingValues / totalValues) * 100;

      return stats;
    }, [filteredFeatures, selectedUmapFeatures, sortedPatientIDs]);

    return (
      <div className="radiomics-umap-config mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">
            <FontAwesomeIcon icon="cogs" className="me-2" />
            Radiomics UMAP Analysis Configuration
          </h5>
          <div>
            <Button
              size="sm"
              color={advancedMode ? 'primary' : 'outline-secondary'}
              onClick={() => setAdvancedMode(!advancedMode)}
              className="me-2"
            >
              <FontAwesomeIcon icon="sliders-h" className="me-1" />
              {advancedMode ? 'Basic' : 'Advanced'}
            </Button>
          </div>
        </div>

        {/* Feature Selection Section */}
        <div className="card mb-3">
          <div className="card-header">
            <h6 className="mb-0">
              <FontAwesomeIcon icon="filter" className="me-2" />
              Radiomics Feature Selection
            </h6>
          </div>
          <div className="card-body">
            <div className="row mb-3">
              <div className="col-md-12">
                <Label for="featureSearch">Search Features</Label>
                <Input
                  type="text"
                  id="featureSearch"
                  placeholder="Search by feature name, category, or type..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                />
              </div>
            </div>

            <Label for="umapFeatureSelect">
              Select Radiomics Features ({availableFeatures.length} available)
            </Label>
            <Input
              type="select"
              id="umapFeatureSelect"
              multiple
              value={selectedUmapFeatures}
              onChange={(e) => {
                const selected = Array.from(
                  e.target.selectedOptions,
                  (option) => option.value
                );
                setSelectedUmapFeatures(selected);
              }}
              style={{
                minHeight: '150px',
                fontFamily: 'monospace',
                fontSize: '0.9em',
              }}
            >
              {availableFeatures.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  title={`Category: ${option.category}, Rank: ${option.ranking}`}
                >
                  [{option.category}] {option.shortName} (#{option.ranking})
                </option>
              ))}
            </Input>
            <small className="text-muted">
              Hold Ctrl/Cmd to select multiple. Empty selection uses all
              filtered features.
            </small>

            {selectedUmapFeatures.length > 0 && (
              <div className="mt-2">
                <Button
                  size="sm"
                  color="outline-danger"
                  onClick={() => setSelectedUmapFeatures([])}
                >
                  Clear Selection ({selectedUmapFeatures.length} selected)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* UMAP Parameters Section */}
        <div className="card mb-3">
          <div className="card-header">
            <h6 className="mb-0">
              <FontAwesomeIcon icon="project-diagram" className="me-2" />
              UMAP Hyperparameters
            </h6>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-3">
                <Label for="nNeighbors">
                  Neighbors
                  <FontAwesomeIcon
                    icon="info-circle"
                    className="ms-1 text-muted"
                    title="Controls local vs global structure. Higher values preserve global structure."
                  />
                </Label>
                <Input
                  type="number"
                  id="nNeighbors"
                  min="2"
                  max="100"
                  value={umapParams.nNeighbors}
                  onChange={(e) =>
                    setUmapParams((prev) => ({
                      ...prev,
                      nNeighbors: parseInt(e.target.value),
                    }))
                  }
                />
                <small className="text-muted">2-100 (recommended: 5-50)</small>
              </div>
              <div className="col-md-3">
                <Label for="minDist">
                  Min Distance
                  <FontAwesomeIcon
                    icon="info-circle"
                    className="ms-1 text-muted"
                    title="Minimum distance between points in embedding. Lower values = tighter clusters."
                  />
                </Label>
                <Input
                  type="number"
                  id="minDist"
                  min="0"
                  max="1"
                  step="0.05"
                  value={umapParams.minDist}
                  onChange={(e) =>
                    setUmapParams((prev) => ({
                      ...prev,
                      minDist: parseFloat(e.target.value),
                    }))
                  }
                />
                <small className="text-muted">
                  0.0-1.0 (recommended: 0.1-0.5)
                </small>
              </div>
              <div className="col-md-3">
                <Label for="spread">
                  Spread
                  <FontAwesomeIcon
                    icon="info-circle"
                    className="ms-1 text-muted"
                    title="Effective scale of embedded points. Works with min_dist."
                  />
                </Label>
                <Input
                  type="number"
                  id="spread"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={umapParams.spread}
                  onChange={(e) =>
                    setUmapParams((prev) => ({
                      ...prev,
                      spread: parseFloat(e.target.value),
                    }))
                  }
                />
                <small className="text-muted">0.1-3.0 (recommended: 1.0)</small>
              </div>
            </div>

            {advancedMode && (
              <div className="row mt-3">
                <div className="col-md-4">
                  <FormGroup check>
                    <Label check>
                      <Input
                        type="checkbox"
                        checked={useRandomSeed}
                        onChange={() => setUseRandomSeed(!useRandomSeed)}
                      />
                      Reproducible results (fixed seed)
                    </Label>
                  </FormGroup>
                </div>
                <div className="col-md-4">
                  <Label for="umapMetric">Distance Metric</Label>
                  <Input
                    type="select"
                    id="umapMetric"
                    value={umapParams.metric || 'euclidean'}
                    onChange={(e) =>
                      setUmapParams((prev) => ({
                        ...prev,
                        metric: e.target.value,
                      }))
                    }
                  >
                    <option value="euclidean">Euclidean</option>
                    <option value="manhattan">Manhattan</option>
                    <option value="cosine">Cosine</option>
                    <option value="correlation">Correlation</option>
                  </Input>
                </div>
                <div className="col-md-4">
                  <Label for="umapSeed">Random Seed</Label>
                  <Input
                    type="number"
                    id="umapSeed"
                    value={umapParams.randomState}
                    onChange={(e) =>
                      setUmapParams((prev) => ({
                        ...prev,
                        randomState: parseInt(e.target.value),
                      }))
                    }
                    disabled={!useRandomSeed}
                  />
                </div>
                <div className="col-md-4">
                  <Label for="supervisedStrength">
                    Supervised Strength
                    <FontAwesomeIcon
                      icon="info-circle"
                      className="ms-1 text-muted"
                      title="0 = unsupervised, 1 = fully supervised. 0.3-0.7 recommended for semi-supervised."
                    />
                  </Label>
                  <Input
                    type="number"
                    id="supervisedStrength"
                    min="0"
                    max="1"
                    step="0.1"
                    value={supervisedStrength}
                    onChange={(e) =>
                      setSupervisedStrength(parseFloat(e.target.value))
                    }
                  />
                  <small className="text-muted">
                    0-1 (recommended: 0.3-0.7)
                  </small>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {umapError && (
          <Alert color="danger" className="mb-3">
            <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
            <strong>UMAP Error:</strong> {umapError}
          </Alert>
        )}

        {/* Analysis Status */}
        <div className="text-muted text-center">
          {preprocessingStats && (
            <small>
              Ready: {preprocessingStats.totalFeatures} features ×{' '}
              {preprocessingStats.patients} patients
            </small>
          )}
        </div>
      </div>
    );
  };

  // Enhanced Radiomics UMAP Computation with Scientific Best Practices
  const computeEnhancedRadiomicsUMAP = useCallback(async () => {
    setIsComputingUmap(true);
    setUmapError(null);

    try {
      // Enhanced parameter validation for radiomics data
      if (
        umapParams.nNeighbors < 2 ||
        umapParams.nNeighbors >
          Math.min(100, Math.floor(sortedPatientIDs.length * 0.8))
      ) {
        throw new Error(
          `nNeighbors must be between 2 and ${Math.min(
            100,
            Math.floor(sortedPatientIDs.length * 0.8)
          )} for this dataset`
        );
      }

      if (umapParams.minDist < 0 || umapParams.minDist > 1) {
        throw new Error('minDist must be between 0 and 1');
      }

      // Determine which features to use for UMAP analysis
      const featuresToUse =
        selectedUmapFeatures.length > 0
          ? filteredFeatures.filter((f) =>
              selectedUmapFeatures.includes(f.FeatureID)
            )
          : filteredFeatures;

      if (featuresToUse.length === 0) {
        throw new Error('No features available for UMAP analysis');
      }

      if (sortedPatientIDs.length < 10) {
        throw new Error(
          'At least 10 patients required for reliable UMAP analysis'
        );
      }

      console.log('Enhanced Radiomics UMAP Analysis:');
      console.log(
        `- Dataset: ${sortedPatientIDs.length} patients × ${featuresToUse.length} features`
      );
      console.time('Enhanced UMAP computation');

      // Step 1: Advanced data matrix preparation with missing value handling
      const dataMatrix = []; // Step 2: Build data matrix directly from raw data (like heatmap)
      for (
        let patientIdx = 0;
        patientIdx < sortedPatientIDs.length;
        patientIdx++
      ) {
        const patient = sortedPatientIDs[patientIdx];
        const patientFeatures = [];

        for (let feature of featuresToUse) {
          let value = feature[patient];
          // Use raw values directly, convert to number or use 0 for missing
          patientFeatures.push(
            value !== undefined && value !== null ? +value : 0
          );
        }
        dataMatrix.push(patientFeatures);
      }

      const standardizedMatrix = dataMatrix.map((row) => [...row]); // Deep copy

      // Calculate mean and std for each feature
      for (
        let featureIdx = 0;
        featureIdx < featuresToUse.length;
        featureIdx++
      ) {
        const featureValues = dataMatrix.map((row) => row[featureIdx]);
        const mean =
          featureValues.reduce((a, b) => a + b, 0) / featureValues.length;
        const std = Math.sqrt(
          featureValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            featureValues.length
        );

        // Standardize this feature across all patients
        for (let patientIdx = 0; patientIdx < dataMatrix.length; patientIdx++) {
          standardizedMatrix[patientIdx][featureIdx] =
            std > 0 ? (dataMatrix[patientIdx][featureIdx] - mean) / std : 0;
        }
      }

      // Use the standardized data instead
      const processedData = standardizedMatrix;

      // Step 4: Configure UMAP with radiomics-optimized parameters
      const optimizedParams = {
        nComponents: 2,
        nNeighbors: Math.min(
          umapParams.nNeighbors,
          Math.floor(sortedPatientIDs.length / 3)
        ),
        minDist: umapParams.minDist,
        spread: umapParams.spread,
        metric: umapParams.metric || 'euclidean',
        random_state: useRandomSeed ? umapParams.randomState : Date.now(),
        nEpochs: Math.max(200, Math.min(500, sortedPatientIDs.length * 2)),
        learningRate: 1.0,
        localConnectivity: 1.0,
        repulsionStrength: 1.0,
        negativeSampleRate: 5,
        transformSeed: useRandomSeed ? umapParams.randomState : Date.now(),
      };

      console.log('Optimized UMAP parameters:', optimizedParams); // Step 3: Run UMAP
      setTimeout(async () => {
        try {
          const umap = new UMAP({
            nNeighbors: optimizedParams.nNeighbors,
            minDist: optimizedParams.minDist,
            spread: optimizedParams.spread,
            nComponents: 2,
            metric: optimizedParams.metric,
            randomState: optimizedParams.random_state,
            nEpochs: optimizedParams.nEpochs,
          });

          // Add semi-supervised learning if strength > 0
          if (supervisedStrength > 0) {
            // Create numeric labels for supervision
            const labels = sortedOutcomes.map((outcome) => {
              const value = outcome?.[outcomeField];
              return value === 1 || value === '1' ? 1 : 0;
            });

            // Apply supervised projection
            umap.setSupervisedProjection(labels, {
              targetWeight: supervisedStrength,
            });
          }

          const embedding = await umap.fit(processedData);

          console.timeEnd('Enhanced UMAP computation');

          // Calculate outcome groups and centroids
          const outcomeGroups = {};
          embedding.forEach((point, idx) => {
            const outcome = sortedOutcomes[idx]?.[outcomeField] || 'UNKNOWN';
            if (!outcomeGroups[outcome]) {
              outcomeGroups[outcome] = [];
            }
            outcomeGroups[outcome].push(point);
          });

          const outcomeCentroids = {};
          Object.keys(outcomeGroups).forEach((outcome) => {
            const points = outcomeGroups[outcome];
            outcomeCentroids[outcome] = {
              x:
                points.reduce((sum, point) => sum + point[0], 0) /
                points.length,
              y:
                points.reduce((sum, point) => sum + point[1], 0) /
                points.length,
              count: points.length,
            };
          });

          const overallCentroidX =
            embedding.reduce((sum, point) => sum + point[0], 0) /
            embedding.length;
          const overallCentroidY =
            embedding.reduce((sum, point) => sum + point[1], 0) /
            embedding.length;

          // Process and enhance results
          const enhancedUmapPoints = embedding.map((coords, idx) => {
            const patient = sortedPatientIDs[idx];
            const outcome = sortedOutcomes[idx]?.[outcomeField] || 'UNKNOWN';

            const patientOriginalFeatures = featuresToUse.map((feature) => {
              const value = feature[patient];
              return value !== undefined && value !== null ? +value : 0;
            });

            const featureMean =
              patientOriginalFeatures.reduce((a, b) => a + b, 0) /
              patientOriginalFeatures.length;
            const featureStd = Math.sqrt(
              patientOriginalFeatures.reduce(
                (a, b) => a + Math.pow(b - featureMean, 2),
                0
              ) / patientOriginalFeatures.length
            );
            const featureMax = Math.max(...patientOriginalFeatures);
            const featureMin = Math.min(...patientOriginalFeatures);
            const featureRange = featureMax - featureMin;

            const outcomeCentroid = outcomeCentroids[outcome];
            const distanceFromOverallCenter = Math.sqrt(
              Math.pow(coords[0] - overallCentroidX, 2) +
                Math.pow(coords[1] - overallCentroidY, 2)
            );
            const distanceFromOutcomeCenter = outcomeCentroid
              ? Math.sqrt(
                  Math.pow(coords[0] - outcomeCentroid.x, 2) +
                    Math.pow(coords[1] - outcomeCentroid.y, 2)
                )
              : distanceFromOverallCenter;

            return {
              x: coords[0],
              y: coords[1],
              name: patient,
              className: outcome,
              featureMean,
              featureStd,
              featureMax,
              featureMin,
              featureRange,
              numFeatures: featuresToUse.length,
              distanceFromCenter: distanceFromOverallCenter,
              distanceFromOutcomeCenter,
            };
          });

          console.log(
            'UMAP Analysis Complete:',
            enhancedUmapPoints.length,
            'points'
          );
          setUmapData(enhancedUmapPoints);
          setIsComputingUmap(false);
        } catch (error) {
          console.error('Enhanced UMAP computation failed:', error);
          setUmapError(`UMAP computation failed: ${error.message}`);
          setIsComputingUmap(false);
        }
      }, 100);
    } catch (error) {
      console.error('Enhanced UMAP setup failed:', error);
      setUmapError(`UMAP setup failed: ${error.message}`);
      setIsComputingUmap(false);
    }
  }, [
    setIsComputingUmap,
    umapParams.nNeighbors,
    umapParams.minDist,
    umapParams.spread,
    umapParams.metric,
    umapParams.randomState,
    sortedPatientIDs,
    selectedUmapFeatures,
    filteredFeatures,
    useRandomSeed,
    supervisedStrength,
    sortedOutcomes,
    outcomeField,
  ]);

  // Enhanced Radiomics UMAP Chart Options
  const enhancedRadiomicsUMAPOptions = useMemo(() => {
    if (!umapData || umapData.length === 0) return null;

    // Only outcome color scheme needed
    const colorSchemes = {
      outcome: {
        title: 'Clinical Outcome',
        discrete: true,
        series: [
          {
            name: 'Outcome 0',
            data: umapData
              .filter((p) => p.className === 0 || p.className === '0')
              .map((p) => ({
                x: p.x,
                y: p.y,
                name: p.name,
                ...p,
              })),
            color: '#0b84a5',
            marker: {
              symbol: 'circle',
            },
          },
          {
            name: 'Outcome 1',
            data: umapData
              .filter((p) => p.className === 1 || p.className === '1')
              .map((p) => ({
                x: p.x,
                y: p.y,
                name: p.name,
                ...p,
              })),
            color: '#94e3d5',
            marker: {
              symbol: 'circle',
            },
          },
          {
            name: 'Unknown',
            data: umapData
              .filter((p) => p.className === 'UNKNOWN')
              .map((p) => ({
                x: p.x,
                y: p.y,
                name: p.name,
                ...p,
              })),
            color: '#666666',
            marker: {
              symbol: 'circle',
            },
          },
        ],
      },
    };

    // Always use outcome color scheme
    const series = colorSchemes.outcome.series.filter((s) => s.data.length > 0);

    const safeGet = (value, defaultValue = 'N/A') => {
      return value !== undefined && value !== null ? value : defaultValue;
    };

    const safeToFixed = (value, decimals = 2) => {
      return value !== undefined && value !== null && !isNaN(value)
        ? parseFloat(value).toFixed(decimals)
        : 'N/A';
    };

    const chartOptions = {
      chart: {
        type: 'scatter',
        height: 600,
        zoomType: 'xy',
        backgroundColor: '#fafafa',
        style: {
          fontFamily:
            '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
        },
      },

      title: {
        text: `UMAP Analysis`,
        style: {
          fontSize: '18px',
          fontWeight: '600',
          color: '#2c3e50',
        },
      },
      subtitle: {
        text: `${filteredFeatures.length} features • ${
          umapData.length
        } patients • Colored by Clinical Outcome${
          supervisedStrength > 0
            ? ` • Semi-supervised (${(supervisedStrength * 100).toFixed(0)}%)`
            : ''
        }`,
        style: {
          fontSize: '13px',
          color: '#7f8c8d',
        },
      },

      xAxis: {
        title: {
          text: 'UMAP Dimension 1',
          style: { color: '#34495e', fontWeight: '500' },
        },
        gridLineColor: '#ecf0f1',
        lineColor: '#bdc3c7',
      },

      yAxis: {
        title: {
          text: 'UMAP Dimension 2',
          style: { color: '#34495e', fontWeight: '500' },
        },
        gridLineColor: '#ecf0f1',
        lineColor: '#bdc3c7',
      },
      legend: {
        enabled: true,
        itemStyle: {
          color: '#2c3e50',
          fontWeight: '500',
        },
      },
      plotOptions: {
        scatter: {
          marker: {
            symbol: 'circle',
            radius: 6,
            fillOpacity: 0.8,
            lineWidth: 1,
            lineColor: '#ffffff',
          },
          states: {
            hover: {
              marker: {
                symbol: 'circle',
                radius: 8,
                lineWidth: 2,
              },
            },
          },
        },
      },

      tooltip: {
        useHTML: true,
        backgroundColor: '#ffffff',
        borderColor: '#bdc3c7',
        borderRadius: 8,
        shadow: true,
        style: {
          fontSize: '12px',
          padding: '0',
        },
        formatter: function () {
          const point = this.point;

          let html = `
            <div style="padding: 12px; max-width: 320px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin: -12px -12px 12px -12px; padding: 10px; border-radius: 8px 8px 0 0;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                  🔬 ${point.name}
                </div>
                <div style="font-size: 11px; opacity: 0.9;">
                  UMAP Coordinates: (${safeToFixed(point.x, 3)}, ${safeToFixed(
            point.y,
            3
          )})
                </div>
              </div>

              <div style="background: #e8f5e8; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-weight: 600; color: #27ae60; margin-bottom: 8px; font-size: 13px;">🎯 OUTCOME CLASSIFICATION</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                  <div>
                    <div><strong>Class:</strong> ${safeGet(
                      point.className
                    )}</div>
                  </div>
                  <div>
                    <div><strong>Features:</strong> ${safeGet(
                      point.numFeatures
                    )}</div>
                  </div>
                </div>
              </div>

              <div style="background: #fff3e0; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
                <div style="font-weight: 600; color: #f57c00; margin-bottom: 8px; font-size: 13px;">📊 STATISTICAL INSIGHTS</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                  <div>
                    <div><strong>Range:</strong> ${safeToFixed(
                      point.featureRange,
                      3
                    )}</div>
                    <div><strong>Std Dev:</strong> ${safeToFixed(
                      point.featureStd,
                      3
                    )}</div>
                  </div>
                  <div>
                    <div><strong>Max Value:</strong> ${safeToFixed(
                      point.featureMax,
                      3
                    )}</div>
                    <div><strong>Min Value:</strong> ${safeToFixed(
                      point.featureMin,
                      3
                    )}</div>
                  </div>
                </div>
              </div>

              <div style="background: #f5f5f5; padding: 8px; border-radius: 6px; font-size: 10px; color: #666;">
                <div style="font-weight: 600; margin-bottom: 4px;">Technical Details:</div>
                <div>Enhanced radiomics preprocessing applied</div>
              </div>
            </div>
          `;

          return html;
        },
      },

      credits: {
        enabled: true,
        text: 'Radiomics UMAP Analysis',
        style: {
          color: '#95a5a6',
          fontSize: '11px',
        },
      },
      series: series,
    };

    return chartOptions;
  }, [umapData, filteredFeatures.length, supervisedStrength]);

  // Auto-trigger UMAP computation when data changes
  React.useEffect(() => {
    if (filteredFeatures.length > 0 && sortedPatientIDs.length > 0) {
      computeEnhancedRadiomicsUMAP();
    }
  }, [filteredFeatures, sortedPatientIDs, computeEnhancedRadiomicsUMAP]);

  return (
    <div className="umap-analysis">
      <EnhancedRadiomicsUMAPConfiguration
        filteredFeatures={filteredFeatures}
        selectedUmapFeatures={selectedUmapFeatures}
        setSelectedUmapFeatures={setSelectedUmapFeatures}
        sortedPatientIDs={sortedPatientIDs}
      />

      {umapError && (
        <Alert color="danger" className="mb-3">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          <strong>UMAP Error:</strong> {umapError}
        </Alert>
      )}

      <ErrorBoundary>
        <HighchartsReact
          highcharts={Highcharts}
          options={enhancedRadiomicsUMAPOptions}
          ref={umapChartRef}
        />
      </ErrorBoundary>
    </div>
  );
};

export default UMAPAnalysis;
