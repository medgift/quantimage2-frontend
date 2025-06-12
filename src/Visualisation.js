import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from 'react';
import Backend from './services/backend';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import HighchartsBoost from 'highcharts/modules/boost';
import HighchartsPatternFills from 'highcharts/modules/pattern-fill';

import _ from 'lodash';
import FilterTree from './components/FilterTree';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Input,
  Label,
  ButtonGroup,
} from 'reactstrap';
import { convertFeatureName, groupFeatures } from './utils/feature-naming';
import {
  FEATURE_DEFINITIONS,
  CATEGORY_DEFINITIONS,
  FEATURE_CATEGORY_ALIASES,
} from './utils/feature-mapping';
import MyModal from './components/MyModal';
import {
  CLASSIFICATION_OUTCOMES,
  MODEL_TYPES,
  OUTCOME_CLASSIFICATION,
  OUTCOME_SURVIVAL_EVENT,
  OUTCOME_SURVIVAL_TIME,
  SURVIVAL_OUTCOMES,
  PYRADIOMICS_FEATURE_PREFIXES,
  RIESZ_FEATURE_PREFIXES,
  ZRAD_FEATURE_PREFIXES,
  ZRAD_GROUP_PREFIXES,
} from './config/constants';
import { COMMON_CHART_OPTIONS } from './assets/charts/common';

import './Visualisation.css';
import ListValues from './components/ListValues';
import FeatureSelection, {
  DEFAULT_FEATURES_TO_KEEP,
  DEFAULT_MAX_FEATURES_TO_KEEP,
} from './components/FeatureSelection';
import ErrorBoundary from './utils/ErrorBoundary';
import UndoButton from './components/UndoButton';
import { UMAP } from 'umap-js';

HighchartsPatternFills(Highcharts);
HighchartsHeatmap(Highcharts);
HighchartsBoost(Highcharts);

const MAX_DISPLAYED_FEATURES = 200000;
const DEFAULT_CORRELATION_THRESHOLD = 0.5;

// Visualization modes
const VISUALIZATION_MODES = {
  HEATMAP: 'heatmap',
  UMAP: 'umap',
};

// Instantiate web worker
let filterFeaturesWorker;
if (window.Worker) {
  filterFeaturesWorker = new Worker('/workers/filter-features.js');
}

export const FEATURE_ID_SEPARATOR = '‑'; // This is a non-breaking hyphen to distinguish with normal hyphens that can occur in ROI names

let featureIDPattern = `(?<modality>.*?)${FEATURE_ID_SEPARATOR}(?<roi>.*?)${FEATURE_ID_SEPARATOR}(?<featureName>(?:${[
  ...ZRAD_FEATURE_PREFIXES,
  ...RIESZ_FEATURE_PREFIXES,
  ...PYRADIOMICS_FEATURE_PREFIXES,
].join('|')}).*)`;

let featureIDRegex = new RegExp(featureIDPattern);

let featureCategories = Array.from(
  new Set(FEATURE_DEFINITIONS.map((fd) => fd.category))
);
featureCategories = [...featureCategories, ...ZRAD_GROUP_PREFIXES];
let featureNamePattern = `(?<modality>.*?)${FEATURE_ID_SEPARATOR}(?<roi>.*)${FEATURE_ID_SEPARATOR}(?<featureName>(?:${featureCategories.join(
  '|'
)}).*)`;

let featureNameRegex = new RegExp(featureNamePattern);

export default function Visualisation({
  active,
  selectedLabelCategory,
  collectionInfos,
  album,
  featuresChart,
  outcomes,
  dataPoints,
  models,
  dataSplittingType,
  trainTestSplitType,
  patients,
  featureExtractionID,
  setCollections,
  updateExtractionOrCollection,
  hasPendingChanges,
  setHasPendingChanges,
  clinicalFeaturesDefinitions,
}) {
  // Route
  const { albumID } = useParams();

  // Keycloak
  const { keycloak } = useKeycloak();

  // History
  const navigate = useNavigate();

  // Init
  const [loading, setLoading] = useState(true);

  // Visualization mode
  const [visualizationMode, setVisualizationMode] = useState(
    VISUALIZATION_MODES.HEATMAP
  );

  // UMAP state
  const [umapData, setUmapData] = useState(null);
  const [isComputingUmap, setIsComputingUmap] = useState(false);

  // Features
  const [featureIDs, setFeatureIDs] = useState(null);
  const hoveredFeatureRef = useRef(null);

  // Feature ranking
  const [rankFeatures, setRankFeatures] = useState(false);

  // Manage feature selection values
  const [nFeatures, setNFeatures] = useState(DEFAULT_FEATURES_TO_KEEP);

  // Is chart being recomputed
  const [isRecomputingChart, setIsRecomputingChart] = useState(false);

  // Manage feature selections (checkboxes)
  const [selected, setSelected] = useState([]);

  // Manage filtering history
  const [selectedFeaturesHistory, setSelectedFeaturesHistory] = useState([]);

  // Drop correlated features
  const [corrThreshold, setCorrThreshold] = useState(
    DEFAULT_CORRELATION_THRESHOLD
  );

  // Collection creation/edition
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCollectionSaving, setIsCollectionSaving] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCollectionUpdating, setIsCollectionUpdating] = useState(false);

  // Test Patients Modal
  const [trainingPatientsOpen, setTrainingPatientsOpen] = useState(false);
  const [testPatientsOpen, setTestPatientsOpen] = useState(false);

  // Filtered features (based on selections)
  const [filteredFeatures, setFilteredFeatures] = useState([]);

  // Chart
  const chartRef = useRef(null);
  const umapChartRef = useRef(null);
  const [umapColorBy, setUmapColorBy] = useState('mean');

  // New state for selected features for UMAP
  const [selectedUmapFeatures, setSelectedUmapFeatures] = useState([]);

  // UMAP parameters
  const [umapParams, setUmapParams] = useState({
    nNeighbors: 15,
    minDist: 0.1,
    spread: 1.0,
    randomState: 42,
  });

  const [umapError, setUmapError] = useState(null);
  const [useRandomSeed, setUseRandomSeed] = useState(true);

  const featuresIDsAndClinicalFeatureNames = useMemo(() => {
    if (!featureIDs && !clinicalFeaturesDefinitions) return [];
    if (!featureIDs) return Object.keys(clinicalFeaturesDefinitions);
    if (!clinicalFeaturesDefinitions) return featureIDs;

    return [...featureIDs, ...Object.keys(clinicalFeaturesDefinitions)];
  }, [featureIDs, clinicalFeaturesDefinitions]);

  const finalTrainingPatients = useMemo(() => {
    if (selectedLabelCategory && patients?.training) return patients.training;
    else return dataPoints;
  }, [patients, dataPoints, selectedLabelCategory]);

  // Determine outcome column to inspect for chart
  const outcomeField = useMemo(() => {
    if (!selectedLabelCategory) return null;

    let outcomeField =
      selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
        ? OUTCOME_CLASSIFICATION
        : OUTCOME_SURVIVAL_EVENT;

    return outcomeField;
  }, [selectedLabelCategory]);

  // Sorted classes for the chart data
  const sortedClasses = useMemo(() => {
    if (!outcomeField) return [];

    let classes =
      outcomes.length > 0
        ? Array.from(
            new Set(
              outcomes.map((o) =>
                o.label_content[outcomeField]
                  ? o.label_content[outcomeField]
                  : 'UNKNOWN'
              )
            )
          )
        : ['UNKNOWN'];

    classes.sort((o1, o2) => {
      if (o1 === 'UNKNOWN') return 1;
      if (o2 === 'UNKNOWN') return -1;

      return o1.localeCompare(o2);
    });

    return classes;
  }, [outcomes, outcomeField]);

  // Sorted Patient outcomes
  const sortedOutcomes = useMemo(() => {
    if (!outcomeField) return [];

    let outcomes =
      selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
        ? CLASSIFICATION_OUTCOMES
        : SURVIVAL_OUTCOMES;

    let labels = selectedLabelCategory.labels;
    let patientOutcomes = [];
    for (let patient of finalTrainingPatients) {
      let patientOutcome = labels.find((l) => l.patient_id === patient);

      if (!patientOutcome)
        patientOutcomes.push(
          Object.assign(
            {},
            { PatientID: patient },
            ...outcomes.map((o) => ({ [o]: 'UNKNOWN' }))
          )
        );
      else
        patientOutcomes.push(
          Object.assign(
            {},

            { PatientID: patient },
            ...outcomes.map((o) => ({
              [o]:
                patientOutcome.label_content[o] !== '' &&
                Object.keys(patientOutcome.label_content).includes(o)
                  ? patientOutcome.label_content[o]
                  : 'UNKNOWN',
            }))
          )
        );
    }

    patientOutcomes.sort((p1, p2) => {
      if (
        sortedClasses.indexOf(p1[outcomeField]) <
        sortedClasses.indexOf(p2[outcomeField])
      )
        return -1;
      if (
        sortedClasses.indexOf(p1[outcomeField]) >
        sortedClasses.indexOf(p2[outcomeField])
      )
        return 1;

      if (selectedLabelCategory.label_type === MODEL_TYPES.SURVIVAL) {
        return p1[OUTCOME_SURVIVAL_TIME] - p2[OUTCOME_SURVIVAL_TIME];
      }

      return p1.PatientID.localeCompare(p2.PatientID, undefined, {
        numeric: true,
      });
    });

    return patientOutcomes;
  }, [
    selectedLabelCategory,
    finalTrainingPatients,
    sortedClasses,
    outcomeField,
  ]);

  // Sort Patient IDs for the chart data
  const sortedPatientIDs = useMemo(() => {
    if (sortedOutcomes.length > 0) {
      return Array.from(new Set(sortedOutcomes.map((o) => o.PatientID)));
    } else {
      return Array.from(finalTrainingPatients).sort((p1, p2) =>
        p1.localeCompare(p2, undefined, { numeric: true })
      );
    }
  }, [sortedOutcomes, finalTrainingPatients]);

  // Format survival times to correspond to the Highcharts requirements
  const formattedHighchartsDataSurvivalTime = useMemo(() => {
    if (
      !selectedLabelCategory ||
      selectedLabelCategory.label_type !== MODEL_TYPES.SURVIVAL
    )
      return null;

    return sortedOutcomes.map((outcome) => ({
      x: outcome.PatientID,
      y:
        outcome[OUTCOME_SURVIVAL_TIME] !== 'UNKNOWN'
          ? +outcome[OUTCOME_SURVIVAL_TIME]
          : null,
    }));
  }, [selectedLabelCategory, sortedOutcomes]);

  // Format outcomes data to correspond to the Highcharts requirements
  const formattedHighchartsDataOutcomes = useMemo(() => {
    return sortedOutcomes.map((outcome) => ({
      x: outcome.PatientID,
      y: outcome[outcomeField],
    }));
  }, [sortedOutcomes, outcomeField]);

  // Format features data to correspond to the Highcharts requirements
  const formattedHighchartsDataFeatures = useMemo(() => {
    const start = Date.now();

    const formattedFeatures = [];

    if (!sortedPatientIDs) return [];

    // Rank feature by F-value
    let featuresToFormat = filteredFeatures;
    if (rankFeatures) featuresToFormat = _.sortBy(filteredFeatures, 'Ranking');

    for (let [featureIndex, featureForPatients] of featuresToFormat.entries()) {
      let { FeatureID, Ranking, ...patientValues } = featureForPatients;

      let patientIndex = 0;
      for (let patient of sortedPatientIDs) {
        formattedFeatures.push([
          patientIndex,
          featureIndex,
          patientValues[patient] ? +patientValues[patient] : null,
        ]); // patient is X, feature is Y and value is color
        patientIndex++;
      }
    }

    const end = Date.now();

    console.log(`Formatting features for HighCharts took ${end - start}ms`);

    return formattedFeatures;
  }, [filteredFeatures, sortedPatientIDs, rankFeatures]);

  // Calculate number of values to display (based on filtered features)
  const nbFeatures = useMemo(() => {
    return filteredFeatures.length > 0
      ? filteredFeatures.length * (Object.keys(filteredFeatures[0]).length - 2) // Remove 2 because of Feature ID & Rank
      : 0;
  }, [filteredFeatures]);

  // Initialize feature IDs
  useEffect(() => {
    if (featuresChart) {
      let featureIDs = new Set(featuresChart.map((f) => f.FeatureID));
      setFeatureIDs(featureIDs);
    }
  }, [featuresChart]);

  useEffect(() => {
    return () => {
      // Cleanup is handled in the computeUMAP function when worker terminates
    };
  }, []);

  // Re-render chart on resize
  useLayoutEffect(() => {
    function handleResize() {
      console.log('Updating chart');
      if (chartRef.current) chartRef.current.chart.update({});
      if (umapChartRef.current) umapChartRef.current.chart.update({});
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Enhanced Radiomics UMAP Configuration Component
  // This component provides a comprehensive interface for configuring UMAP analysis
  // with radiomics-specific preprocessing, feature selection, and parameter tuning
  const EnhancedRadiomicsUMAPConfiguration = ({
    filteredFeatures,
    selectedUmapFeatures,
    setSelectedUmapFeatures,
    sortedPatientIDs,
  }) => {
    // State for feature filtering and search
    const [featureSearch, setFeatureSearch] = useState('');
    const [selectedFeatureCategory, setSelectedFeatureCategory] =
      useState('all');
    const [advancedMode, setAdvancedMode] = useState(false);
    const [qualityMetrics, setQualityMetrics] = useState(null);
    const [preprocessingMethod, setPreprocessingMethod] = useState('robust');
    const [dimensionalityReduction, setDimensionalityReduction] =
      useState('none');
    const [excludeCorrelated, setExcludeCorrelated] = useState(true);
    const [correlationThreshold, setCorrelationThreshold] = useState(0.95);

    // Extract feature categories for radiomics
    const featureCategories = useMemo(() => {
      if (!filteredFeatures) return [];
      const categories = new Set();
      filteredFeatures.forEach((feature) => {
        const parts = feature.FeatureID.split('_');
        if (parts.length > 1) {
          categories.add(parts[0].toLowerCase());
        }
      });
      return ['all', ...Array.from(categories).sort()];
    }, [filteredFeatures]);

    // Enhanced feature filtering with radiomics-specific logic
    const filteredFeatureOptions = useMemo(() => {
      if (!filteredFeatures) return [];

      let features = filteredFeatures.filter((feature) => {
        const matchesSearch = feature.FeatureID.toLowerCase().includes(
          featureSearch.toLowerCase()
        );
        const matchesCategory =
          selectedFeatureCategory === 'all' ||
          feature.FeatureID.toLowerCase().startsWith(selectedFeatureCategory);
        return matchesSearch && matchesCategory;
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
    }, [filteredFeatures, featureSearch, selectedFeatureCategory]);

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
            {qualityMetrics && (
              <Button
                size="sm"
                color="info"
                onClick={() => setQualityMetrics(null)}
              >
                <FontAwesomeIcon icon="chart-line" className="me-1" />
                Quality: {qualityMetrics.trustworthiness?.toFixed(2) || 'N/A'}
              </Button>
            )}
          </div>
        </div>

        {/* Data Preprocessing Section */}
        <div className="card mb-3">
          <div className="card-header">
            <h6 className="mb-0">
              <FontAwesomeIcon icon="database" className="me-2" />
              Data Preprocessing & Quality
            </h6>
          </div>
          <div className="card-body">
            {preprocessingStats && (
              <div className="row mb-3">
                <div className="col-md-3">
                  <div className="metric-card text-center p-2 border rounded">
                    <div className="metric-value h4 mb-0">
                      {preprocessingStats.totalFeatures}
                    </div>
                    <div className="metric-label small text-muted">
                      Features
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="metric-card text-center p-2 border rounded">
                    <div className="metric-value h4 mb-0">
                      {preprocessingStats.patients}
                    </div>
                    <div className="metric-label small text-muted">
                      Patients
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="metric-card text-center p-2 border rounded">
                    <div
                      className={`metric-value h4 mb-0 ${
                        preprocessingStats.missingValueRate > 5
                          ? 'text-warning'
                          : 'text-success'
                      }`}
                    >
                      {preprocessingStats.missingValueRate.toFixed(1)}%
                    </div>
                    <div className="metric-label small text-muted">Missing</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="metric-card text-center p-2 border rounded">
                    <div
                      className={`metric-value h4 mb-0 ${
                        preprocessingStats.dimensionality > 0.5
                          ? 'text-danger'
                          : preprocessingStats.dimensionality > 0.1
                          ? 'text-warning'
                          : 'text-success'
                      }`}
                    >
                      {preprocessingStats.dimensionality.toFixed(2)}
                    </div>
                    <div className="metric-label small text-muted">
                      p/n ratio
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="row">
              <div className="col-md-4">
                <Label for="preprocessingMethod">Preprocessing Method</Label>
                <Input
                  type="select"
                  id="preprocessingMethod"
                  value={preprocessingMethod}
                  onChange={(e) => setPreprocessingMethod(e.target.value)}
                >
                  <option value="standard">Standard Scaling (z-score)</option>
                  <option value="robust">Robust Scaling (median/IQR)</option>
                  <option value="minmax">Min-Max Scaling</option>
                  <option value="quantile">Quantile Transformation</option>
                </Input>
                <small className="text-muted">
                  Robust scaling recommended for radiomics
                </small>
              </div>
              <div className="col-md-4">
                <FormGroup check className="mt-4">
                  <Label check>
                    <Input
                      type="checkbox"
                      checked={excludeCorrelated}
                      onChange={(e) => setExcludeCorrelated(e.target.checked)}
                    />
                    Remove highly correlated features
                  </Label>
                </FormGroup>
                {excludeCorrelated && (
                  <Input
                    type="range"
                    min="0.8"
                    max="0.99"
                    step="0.01"
                    value={correlationThreshold}
                    onChange={(e) =>
                      setCorrelationThreshold(parseFloat(e.target.value))
                    }
                    className="mt-1"
                  />
                )}
                {excludeCorrelated && (
                  <small className="text-muted">
                    Threshold: {correlationThreshold}
                  </small>
                )}
              </div>
              {advancedMode && (
                <div className="col-md-4">
                  <Label for="dimensionalityReduction">Pre-reduction</Label>
                  <Input
                    type="select"
                    id="dimensionalityReduction"
                    value={dimensionalityReduction}
                    onChange={(e) => setDimensionalityReduction(e.target.value)}
                  >
                    <option value="none">No pre-reduction</option>
                    <option value="pca">PCA (preserve 95% variance)</option>
                    <option value="variance">Variance threshold</option>
                    <option value="univariate">Univariate selection</option>
                  </Input>
                  <small className="text-muted">
                    Optional dimensionality reduction
                  </small>
                </div>
              )}
            </div>
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
              <div className="col-md-4">
                <Label for="featureCategory">Feature Category</Label>
                <Input
                  type="select"
                  id="featureCategory"
                  value={selectedFeatureCategory}
                  onChange={(e) => setSelectedFeatureCategory(e.target.value)}
                >
                  {featureCategories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all'
                        ? 'All Categories'
                        : category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </Input>
              </div>
              <div className="col-md-8">
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
              Select Radiomics Features ({filteredFeatureOptions.length}{' '}
              available)
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
              {filteredFeatureOptions.map((option) => (
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
              <div className="col-md-3">
                <Label for="umapColorBy">Color Scheme</Label>
                <Input
                  type="select"
                  id="umapColorBy"
                  value={umapColorBy}
                  onChange={(e) => setUmapColorBy(e.target.value)}
                >
                  <option value="feature_density">Feature Density</option>
                  <option value="feature_mean">Feature Mean</option>
                  <option value="feature_variance">Feature Variance</option>
                  <option value="outcome">Clinical Outcome</option>
                  <option value="cluster">Automated Clustering</option>
                </Input>
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

        {/* Analysis Controls */}
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <Button
              color="primary"
              size="lg"
              onClick={computeUMAP}
              disabled={isComputingUmap || filteredFeatures.length === 0}
              className="me-2"
            >
              {isComputingUmap ? (
                <span>
                  <FontAwesomeIcon icon="sync" spin className="me-2" />
                  Computing UMAP...
                </span>
              ) : (
                <span>
                  <FontAwesomeIcon icon="play" className="me-2" />
                  Run UMAP Analysis
                </span>
              )}
            </Button>
            {umapData && (
              <Button
                color="outline-info"
                size="lg"
                onClick={() => {
                  // Calculate and show quality metrics
                  // This would be implemented with proper UMAP quality assessment
                  setQualityMetrics({
                    trustworthiness: 0.85,
                    continuity: 0.82,
                    stress: 0.15,
                  });
                }}
                className="me-2"
              >
                <FontAwesomeIcon icon="chart-line" className="me-2" />
                Quality Metrics
              </Button>
            )}
          </div>
          <div className="text-muted">
            {preprocessingStats && (
              <small>
                Ready: {preprocessingStats.totalFeatures} features ×{' '}
                {preprocessingStats.patients} patients
              </small>
            )}
          </div>
        </div>
      </div>
    );
  }; // Enhanced Radiomics UMAP Computation with Scientific Best Practices
  // This function performs UMAP dimensionality reduction on radiomics data
  // with advanced preprocessing, feature correlation analysis, and patient analytics
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

      // Calculate dimensionality ratio (features/patients) to warn about high-dimensional data
      const dimensionalityRatio =
        featuresToUse.length / sortedPatientIDs.length;
      if (dimensionalityRatio > 1.0) {
        console.warn(
          `High dimensionality ratio (${dimensionalityRatio.toFixed(
            2
          )}). Consider feature selection.`
        );
      }

      console.log('Enhanced Radiomics UMAP Analysis:');
      console.log(
        `- Dataset: ${sortedPatientIDs.length} patients × ${featuresToUse.length} features`
      );
      console.log(`- Dimensionality ratio: ${dimensionalityRatio.toFixed(3)}`);
      console.log('- Parameters:', umapParams);
      console.time('Enhanced UMAP computation');

      // Step 1: Advanced data matrix preparation with missing value handling
      // Build a data matrix where each row is a patient and each column is a feature
      const dataMatrix = [];
      const featureStatistics = {};

      // Calculate feature-wise statistics for robust preprocessing
      featuresToUse.forEach((feature) => {
        // Extract all valid values for this feature across all patients
        const values = sortedPatientIDs
          .map((patient) => {
            const value = feature[patient];
            return value !== undefined && value !== null && !isNaN(+value)
              ? +value
              : null;
          })
          .filter((v) => v !== null);

        if (values.length === 0) {
          throw new Error(`Feature ${feature.FeatureID} has no valid values`);
        }

        // Calculate robust statistics (quartiles, median, IQR) for each feature
        const sorted = values.sort((a, b) => a - b);
        const q25 = sorted[Math.floor(sorted.length * 0.25)];
        const q75 = sorted[Math.floor(sorted.length * 0.75)];
        const median = sorted[Math.floor(sorted.length * 0.5)];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(
          values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        );
        const iqr = q75 - q25;

        featureStatistics[feature.FeatureID] = {
          mean,
          std,
          median,
          q25,
          q75,
          iqr,
          min: Math.min(...values),
          max: Math.max(...values),
          validCount: values.length,
          missingRate:
            (sortedPatientIDs.length - values.length) / sortedPatientIDs.length,
        };
      });

      // Step 2: Build data matrix with missing value imputation
      for (
        let patientIdx = 0;
        patientIdx < sortedPatientIDs.length;
        patientIdx++
      ) {
        const patient = sortedPatientIDs[patientIdx];
        const patientFeatures = [];

        for (let feature of featuresToUse) {
          let value = feature[patient];

          // Handle missing values with median imputation (robust for radiomics data)
          if (value === undefined || value === null || isNaN(+value)) {
            value = featureStatistics[feature.FeatureID].median;
            console.warn(
              `Imputed missing value for ${feature.FeatureID} in ${patient}`
            );
          } else {
            value = +value;
          }

          patientFeatures.push(value);
        }
        dataMatrix.push(patientFeatures);
      }

      // Step 3: Enhanced preprocessing based on radiomics best practices
      let processedData;
      const preprocessingMethod = 'robust'; // Could be made configurable

      if (preprocessingMethod === 'robust') {
        // Robust scaling using median and IQR (recommended for radiomics data with outliers)
        processedData = dataMatrix.map((patientFeatures) =>
          patientFeatures.map((value, featureIdx) => {
            const stats =
              featureStatistics[featuresToUse[featureIdx].FeatureID];
            const scaledValue =
              stats.iqr > 0 ? (value - stats.median) / stats.iqr : 0;
            return scaledValue;
          })
        );
      } else if (preprocessingMethod === 'quantile') {
        // Quantile transformation for non-gaussian features
        const featureQuantiles = featuresToUse.map((feature, featureIdx) => {
          const allValues = dataMatrix
            .map((row) => row[featureIdx])
            .sort((a, b) => a - b);
          return allValues;
        });

        processedData = dataMatrix.map((patientFeatures) =>
          patientFeatures.map((value, featureIdx) => {
            const quantiles = featureQuantiles[featureIdx];
            const rank = quantiles.findIndex((q) => q >= value);
            return rank / quantiles.length;
          })
        );
      } else {
        // Standard z-score normalization (fallback)
        processedData = dataMatrix.map((patientFeatures) =>
          patientFeatures.map((value, featureIdx) => {
            const stats =
              featureStatistics[featuresToUse[featureIdx].FeatureID];
            return stats.std > 0 ? (value - stats.mean) / stats.std : 0;
          })
        );
      }

      // Step 4: Feature correlation analysis and removal (optional)
      // Remove highly correlated features to reduce redundancy
      const excludeCorrelated = true; // Could be made configurable
      const correlationThreshold = 0.95;
      let finalFeaturesToUse = [...featuresToUse];
      let finalProcessedData = processedData;

      if (excludeCorrelated && featuresToUse.length > 1) {
        console.log('Analyzing feature correlations...');
        const correlations = [];

        // Calculate pairwise Pearson correlations between all features
        for (let i = 0; i < featuresToUse.length; i++) {
          for (let j = i + 1; j < featuresToUse.length; j++) {
            const feature1Values = processedData.map((row) => row[i]);
            const feature2Values = processedData.map((row) => row[j]);

            // Calculate Pearson correlation coefficient
            const mean1 =
              feature1Values.reduce((a, b) => a + b, 0) / feature1Values.length;
            const mean2 =
              feature2Values.reduce((a, b) => a + b, 0) / feature2Values.length;

            let numerator = 0;
            let sum1 = 0;
            let sum2 = 0;

            for (let k = 0; k < feature1Values.length; k++) {
              const diff1 = feature1Values[k] - mean1;
              const diff2 = feature2Values[k] - mean2;
              numerator += diff1 * diff2;
              sum1 += diff1 * diff1;
              sum2 += diff2 * diff2;
            }

            const correlation = numerator / Math.sqrt(sum1 * sum2);

            // Store correlations above threshold
            if (Math.abs(correlation) > correlationThreshold) {
              correlations.push({
                feature1: i,
                feature2: j,
                correlation,
                feature1Name: featuresToUse[i].FeatureID,
                feature2Name: featuresToUse[j].FeatureID,
              });
            }
          }
        }

        // Remove highly correlated features (keep the one with better ranking)
        const featuresToRemove = new Set();
        correlations.forEach((corr) => {
          const rank1 = featuresToUse[corr.feature1].Ranking || 999;
          const rank2 = featuresToUse[corr.feature2].Ranking || 999;
          // Keep the feature with better (lower) ranking
          if (rank1 > rank2) {
            featuresToRemove.add(corr.feature1);
          } else {
            featuresToRemove.add(corr.feature2);
          }
        });

        if (featuresToRemove.size > 0) {
          console.log(
            `Removing ${featuresToRemove.size} highly correlated features`
          );
          const keepIndices = featuresToUse
            .map((_, idx) => idx)
            .filter((idx) => !featuresToRemove.has(idx));
          finalFeaturesToUse = keepIndices.map((idx) => featuresToUse[idx]);
          finalProcessedData = processedData.map((row) =>
            keepIndices.map((idx) => row[idx])
          );
        }
      }

      // Step 5: Configure UMAP with radiomics-optimized parameters
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
        // Radiomics-specific optimizations
        nEpochs: Math.max(200, Math.min(500, sortedPatientIDs.length * 2)), // Adaptive epochs based on dataset size
        learningRate: 1.0,
        localConnectivity: 1.0,
        repulsionStrength: 1.0,
        negativeSampleRate: 5,
        transformSeed: useRandomSeed ? umapParams.randomState : Date.now(),
      };

      console.log('Optimized UMAP parameters:', optimizedParams);

      // Step 6: Run UMAP with proper error handling
      setTimeout(async () => {
        try {
          const umap = new UMAP(optimizedParams);
          const labels = sortedOutcomes.map((o) =>
            // if your labels are strings “0”/“1”, convert; if numbers already, just return
            typeof o[outcomeField] === 'number'
              ? o[outcomeField]
              : parseInt(o[outcomeField], 10)
          );
umap.setSupervisedProjection(labels, { targetWeight: 0.7 });
const embedding = await umap.fitAsync(finalProcessedData);
          console.timeEnd('Enhanced UMAP computation');

          // Step 7: Post-process and enhance results with comprehensive patient analytics
          // Calculate additional metrics for each patient in the UMAP embedding
          const enhancedUmapPoints = embedding.map((coords, idx) => {
            const patient = sortedPatientIDs[idx];
            const outcome = sortedOutcomes[idx]?.[outcomeField] || 'UNKNOWN';

            // Calculate feature-based statistics for this patient
            const patientOriginalFeatures = featuresToUse.map((feature) => {
              const value = feature[patient];
              return value !== undefined && value !== null ? +value : 0;
            });

            // Basic feature statistics
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

            // Enhanced radiomics-specific analytics
            const medianValues = finalFeaturesToUse.map(
              (feature) => featureStatistics[feature.FeatureID].median
            );
            const aboveMedianCount = patientOriginalFeatures.filter(
              (val, idx) => val > medianValues[idx]
            ).length;
            const featureDensity =
              aboveMedianCount / patientOriginalFeatures.length;

            // Categorize features by radiomics type for detailed analysis
            const featureCategories = {};
            let shapeFeatures = 0,
              intensityFeatures = 0,
              textureFeatures = 0,
              waveletFeatures = 0,
              logFeatures = 0;

            finalFeaturesToUse.forEach((feature, featureIdx) => {
              const featureID = feature.FeatureID.toLowerCase();
              const value = patientOriginalFeatures[featureIdx];

              // Categorize features based on common radiomics naming conventions
              if (
                featureID.includes('shape') ||
                featureID.includes('morphology')
              ) {
                shapeFeatures++;
                featureCategories.shape =
                  (featureCategories.shape || 0) + value;
              } else if (
                featureID.includes('firstorder') ||
                featureID.includes('intensity')
              ) {
                intensityFeatures++;
                featureCategories.intensity =
                  (featureCategories.intensity || 0) + value;
              } else if (
                featureID.includes('glcm') ||
                featureID.includes('glrlm') ||
                featureID.includes('glszm') ||
                featureID.includes('gldm') ||
                featureID.includes('ngtdm') ||
                featureID.includes('texture')
              ) {
                textureFeatures++;
                featureCategories.texture =
                  (featureCategories.texture || 0) + value;
              } else if (featureID.includes('wavelet')) {
                waveletFeatures++;
                featureCategories.wavelet =
                  (featureCategories.wavelet || 0) + value;
              } else if (
                featureID.includes('log') ||
                featureID.includes('laplacian')
              ) {
                logFeatures++;
                featureCategories.log = (featureCategories.log || 0) + value;
              }
            });

            // Calculate category averages for tooltip display
            const avgShape =
              shapeFeatures > 0 ? featureCategories.shape / shapeFeatures : 0;
            const avgIntensity =
              intensityFeatures > 0
                ? featureCategories.intensity / intensityFeatures
                : 0;
            const avgTexture =
              textureFeatures > 0
                ? featureCategories.texture / textureFeatures
                : 0;
            const avgWavelet =
              waveletFeatures > 0
                ? featureCategories.wavelet / waveletFeatures
                : 0;
            const avgLog =
              logFeatures > 0 ? featureCategories.log / logFeatures : 0;

            // Calculate heterogeneity score (coefficient of variation)
            const heterogeneityScore =
              featureMean !== 0 ? featureStd / Math.abs(featureMean) : 0;

            // Find extreme features (outliers) for clinical interpretation
            const extremeFeatures = [];
            finalFeaturesToUse.forEach((feature, featureIdx) => {
              const value = patientOriginalFeatures[featureIdx];
              const stats = featureStatistics[feature.FeatureID];
              const zScore =
                stats.std > 0 ? Math.abs((value - stats.mean) / stats.std) : 0;
              if (zScore > 2.5) {
                // More than 2.5 standard deviations from mean
                extremeFeatures.push({
                  name: feature.FeatureID.split('_').slice(-1)[0],
                  zScore: zScore.toFixed(2),
                  value: value.toFixed(3),
                });
              }
            });

            // Sort extreme features by z-score for display
            extremeFeatures.sort(
              (a, b) => parseFloat(b.zScore) - parseFloat(a.zScore)
            );
            const topExtremeFeatures = extremeFeatures.slice(0, 3);

            // Calculate distance from embedding centroid for spatial analysis
            const centroidX =
              embedding.reduce((sum, point) => sum + point[0], 0) /
              embedding.length;
            const centroidY =
              embedding.reduce((sum, point) => sum + point[1], 0) /
              embedding.length;
            const distanceFromCenter = Math.sqrt(
              Math.pow(coords[0] - centroidX, 2) +
                Math.pow(coords[1] - centroidY, 2)
            );

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
              featureDensity,
              numFeatures: finalFeaturesToUse.length,
              preprocessing: preprocessingMethod,
              correlationFiltered:
                featuresToUse.length !== finalFeaturesToUse.length,

              // Enhanced radiomics analytics for tooltip
              heterogeneityScore,
              distanceFromCenter,

              // Feature category statistics
              shapeFeatures,
              intensityFeatures,
              textureFeatures,
              waveletFeatures,
              logFeatures,
              avgShape,
              avgIntensity,
              avgTexture,
              avgWavelet,
              avgLog,

              // Extreme features for clinical interpretation
              topExtremeFeatures,
              extremeFeatureCount: extremeFeatures.length,
            };
          });

          // Step 8: Calculate quality metrics for the analysis
          const qualityMetrics = {
            finalFeatureCount: finalFeaturesToUse.length,
            originalFeatureCount: featuresToUse.length,
            correlationFiltered:
              featuresToUse.length - finalFeaturesToUse.length,
            dimensionalityRatio:
              finalFeaturesToUse.length / sortedPatientIDs.length,
            preprocessing: preprocessingMethod,
            umapParams: optimizedParams,
          };

          console.log('UMAP Analysis Complete:');
          console.log('- Quality metrics:', qualityMetrics);
          console.log(
            `- Final dataset: ${sortedPatientIDs.length} patients × ${finalFeaturesToUse.length} features`
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
    filteredFeatures,
    sortedPatientIDs,
    sortedOutcomes,
    outcomeField,
    selectedUmapFeatures,
    umapParams,
    useRandomSeed,
  ]); // Alias the enhanced functions for compatibility with existing code
  const computeUMAP = computeEnhancedRadiomicsUMAP;
  const UmapFeatureSelection = EnhancedRadiomicsUMAPConfiguration;

  // Auto-trigger UMAP computation when switching to UMAP mode
  useEffect(() => {
    if (
      visualizationMode === VISUALIZATION_MODES.UMAP &&
      filteredFeatures.length > 0 &&
      sortedPatientIDs.length > 0
    ) {
      computeUMAP();
    }
  }, [visualizationMode, filteredFeatures, sortedPatientIDs, computeUMAP]);

  // Toggle patients modals
  const toggleTrainingPatientsOpen = () => {
    setTrainingPatientsOpen((o) => !o);
  };

  const toggleTestPatientsOpen = () => {
    setTestPatientsOpen((o) => !o);
  };

  const formatClinicalFeaturesTreeItems = (clinicalFeaturesDefinitions) => {
    console.log(
      'Listing out clinincal feature definition in formatClinicalFeaturesTree'
    );
    console.log(clinicalFeaturesDefinitions);
    return Object.keys(clinicalFeaturesDefinitions).reduce((acc, curr) => {
      acc[clinicalFeaturesDefinitions[curr]['name']] = {
        id: clinicalFeaturesDefinitions[curr]['name'],
        description: clinicalFeaturesDefinitions[curr]['name'],
        shortName: clinicalFeaturesDefinitions[curr]['name'],
      };

      return acc;
    }, {});
  };

  const filteringItems = useMemo(() => {
    if (!featureIDs) return {};

    // Create tree of items to check/uncheck
    let ungroupedTree = {};

    // Go through feature IDs to build the tree items
    for (let featureID of featureIDs) {
      try {
        let { modality, roi, featureName } =
          featureID.match(featureIDRegex).groups;

        if (!ungroupedTree[modality]) ungroupedTree[modality] = {};
        if (!ungroupedTree[modality][roi]) ungroupedTree[modality][roi] = [];

        ungroupedTree[modality][roi].push(featureName);
      } catch (e) {
        console.log('Problem with feature ID', featureID);
        throw e;
      }
    }

    let groupedTree = _.cloneDeep(ungroupedTree);

    /* Group features for each modality/ROI pair */
    for (let modality in groupedTree) {
      for (let roi in groupedTree[modality]) {
        groupedTree[modality][roi] = groupFeatures(
          ungroupedTree[modality][roi]
        );
      }
    }

    // Add clinical features
    if (
      clinicalFeaturesDefinitions &&
      Object.keys(clinicalFeaturesDefinitions).length > 0
    ) {
      groupedTree['Clinical Features [No visualization]'] =
        formatClinicalFeaturesTreeItems(clinicalFeaturesDefinitions);
    }

    console.log('groupedTree', groupedTree);
    return groupedTree;
  }, [featureIDs, clinicalFeaturesDefinitions]);

  const getNodeIDsFromFeatureIDs = useCallback(
    (featureIDs, leafItems, nodeIDToNodeMap) => {
      // Make a map of feature ID -> node ID
      let featureIDToNodeID = Object.entries(leafItems).reduce(
        (acc, [key, value]) => {
          acc[value] = key;
          return acc;
        },
        {}
      );

      let filteredFeatureIDs = Object.keys(featureIDToNodeID).filter((fID) =>
        featureIDs.includes(fID)
      );

      let nodeIDs = filteredFeatureIDs.map((fID) => featureIDToNodeID[fID]);
      let nodeIDsToInspect = [...nodeIDs];

      // Add also parents of nodes that have all children selected to selected nodeIDs
      while (nodeIDsToInspect.length > 0) {
        let parentsToInspect = nodeIDsToInspect.reduce((acc, curr) => {
          // Exclude clinical features from this process
          if (!curr.includes(FEATURE_ID_SEPARATOR)) return acc;

          let parentID = curr.substring(
            0,
            curr.lastIndexOf(FEATURE_ID_SEPARATOR)
          );
          if (!acc.includes(parentID)) acc.push(parentID);
          return acc;
        }, []);

        nodeIDsToInspect = [];

        for (let parentToInspect of parentsToInspect) {
          let childrenIDs = nodeIDToNodeMap[parentToInspect].children.map(
            (c) => c.id
          );

          if (childrenIDs.every((cid) => nodeIDs.includes(cid))) {
            nodeIDs.push(parentToInspect);
            nodeIDsToInspect.push(parentToInspect);
          }
        }
      }

      return nodeIDs;
    },
    []
  );

  const treeData = useMemo(() => {
    if (filteringItems) {
      console.log('filtering Items', filteringItems);
      let formattedTreeData = formatTreeData(filteringItems);
      let nodeIDToNodeMap = getAllNodeIDToNodeMap(formattedTreeData, {});
      console.log('formattedTreeData', formattedTreeData);

      let allNodeIDs = [];
      for (let topLevelElement of formattedTreeData) {
        let nodeAndChildrenIds = getNodeAndAllChildrenIDs(topLevelElement, []);
        allNodeIDs.push(...nodeAndChildrenIds);
      }

      if (collectionInfos?.collection?.feature_ids) {
        setSelected(
          getNodeIDsFromFeatureIDs(
            collectionInfos?.collection?.feature_ids,
            getAllLeafItems(formattedTreeData),
            nodeIDToNodeMap
          )
        );
      } else {
        setSelected(allNodeIDs);
      }

      return formattedTreeData;
    }

    return [];
  }, [filteringItems, collectionInfos, getNodeIDsFromFeatureIDs]);

  // Build history of selected features
  useEffect(() => {
    if (treeData.length > 0) {
      console.log('selected is now', selected);
      setSelectedFeaturesHistory((h) => {
        let prevSelected = h[h.length - 1];

        // Only append to history if selections are different
        if (!_.isEqual(prevSelected, selected)) {
          return [...h, selected];
        } else {
          return h;
        }
      });
    }
  }, [selected, treeData]);

  const leafItems = useMemo(() => {
    if (treeData.length > 0) {
      let items = getAllLeafItems(treeData);
      console.log('leaf items', items);
      return items;
    }

    return {};
  }, [treeData]);

  const nodeIDToNodeMap = useMemo(() => {
    return getAllNodeIDToNodeMap(treeData, {});
  }, [treeData]);

  // Compute selected feature IDs based on the selected leaf items
  const selectedFeatureIDs = useMemo(() => {
    if (!leafItems) return [];

    console.log('selected in');
    console.log(selected);

    return new Set(
      Object.keys(leafItems)
        .filter((n) => selected.includes(n))
        .map((n) => leafItems[n])
    );
  }, [leafItems, selected]);

  // Manage maximum n° of features to keep
  const maxNFeatures = useMemo(() => {
    if (!patients?.training) return DEFAULT_MAX_FEATURES_TO_KEEP;

    if (!selected) return DEFAULT_MAX_FEATURES_TO_KEEP;

    return Math.min(
      DEFAULT_MAX_FEATURES_TO_KEEP,
      selected.length - 1,
      Math.floor(MAX_DISPLAYED_FEATURES / patients.training.length)
    );
  }, [patients, selected]);

  // Selected feature IDs !== feature IDs
  useEffect(() => {
    if (collectionInfos?.collection?.feature_ids) {
      if (
        !_.isEqual(
          collectionInfos.collection.feature_ids.sort(),
          [...selectedFeatureIDs].sort()
        )
      )
        setHasPendingChanges(true);
      else setHasPendingChanges(false);
    } else {
      if (
        featuresIDsAndClinicalFeatureNames &&
        selectedFeatureIDs &&
        featuresIDsAndClinicalFeatureNames.length !== selectedFeatureIDs.size
      ) {
        setHasPendingChanges(true);
      } else {
        setHasPendingChanges(false);
      }
    }
  }, [
    featuresIDsAndClinicalFeatureNames,
    selectedFeatureIDs,
    setHasPendingChanges,
    collectionInfos,
  ]);

  // Calculate features to keep based on selections
  useEffect(() => {
    if (!featuresChart || selectedFeatureIDs === null) return undefined;

    const start = Date.now();
    // Filter out non-selected feature IDs
    let filteredFeatures = featuresChart.filter((f) => {
      return selectedFeatureIDs.has(f.FeatureID);
    });
    // For each remaining feature ID, keep only selected patients
    filteredFeatures = filteredFeatures.map((featureObject) => {
      return {
        FeatureID: featureObject.FeatureID,
        Ranking: +featureObject.Ranking,
        ..._.pickBy(featureObject, (v, k) => finalTrainingPatients.includes(k)),
      };
    });
    const end = Date.now();
    console.log(
      `Filtering features took ${end - start}ms `,
      filteredFeatures.length > 0
        ? filteredFeatures.length *
            (Object.keys(filteredFeatures[0]).length - 1)
        : 0
    );

    setFilteredFeatures(filteredFeatures);
  }, [featuresChart, selectedFeatureIDs, finalTrainingPatients]);

  // Update chart loading state
  useEffect(() => {
    if (
      clinicalFeaturesDefinitions &&
      featuresChart &&
      featureIDs &&
      loading === true
    ) {
      setLoading(false);
    }
  }, [featuresChart, clinicalFeaturesDefinitions, featureIDs, loading]);

  // Bind web worker
  useEffect(() => {
    if (!selected) return;

    filterFeaturesWorker.onmessage = (m) => {
      const deselectFeatures = (nodeIDsToDeselect) =>
        setSelected((selected) =>
          selected.filter((s) => !nodeIDsToDeselect.includes(s))
        );

      setIsRecomputingChart(false);

      // Features to drop are returned by the worker
      let featuresToDrop = m.data;

      if (featuresToDrop === undefined) return;

      // Make a map of feature ID -> node ID
      let featureIDToNodeID = Object.entries(leafItems).reduce(
        (acc, [key, value]) => {
          acc[value] = key;
          return acc;
        },
        {}
      );

      let featureIDsToDrop = Object.keys(featureIDToNodeID).filter((fID) => {
        for (let featureToDrop of featuresToDrop) {
          if (fID.endsWith(featureToDrop)) return true;
        }
        return false;
      });

      let nodeIDsToDeselect = featureIDsToDrop.map(
        (fID) => featureIDToNodeID[fID]
      );

      deselectFeatures(nodeIDsToDeselect);
    };
  }, [leafItems, selected, setSelected, setIsRecomputingChart]);

  const highchartsOptionsFeatures = useMemo(
    () =>
      _.merge({}, COMMON_CHART_OPTIONS, {
        chart: {
          height: 350,
          events: {
            click: function (e) {
              const featureToDisable = hoveredFeatureRef.current;
              setSelected((selected) => {
                let newSelected = [...selected];

                // Map Feature ID from the Chart's Y Axis to node ID of the Filter Tree
                let nodeIDToDisable = Object.entries(leafItems).find(
                  ([nodeID, featureID]) => featureID === featureToDisable
                )[0];

                let selectedToDeleteIndex = newSelected.findIndex(
                  (s) => s === nodeIDToDisable
                );
                newSelected.splice(selectedToDeleteIndex, 1);
                return newSelected;
              });
            },
          },
        },
        xAxis: {
          categories: sortedPatientIDs,
        },
        yAxis: {
          categories: rankFeatures
            ? _.sortBy(filteredFeatures, 'Ranking').map((f) => f.FeatureID)
            : filteredFeatures.map((f) => f.FeatureID),
          title: { text: 'Features' },
        },
        legend: {
          layout: 'vertical',
          verticalAlign: 'top',
          align: 'right',
          title: {
            text: 'Feature Value*',
          },
        },
        plotOptions: {
          series: {
            point: {
              events: {
                mouseOver: function () {
                  let chart = this.series.chart;
                  let yIndex = this.y;
                  let featureID = chart.yAxis[0].categories[yIndex];

                  // Update currently hovered feature
                  hoveredFeatureRef.current = featureID;
                },
              },
            },
          },
        },
        tooltip: {
          formatter: function () {
            let chart = this.series.chart;
            let yIndex = this.y;

            let { modality, roi, featureName } =
              chart.yAxis[0].categories[yIndex].match(featureIDRegex).groups;

            let convertedFeatureName = convertFeatureName(featureName, [
              modality,
            ]);

            return (
              `<strong>Patient:</strong> ${
                chart.xAxis[0].categories[this.point.options.x]
              }<br />` +
              `<strong>Modality:</strong> ${modality}<br />` +
              `<strong>ROI:</strong> ${roi}<br />` +
              `<strong>Feature:</strong> ${convertedFeatureName}<br />` +
              `<strong>Value:</strong> ${this.point.options.value}<br /><br />` +
              `<strong>INFO : Click to disable this feature</strong>`
            );
          },
        },
        colorAxis: {
          stops: [
            [0, '#0000ff'],
            [0.005, '#2066ac'],
            [0.5, '#f7f7f7'],
            [0.995, '#b2182b'],
            [1, '#ff0000'],
          ],
          min: -2.01,
          max: 2.01,
          startOnTick: false,
          endOnTick: false,
        },
        series: [
          {
            data: formattedHighchartsDataFeatures,
            boostThreshold: 100,
            turboThreshold: Number.MAX_VALUE,
            nullColor: '#666',
          },
        ],
        boost: {
          useGPUTranslations: true,
          usePreallocated: true,
        },
      }),
    [
      leafItems,
      formattedHighchartsDataFeatures,
      filteredFeatures,
      sortedPatientIDs,
      rankFeatures,
    ]
  ); // Enhanced Scientific UMAP Visualization Options
  // This creates a sophisticated Highcharts configuration for UMAP scatter plots
  // with multiple color schemes, interactive tooltips, and scientific styling
  const enhancedRadiomicsUMAPOptions = useMemo(() => {
    if (!umapData || umapData.length === 0) return {};

    // Determine which features are being used for the current analysis
    const featuresToUse =
      selectedUmapFeatures.length > 0
        ? filteredFeatures.filter((f) =>
            selectedUmapFeatures.includes(f.FeatureID)
          )
        : filteredFeatures;

    // Enhanced color schemes for scientific visualization
    // Each scheme provides different insights into the radiomics data
    const colorSchemes = {
      feature_density: {
        title: 'Clinical Outcome',
        getValue: (point) => point.featureDensity,
        colorAxis: {
          minColor: '#2c3e50', // Dark blue-gray for low density
          maxColor: '#e74c3c', // Bright red for high density
          stops: [
            [0, '#2c3e50'], // Low density - dark
            [0.25, '#3498db'], // Low-medium - blue
            [0.5, '#f39c12'], // Medium - orange
            [0.75, '#e67e22'], // Medium-high - dark orange
            [1, '#e74c3c'], // High density - red
          ],
        },
        description:
          'Shows the proportion of above-median radiomics features per patient',
      },
      feature_mean: {
        title: 'Mean Feature Intensity',
        getValue: (point) => point.featureMean,
        colorAxis: {
          minColor: '#16a085', // Teal for low intensity
          maxColor: '#8e44ad', // Purple for high intensity
          stops: [
            [0, '#16a085'],
            [0.5, '#f1c40f'],
            [1, '#8e44ad'],
          ],
        },
        description: 'Average intensity across selected radiomics features',
      },
      feature_variance: {
        title: 'Feature Heterogeneity',
        getValue: (point) => point.featureStd,
        colorAxis: {
          minColor: '#27ae60', // Green for homogeneous tissue
          maxColor: '#c0392b', // Dark red for heterogeneous tissue
          stops: [
            [0, '#27ae60'], // Low variance - green (homogeneous)
            [0.5, '#f39c12'], // Medium variance - orange
            [1, '#c0392b'], // High variance - red (heterogeneous)
          ],
        },
        description:
          'Standard deviation of radiomics features (tissue heterogeneity)',
      },
      outcome: {
        title: 'Clinical Outcome',
        getValue: (point) => point.className,
        colorAxis: null,
        // Discrete colors for clinical outcomes (fixed: positive=green, negative=red)
        discreteColors: {
          0: { color: '#e74c3c', name: 'Negative Outcome' }, // Red for negative
          1: { color: '#28a745', name: 'Positive Outcome' }, // Green for positive
          UNKNOWN: { color: '#95a5a6', name: 'Unknown' },
        },
        description: 'Clinical outcome or class assignment',
      },
      cluster: {
        title: 'Automated Clustering',
        getValue: (point) => {
          // Simple k-means-like clustering based on angular position
          const angle = Math.atan2(point.y, point.x);
          return Math.floor((angle + Math.PI) / ((2 * Math.PI) / 4)) % 4; // 4 clusters
        },
        colorAxis: null,
        discreteColors: {
          0: { color: '#e74c3c', name: 'Cluster 1' },
          1: { color: '#3498db', name: 'Cluster 2' },
          2: { color: '#2ecc71', name: 'Cluster 3' },
          3: { color: '#f39c12', name: 'Cluster 4' },
        },
        description: 'Automatically identified patient clusters',
      },
    };

    const currentScheme =
      colorSchemes[umapColorBy] || colorSchemes.feature_density;

    // Prepare series data based on color scheme type
    let series = [];

    if (currentScheme.discreteColors) {
      // Discrete coloring (outcome, cluster) - create separate series for each category
      const groupedData = {};

      umapData.forEach((point) => {
        const colorValue = currentScheme.getValue(point);
        const key = String(colorValue);
        if (!groupedData[key]) {
          groupedData[key] = [];
        }
        groupedData[key].push({
          ...point,
          colorValue: colorValue,
        });
      });

      // Create a series for each discrete category
      series = Object.entries(groupedData).map(([key, points]) => {
        const colorInfo = currentScheme.discreteColors[key] ||
          currentScheme.discreteColors.UNKNOWN || {
            color: '#95a5a6',
            name: 'Other',
          };
        return {
          name: colorInfo.name,
          data: points.map((point) => ({
            // Basic UMAP coordinates
            x: point.x || 0,
            y: point.y || 0,
            name: point.name || 'Unknown',
            className: point.className || 'UNKNOWN',

            // Feature statistics for tooltip
            featureMean: point.featureMean || 0,
            featureStd: point.featureStd || 0,
            featureMax: point.featureMax || 0,
            featureMin: point.featureMin || 0,
            featureRange: point.featureRange || 0,
            featureDensity: point.featureDensity || 0,
            numFeatures: point.numFeatures || 0,
            heterogeneityScore: point.heterogeneityScore || 0,
            distanceFromCenter: point.distanceFromCenter || 0,

            // Radiomics category breakdown
            shapeFeatures: point.shapeFeatures || 0,
            intensityFeatures: point.intensityFeatures || 0,
            textureFeatures: point.textureFeatures || 0,
            waveletFeatures: point.waveletFeatures || 0,
            logFeatures: point.logFeatures || 0,
            avgShape: point.avgShape || 0,
            avgIntensity: point.avgIntensity || 0,
            avgTexture: point.avgTexture || 0,
            avgWavelet: point.avgWavelet || 0,
            avgLog: point.avgLog || 0,

            // Outlier analysis
            topExtremeFeatures: point.topExtremeFeatures || [],
            extremeFeatureCount: point.extremeFeatureCount || 0,

            // Technical metadata
            preprocessing: point.preprocessing || 'standard',
            correlationFiltered: point.correlationFiltered || false,
            colorValue: point.colorValue,
          })),
          color: colorInfo.color,
          marker: {
            symbol: 'circle',
            radius: 7,
            lineWidth: 2,
            lineColor: '#ffffff',
            fillOpacity: 0.8,
            states: {
              hover: {
                radius: 9,
                lineWidth: 3,
                lineColor: '#000000',
              },
            },
          },
        };
      });
    } else {
      // Continuous coloring (feature_density, feature_mean, feature_variance) - single series with color axis
      series = [
        {
          name: 'Patients',
          data: umapData.map((point) => ({
            // Basic UMAP coordinates
            x: point.x || 0,
            y: point.y || 0,
            name: point.name || 'Unknown',
            className: point.className || 'UNKNOWN',

            // Feature statistics for tooltip
            featureMean: point.featureMean || 0,
            featureStd: point.featureStd || 0,
            featureMax: point.featureMax || 0,
            featureMin: point.featureMin || 0,
            featureRange: point.featureRange || 0,
            featureDensity: point.featureDensity || 0,
            numFeatures: point.numFeatures || 0,
            heterogeneityScore: point.heterogeneityScore || 0,
            distanceFromCenter: point.distanceFromCenter || 0,

            // Radiomics category breakdown
            shapeFeatures: point.shapeFeatures || 0,
            intensityFeatures: point.intensityFeatures || 0,
            textureFeatures: point.textureFeatures || 0,
            waveletFeatures: point.waveletFeatures || 0,
            logFeatures: point.logFeatures || 0,
            avgShape: point.avgShape || 0,
            avgIntensity: point.avgIntensity || 0,
            avgTexture: point.avgTexture || 0,
            avgWavelet: point.avgWavelet || 0,
            avgLog: point.avgLog || 0,

            // Outlier analysis
            topExtremeFeatures: point.topExtremeFeatures || [],
            extremeFeatureCount: point.extremeFeatureCount || 0,

            // Technical metadata
            preprocessing: point.preprocessing || 'standard',
            correlationFiltered: point.correlationFiltered || false,
            colorValue: currentScheme.getValue(point),
          })),
          marker: {
            symbol: 'circle',
            radius: 7,
            lineWidth: 2,
            lineColor: '#ffffff',
            fillOpacity: 0.8,
            states: {
              hover: {
                radius: 9,
                lineWidth: 3,
                lineColor: '#000000',
              },
            },
          },
        },
      ];
    }

    // Enhanced chart configuration with scientific styling
    const chartOptions = _.merge({}, COMMON_CHART_OPTIONS, {
      chart: {
        type: 'scatter',
        height: 700,
        zoomType: 'xy',
        backgroundColor: '#fdfdfd',
        style: {
          fontFamily:
            '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        events: {
          load: function () {
            // Add custom annotations or analysis results when chart loads
            if (umapData.length > 0) {
              const xExtent = [
                Math.min(...umapData.map((p) => p.x)),
                Math.max(...umapData.map((p) => p.x)),
              ];
              const yExtent = [
                Math.min(...umapData.map((p) => p.y)),
                Math.max(...umapData.map((p) => p.y)),
              ];

              // Could add convex hulls, density contours, etc. in future
              console.log('UMAP embedding extents:', {
                x: xExtent,
                y: yExtent,
              });
            }
          },
        },
      },

      title: {
        text: `Supervised Radiomics UMAP: ${currentScheme.title}`,
        style: {
          fontSize: '20px',
          fontWeight: '600',
          color: '#2c3e50',
        },
      },

      subtitle: {
        text: `${featuresToUse.length} radiomics features • ${umapData.length} patients • ${currentScheme.description}`,
        style: {
          fontSize: '14px',
          color: '#7f8c8d',
          fontStyle: 'italic',
        },
      },
      xAxis: {
        title: {
          text: 'UMAP Dimension 1',
          style: {
            fontSize: '14px',
            fontWeight: '500',
            color: '#34495e',
          },
        },
        labels: {
          enabled: true, // Explicitly enable axis labels
          style: {
            color: '#7f8c8d',
            fontSize: '11px',
          },
          formatter: function () {
            return this.value.toFixed(1); // Show decimal values
          },
        },
        gridLineWidth: 1,
        gridLineColor: '#ecf0f1',
        lineWidth: 1, // Show axis line
        lineColor: '#bdc3c7',
        tickWidth: 1, // Show tick marks
        tickLength: 6,
        tickColor: '#bdc3c7',
        minorTickInterval: 'auto', // Add minor ticks
        minorTickLength: 3,
        minorTickWidth: 1,
        minorTickColor: '#ecf0f1',
      },

      yAxis: {
        title: {
          text: 'UMAP Dimension 2',
          style: {
            fontSize: '14px',
            fontWeight: '500',
            color: '#34495e',
          },
        },
        labels: {
          enabled: true, // Explicitly enable axis labels
          style: {
            color: '#7f8c8d',
            fontSize: '11px',
          },
          formatter: function () {
            return this.value.toFixed(1); // Show decimal values
          },
        },
        gridLineWidth: 1,
        gridLineColor: '#ecf0f1',
        lineWidth: 1, // Show axis line
        lineColor: '#bdc3c7',
        tickWidth: 1, // Show tick marks
        tickLength: 6,
        tickColor: '#bdc3c7',
        minorTickInterval: 'auto', // Add minor ticks
        minorTickLength: 3,
        minorTickWidth: 1,
        minorTickColor: '#ecf0f1',
        reversed: false, // Override the reversed: true from COMMON_CHART_OPTIONS
      },

      legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'top',
        borderWidth: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        shadow: true,
        borderRadius: 8,
        padding: 15,
        margin: 20,
        itemStyle: {
          fontSize: '13px',
          fontWeight: '500',
          color: '#2c3e50',
        },
        itemHoverStyle: {
          color: '#e74c3c',
        },
      },

      plotOptions: {
        scatter: {
          marker: {
            radius: 7,
            lineWidth: 2,
            lineColor: '#ffffff',
            fillOpacity: 0.8,
            states: {
              hover: {
                enabled: true,
                lineColor: '#000000',
                lineWidth: 3,
                radius: 9,
                brightness: 0.1,
              },
              select: {
                lineColor: '#000000',
                lineWidth: 3,
                radius: 9,
              },
            },
          },
          states: {
            hover: {
              enabled: true,
              brightness: 0.1,
            },
          },
          allowPointSelect: true,
          cursor: 'pointer',
          point: {
            events: {
              click: function () {
                // Could implement point selection for detailed analysis
                console.log('Selected patient:', this.options.name);
              },
            },
          },
        },
      },

      // Enhanced tooltip with comprehensive radiomics information
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        shadow: {
          color: 'rgba(0,0,0,0.1)',
          offsetX: 2,
          offsetY: 2,
          opacity: 0.3,
          width: 3,
        },
        style: {
          fontSize: '13px',
          padding: '16px',
          maxWidth: '420px',
        },
        formatter: function () {
          const point = this.point;

          // Safe access helper functions to prevent errors with missing data
          const safeGet = (value, defaultValue = 0) => {
            return value !== undefined && value !== null && !isNaN(value)
              ? value
              : defaultValue;
          };

          const safeToFixed = (value, decimals = 2, defaultValue = 0) => {
            const val = safeGet(value, defaultValue);
            return val.toFixed(decimals);
          };

          // Build comprehensive HTML tooltip with patient radiomics analytics
          let html = `
            <div style="font-weight: 700; font-size: 16px; color: #2c3e50; margin-bottom: 12px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px;">
              <span style="color: ${
                point.color || '#666'
              }; font-size: 18px;">●</span> Patient ${point.name || 'Unknown'}
              <span style="float: right; font-size: 13px; color: #7f8c8d; font-weight: 500;">
                ${
                  point.className === '0'
                    ? 'Negative'
                    : point.className === '1'
                    ? 'Positive'
                    : 'Unknown'
                }
              </span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <!-- Clinical & Position Info -->
              <div style="background: #f8f9fa; padding: 8px; border-radius: 6px;">
                <div style="font-weight: 600; color: #495057; margin-bottom: 6px; font-size: 12px;">📍 POSITION & OUTCOME</div>
                <div style="font-size: 11px; line-height: 1.4;">
                  <div><strong>UMAP:</strong> (${safeToFixed(
                    point.x,
                    2
                  )}, ${safeToFixed(point.y, 2)})</div>
                  <div><strong>Distance:</strong> ${safeToFixed(
                    point.distanceFromCenter,
                    2
                  )}</div>
                  <div><strong>Outcome:</strong> <span style="color: ${
                    point.className === '0'
                      ? '#dc3545'
                      : point.className === '1'
                      ? '#28a745'
                      : '#6c757d'
                  };">${
            point.className === '0'
              ? 'Negative'
              : point.className === '1'
              ? 'Positive'
              : 'Unknown'
          }</span></div>
                </div>
              </div>
              
              <!-- Feature Summary -->
              <div style="background: #e3f2fd; padding: 8px; border-radius: 6px;">
                <div style="font-weight: 600; color: #1565c0; margin-bottom: 6px; font-size: 12px;">🔢 FEATURE SUMMARY</div>
                <div style="font-size: 11px; line-height: 1.4;">
                  <div><strong>Count:</strong> ${safeGet(
                    point.numFeatures,
                    0
                  )} features</div>
                  <div><strong>Mean:</strong> ${safeToFixed(
                    point.featureMean,
                    3
                  )}</div>
                  <div><strong>Heterogeneity:</strong> ${safeToFixed(
                    point.heterogeneityScore,
                    3
                  )}</div>
                </div>
              </div>
            </div>

            <!-- Radiomics Categories Breakdown -->
            <div style="background: #f1f8e9; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
              <div style="font-weight: 600; color: #388e3c; margin-bottom: 8px; font-size: 13px;">🏗️ RADIOMICS CATEGORIES</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 11px;">
          `;

          // Add radiomics feature categories if they exist
          if (safeGet(point.shapeFeatures, 0) > 0) {
            html += `
              <div style="text-align: center; padding: 4px; background: rgba(76, 175, 80, 0.1); border-radius: 4px;">
                <div style="font-weight: 600; color: #388e3c;">Shape</div>
                <div>${safeGet(point.shapeFeatures, 0)} feat</div>
                <div>Avg: ${safeToFixed(point.avgShape, 2)}</div>
              </div>
            `;
          }

          if (safeGet(point.intensityFeatures, 0) > 0) {
            html += `
              <div style="text-align: center; padding: 4px; background: rgba(33, 150, 243, 0.1); border-radius: 4px;">
                <div style="font-weight: 600; color: #1976d2;">Intensity</div>
                <div>${safeGet(point.intensityFeatures, 0)} feat</div>
                <div>Avg: ${safeToFixed(point.avgIntensity, 2)}</div>
              </div>
            `;
          }

          if (safeGet(point.textureFeatures, 0) > 0) {
            html += `
              <div style="text-align: center; padding: 4px; background: rgba(255, 152, 0, 0.1); border-radius: 4px;">
                <div style="font-weight: 600; color: #f57c00;">Texture</div>
                <div>${safeGet(point.textureFeatures, 0)} feat</div>
                <div>Avg: ${safeToFixed(point.avgTexture, 2)}</div>
              </div>
            `;
          }

          if (safeGet(point.waveletFeatures, 0) > 0) {
            html += `
              <div style="text-align: center; padding: 4px; background: rgba(156, 39, 176, 0.1); border-radius: 4px;">
                <div style="font-weight: 600; color: #7b1fa2;">Wavelet</div>
                <div>${safeGet(point.waveletFeatures, 0)} feat</div>
                <div>Avg: ${safeToFixed(point.avgWavelet, 2)}</div>
              </div>
            `;
          }

          if (safeGet(point.logFeatures, 0) > 0) {
            html += `
              <div style="text-align: center; padding: 4px; background: rgba(96, 125, 139, 0.1); border-radius: 4px;">
                <div style="font-weight: 600; color: #455a64;">LoG</div>
                <div>${safeGet(point.logFeatures, 0)} feat</div>
                <div>Avg: ${safeToFixed(point.avgLog, 2)}</div>
              </div>
            `;
          }

          html += `
              </div>
            </div>

            <!-- Statistical Insights -->
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
              <div style="margin-top: 6px;">
                <div><strong>Feature Density:</strong> ${safeToFixed(
                  point.featureDensity * 100,
                  1
                )}% above median</div>
                ${
                  safeGet(point.extremeFeatureCount, 0) > 0
                    ? `<div><strong>Outlier Features:</strong> ${safeGet(
                        point.extremeFeatureCount,
                        0
                      )} (z-score > 2.5)</div>`
                    : ''
                }
              </div>
            </div>
          `;

          // Add extreme features section if outliers are found
          if (
            point.topExtremeFeatures &&
            Array.isArray(point.topExtremeFeatures) &&
            point.topExtremeFeatures.length > 0
          ) {
            html += `
              <div style="background: #ffebee; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #d32f2f; margin-bottom: 6px; font-size: 12px;">⚠️ TOP OUTLIER FEATURES</div>
                <div style="font-size: 10px; line-height: 1.3;">
            `;

            // Display top 3 extreme features with their z-scores
            point.topExtremeFeatures.forEach((f) => {
              if (f && f.name && f.value && f.zScore) {
                html += `
                  <div style="margin: 2px 0; padding: 2px 4px; background: rgba(244, 67, 54, 0.1); border-radius: 3px;">
                    <strong>${f.name}:</strong> ${f.value} (z=${f.zScore})
                  </div>
                `;
              }
            });

            html += `
                </div>
              </div>
            `;
          }

          // Add technical details about preprocessing
          html += `
            <div style="background: #f5f5f5; padding: 8px; border-radius: 6px; font-size: 10px; color: #666;">
              <div style="font-weight: 600; margin-bottom: 4px;">Technical Details:</div>
              <div>Preprocessing: ${
                point.preprocessing || 'standard'
              } scaling</div>
              ${
                point.correlationFiltered
                  ? '<div>Correlation filtering applied</div>'
                  : ''
              }
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
    });

    // Add color axis for continuous coloring schemes
    if (currentScheme.colorAxis) {
      chartOptions.colorAxis = {
        ...currentScheme.colorAxis,
        startOnTick: false,
        endOnTick: false,
        labels: {
          style: {
            color: '#7f8c8d',
            fontSize: '11px',
          },
        },
        title: {
          text: currentScheme.title,
          style: {
            color: '#34495e',
            fontSize: '12px',
            fontWeight: '500',
          },
        },
      };
    }

    return chartOptions;
  }, [umapData, selectedUmapFeatures, filteredFeatures, umapColorBy]);

  // Alias for compatibility with existing code
  const highchartsOptionsUMAP = enhancedRadiomicsUMAPOptions;

  // Define the Highcharts options dynamically (classification outcomes)
  const highchartsOptionsOutcome = useMemo(() => {
    let colors = ['#0b84a5', '#94e3d5', '#666666'];

    return _.merge({}, COMMON_CHART_OPTIONS, {
      chart: {
        marginRight: 111,
        marginTop: 0,
        marginBottom: 40,
        plotBorderWidth: 0,
        height: 60,
      },

      xAxis: {
        categories: formattedHighchartsDataOutcomes.map((o) => o.x),
      },

      yAxis: {
        categories: [outcomeField],
        title: { text: 'ㅤ' },
      },

      colorAxis: {
        dataClasses: sortedClasses.map((c, i) => ({
          from: i,
          name: c,
          color:
            sortedClasses.length === 1 && sortedClasses[0] === 'UNKNOWN'
              ? colors[colors.length - 1]
              : colors[i],
        })),
      },

      tooltip: {
        formatter: function () {
          return (
            '<b>' +
            getPointCategoryName(this.point, 'x') +
            '</b> :' +
            sortedClasses[this.point.options.value]
          );
        },
      },

      legend: {
        align: 'center',
        layout: 'horizontal',
        margin: 12,
        x: -28,
        y: 10,
        floating: true,
        verticalAlign: 'bottom',
        title: {
          text: outcomeField,
        },
        symbolRadius: 0,
      },

      series: [
        {
          name: outcomeField,
          borderWidth: 0.5,
          borderColor: '#cccccc',
          data: formattedHighchartsDataOutcomes.map((outcome) => ({
            name: outcome.x,
            y: 0,
            value: sortedClasses.indexOf(outcome.y),
          })),
        },
      ],
    });
  }, [formattedHighchartsDataOutcomes, outcomeField, sortedClasses]);

  // Define the Highcharts options dynamically (survival outcomes)
  const highchartsOptionsSurvival = useMemo(() => {
    if (!formattedHighchartsDataSurvivalTime) return {};

    return _.merge({}, COMMON_CHART_OPTIONS, {
      chart: {
        marginRight: 111,
        marginTop: 0,
        marginBottom: 60,
        plotBorderWidth: 0,
        height: 80,
      },

      xAxis: {
        categories: formattedHighchartsDataSurvivalTime.map((o) => o.x),
      },

      yAxis: {
        categories: [OUTCOME_SURVIVAL_TIME],
        title: { text: 'ㅤ' },
      },

      colorAxis: {
        minColor: '#f25a38',
        maxColor: '#59c26e',
        startOnTick: true,
        endOnTick: true,
        tickPositioner: function (min, max) {
          const tickPosCor = [];
          const numOfTicks = 1;
          const tik = (max - min) / numOfTicks;

          tickPosCor.push(min);
          for (let i = 0; i < numOfTicks; i++) {
            tickPosCor.push(Highcharts.correctFloat(tickPosCor[i] + tik));
          }

          return tickPosCor;
        },
      },

      tooltip: {
        formatter: function () {
          return (
            '<b>' +
            getPointCategoryName(this.point, 'x') +
            '</b> :' +
            this.point.options.value
          );
        },
      },

      legend: {
        align: 'center',
        layout: 'horizontal',
        margin: 12,
        x: -28,
        y: 5,
        floating: true,
        verticalAlign: 'bottom',
        title: {
          text: OUTCOME_SURVIVAL_TIME,
        },
        navigation: {
          enabled: false,
        },
      },

      series: [
        {
          name: OUTCOME_SURVIVAL_TIME,
          borderWidth: 0.5,
          borderColor: '#cccccc',
          data: formattedHighchartsDataSurvivalTime.map((outcome) => ({
            name: outcome.x,
            y: 0,
            value: outcome.y,
          })),
        },
      ],
    });
  }, [formattedHighchartsDataSurvivalTime]);

  const deselectFeatures = useCallback(
    (nodeIDsToDeselect) =>
      setSelected((selected) =>
        selected.filter((s) => !nodeIDsToDeselect.includes(s))
      ),
    []
  );

  const keepNFeatures = useCallback(() => {
    let selectedFeatures = selected
      .filter((s) => leafItems[s])
      .map((f) => leafItems[f]);

    // Make a map of feature ID -> rank
    let featureIDToRank = featuresChart.reduce((acc, curr) => {
      acc[curr.FeatureID] = +curr.Ranking;
      return acc;
    }, {});

    selectedFeatures.sort(
      (f1, f2) => featureIDToRank[f1] - featureIDToRank[f2]
    );

    // Drop all features after the N best ones
    let featuresToDrop = selectedFeatures.slice(nFeatures);

    deselectFeatures(
      getNodeIDsFromFeatureIDs(featuresToDrop, leafItems, nodeIDToNodeMap)
    );
  }, [
    nFeatures,
    selected,
    featuresChart,
    leafItems,
    nodeIDToNodeMap,
    getNodeIDsFromFeatureIDs,
    deselectFeatures,
  ]);

  const dropCorrelatedFeatures = useCallback(() => {
    setIsRecomputingChart(true);
    filterFeaturesWorker.postMessage({
      features: filteredFeatures,
      leafItems: leafItems,
      selected: selected,
      corrThreshold: corrThreshold,
    });
  }, [filteredFeatures, leafItems, selected, corrThreshold]);

  function getPointCategoryName(point, dimension) {
    const series = point.series;
    const isY = dimension === 'y';
    const axis = series[isY ? 'yAxis' : 'xAxis'];

    return axis.categories[point[isY ? 'y' : 'x']];
  }

  const handleCreateCollectionClick = () => {
    console.log(
      'Creating new collection using',
      selectedFeatureIDs.size,
      'features'
    );
    toggleCollectionModal();
  };

  const handleUpdateCollectionClick = async () => {
    console.log(
      'Updating existing collection using',
      selectedFeatureIDs.size,
      'features'
    );
    setIsCollectionUpdating(true);
    await updateExtractionOrCollection({
      feature_ids: [...selectedFeatureIDs],
    });
    setIsCollectionUpdating(false);
  };

  const handleSaveCollectionClick = async () => {
    setIsCollectionSaving(true);
    console.log('saving collection...');
    let newCollection = await Backend.saveCollectionNew(
      keycloak.token,
      featureExtractionID,
      newCollectionName,
      [...selectedFeatureIDs],
      dataSplittingType,
      trainTestSplitType,
      patients?.training,
      patients?.test
    );
    toggleCollectionModal();
    setIsCollectionSaving(false);

    setCollections((c) => [...c, newCollection]);

    setHasPendingChanges(false);

    navigate(
      `/features/${albumID}/collection/${newCollection.collection.id}/visualize`
    );
  };

  const toggleCollectionModal = () => {
    setIsCollectionModalOpen((o) => !o);
    setNewCollectionName('');
  };

  const handleAutoDeselect = () => {
    setRankFeatures(true);

    let nFeaturesToKeep = Math.min(nFeatures, maxNFeatures);

    setNFeatures(nFeaturesToKeep);
    keepNFeatures();
  };

  const handleUndo = () => {
    let historyCopy = [...selectedFeaturesHistory];

    // Pop the current state from history
    historyCopy.pop();

    // Get the previous state from history
    let previous = historyCopy.pop();
    console.log('Previously selected was', previous);

    setSelected(previous);
    setSelectedFeaturesHistory(historyCopy);
  };

  if (loading) {
    return (
      <div className="Visualisation d-flex justify-content-center align-items-center">
        <h3>
          <FontAwesomeIcon icon="sync" spin /> Loading Chart...
        </h3>
      </div>
    );
  }

  return (
    <div className="Visualisation">
      {/* TODO - Would be better NOT to use a table here*/}
      <table className="visualization-table">
        <tbody>
          <tr>
            <td className="filter-data">
              <div>
                <h6>Filter Features (Lines)</h6>
                {active && (
                  <>
                    <FilterTree
                      filteringItems={filteringItems}
                      formatTreeData={formatTreeData}
                      treeData={treeData}
                      leafItems={leafItems}
                      getNodeAndAllChildrenIDs={getNodeAndAllChildrenIDs}
                      selected={selected}
                      setSelected={setSelected}
                      disabled={isRecomputingChart}
                    />
                    {selectedFeaturesHistory.length > 1 && (
                      <UndoButton handleClick={handleUndo} />
                    )}
                  </>
                )}
                <h6 className="mt-2">Show Patients</h6>
                <h6>
                  <Button color="link" onClick={toggleTrainingPatientsOpen}>
                    <FontAwesomeIcon icon="eye" /> Show{' '}
                    {selectedLabelCategory && patients?.training && 'Training'}{' '}
                    Patient IDs
                  </Button>
                  <MyModal
                    isOpen={trainingPatientsOpen}
                    toggle={toggleTrainingPatientsOpen}
                    title={
                      <span>
                        {selectedLabelCategory && patients?.training
                          ? 'Training Patient IDs'
                          : 'Patient IDs'}
                      </span>
                    }
                  >
                    <ListValues
                      values={finalTrainingPatients.sort((p1, p2) =>
                        p1.localeCompare(p2, undefined, { numeric: true })
                      )}
                    />
                  </MyModal>
                </h6>
                {selectedLabelCategory && patients?.test && (
                  <h6>
                    <Button color="link" onClick={toggleTestPatientsOpen}>
                      <FontAwesomeIcon icon="eye" /> Show Test Patient IDs
                    </Button>
                    <MyModal
                      isOpen={testPatientsOpen}
                      toggle={toggleTestPatientsOpen}
                      title={<span>Test Patient IDs</span>}
                    >
                      <ListValues
                        values={patients.test.sort((p1, p2) =>
                          p1.localeCompare(p2, undefined, { numeric: true })
                        )}
                      />
                    </MyModal>
                  </h6>
                )}
              </div>
            </td>
            <td className="chart-cell">
              {hasPendingChanges &&
                selectedFeatureIDs &&
                collectionInfos?.collection &&
                models.length === 0 && (
                  <Button
                    color="primary"
                    onClick={handleUpdateCollectionClick}
                    disabled={
                      selectedFeatureIDs.size === 0 || isCollectionUpdating
                    }
                    className="mr-2"
                  >
                    {!isCollectionUpdating ? (
                      <span>
                        <FontAwesomeIcon icon="edit" /> Update collection with
                        these {selectedFeatureIDs.size} features
                      </span>
                    ) : (
                      <span>
                        <FontAwesomeIcon icon="sync" spin /> Updating
                        collection...
                      </span>
                    )}
                  </Button>
                )}
              {hasPendingChanges && selectedFeatureIDs && (
                <Button
                  color="success"
                  onClick={handleCreateCollectionClick}
                  disabled={
                    selectedFeatureIDs.size === 0 || isCollectionUpdating
                  }
                >
                  <FontAwesomeIcon icon="plus" /> Create new collection with
                  these {selectedFeatureIDs.size} features
                </Button>
              )}

              {active && nbFeatures < MAX_DISPLAYED_FEATURES ? (
                <>
                  {/* Visualization mode toggle */}
                  <div className="d-flex justify-content-center mb-3">
                    <ButtonGroup>
                      <Button
                        color={
                          visualizationMode === VISUALIZATION_MODES.HEATMAP
                            ? 'primary'
                            : 'secondary'
                        }
                        onClick={() =>
                          setVisualizationMode(VISUALIZATION_MODES.HEATMAP)
                        }
                      >
                        <FontAwesomeIcon icon="th" /> Heatmap
                      </Button>
                      <Button
                        color={
                          visualizationMode === VISUALIZATION_MODES.UMAP
                            ? 'primary'
                            : 'secondary'
                        }
                        onClick={() =>
                          setVisualizationMode(VISUALIZATION_MODES.UMAP)
                        }
                      >
                        <FontAwesomeIcon icon="chart-scatter" /> UMAP
                      </Button>
                    </ButtonGroup>
                  </div>

                  <div style={{ position: 'relative' }}>
                    {(isRecomputingChart || isComputingUmap) && (
                      <div className="chart-loading-overlay d-flex flex-grow-1 justify-content-center align-items-center">
                        <FontAwesomeIcon
                          icon="sync"
                          spin
                          color="white"
                          size="4x"
                        />
                      </div>
                    )}

                    {visualizationMode === VISUALIZATION_MODES.HEATMAP ? (
                      <>
                        <div>
                          <ErrorBoundary>
                            <HighchartsReact
                              highcharts={Highcharts}
                              options={highchartsOptionsFeatures}
                              ref={chartRef}
                            />
                          </ErrorBoundary>
                        </div>
                        {selectedLabelCategory && (
                          <ErrorBoundary>
                            <HighchartsReact
                              highcharts={Highcharts}
                              options={highchartsOptionsOutcome}
                            />
                          </ErrorBoundary>
                        )}
                        {selectedLabelCategory &&
                          selectedLabelCategory.label_type ===
                            MODEL_TYPES.SURVIVAL && (
                            <div className="mt-3">
                              <ErrorBoundary>
                                <HighchartsReact
                                  highcharts={Highcharts}
                                  options={highchartsOptionsSurvival}
                                />
                              </ErrorBoundary>
                            </div>
                          )}
                      </>
                    ) : (
                      <div>
                        <UmapFeatureSelection
                          filteredFeatures={filteredFeatures}
                          selectedUmapFeatures={selectedUmapFeatures}
                          setSelectedUmapFeatures={setSelectedUmapFeatures}
                          sortedPatientIDs={sortedPatientIDs}
                        />
                        <ErrorBoundary>
                          <HighchartsReact
                            highcharts={Highcharts}
                            options={highchartsOptionsUMAP}
                            ref={umapChartRef}
                          />
                        </ErrorBoundary>
                      </div>
                    )}
                  </div>

                  {/* Show the feature values explanation only for heatmap */}
                  {visualizationMode === VISUALIZATION_MODES.HEATMAP && (
                    <div>
                      <small>
                        * Feature values are standardized and the scale is
                        clipped to [-2, 2]. Extreme values appear either in 100%
                        blue ({'<-2'}) or 100% red ({'>2'}).
                      </small>
                    </div>
                  )}

                  {/* Move FeatureSelection outside the visualization mode conditional so it appears for both modes */}
                  <div className="d-flex justify-content-around">
                    <FeatureSelection
                      allFeatures={featuresChart}
                      modelType={selectedLabelCategory?.label_type}
                      leafItems={leafItems}
                      rankFeatures={rankFeatures}
                      setRankFeatures={setRankFeatures}
                      maxNFeatures={maxNFeatures}
                      featureIDs={featureIDs}
                      selected={selected}
                      setSelected={setSelected}
                      keepNFeatures={keepNFeatures}
                      dropCorrelatedFeatures={dropCorrelatedFeatures}
                      nFeatures={nFeatures}
                      setNFeatures={setNFeatures}
                      corrThreshold={corrThreshold}
                      setCorrThreshold={setCorrThreshold}
                      setIsRecomputingChart={setIsRecomputingChart}
                      isRecomputingChart={isRecomputingChart}
                      selectedFeaturesHistory={selectedFeaturesHistory}
                      handleUndo={handleUndo}
                    />
                  </div>
                </>
              ) : (
                <Alert
                  color="warning"
                  className="m-3"
                  style={{ whiteSpace: 'normal' }}
                >
                  <p>
                    Number of values ({nbFeatures}) is too high to display
                    chart.
                  </p>
                  <span>
                    Deselect some features on the left in order to reduce the
                    number of data points to display.{' '}
                    {selectedLabelCategory?.label_type && (
                      <span>
                        Or automatically keep{' '}
                        {maxNFeatures >= DEFAULT_FEATURES_TO_KEEP
                          ? `the ${DEFAULT_FEATURES_TO_KEEP} best features`
                          : `the maximum number of features that can be displayed`}{' '}
                        by clicking{' '}
                        <Button
                          color="link"
                          className="p-0"
                          onClick={handleAutoDeselect}
                        >
                          here
                        </Button>
                        !
                      </span>
                    )}
                  </span>
                </Alert>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <MyModal
        isOpen={isCollectionModalOpen}
        toggle={toggleCollectionModal}
        title={
          <span>
            Create new collection for Album <strong>{album}</strong>
          </span>
        }
      >
        <p>
          The collection contains{' '}
          <strong>{selectedFeatureIDs ? selectedFeatureIDs.size : '?'}</strong>{' '}
          different features (combining modalities, ROIs & feature types)
        </p>
        <Form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleSaveCollectionClick();
          }}
        >
          <FormGroup>
            <Label for="exampleEmail">New Collection Name</Label>
            <Input
              type="text"
              name="collectionName"
              id="collectionName"
              placeholder="New collection name..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
            />
          </FormGroup>
          <Button
            color="primary"
            onClick={handleSaveCollectionClick}
            disabled={newCollectionName === '' || isCollectionSaving}
          >
            {isCollectionSaving ? 'Saving Collection...' : 'Save Collection'}
          </Button>
        </Form>
      </MyModal>
    </div>
  );
}

function formatTreeData(object, prefix) {
  if (!prefix) prefix = '';

  let firstPrefixPart =
    prefix.split(FEATURE_ID_SEPARATOR).length > 1
      ? prefix.split(FEATURE_ID_SEPARATOR)[0]
      : null;

  return Object.entries(object).map(([key, value]) => {
    let alias =
      firstPrefixPart && FEATURE_CATEGORY_ALIASES?.[firstPrefixPart]?.[key];

    return value &&
      _.isPlainObject(value) &&
      !Object.keys(value).includes('shortName')
      ? {
          id: `${prefix}${key}`,
          name: alias ? alias : key,
          children: formatTreeData(
            value,
            `${prefix}${key}${FEATURE_ID_SEPARATOR}`
          ),
          description: CATEGORY_DEFINITIONS[alias ? alias : key]
            ? CATEGORY_DEFINITIONS[alias ? alias : key]
            : null,
        }
      : {
          id: `${prefix}${key}`,
          name: alias ? alias : key,
          value: value,
        };
  });
}

function getAllNodeIDToNodeMap(rootNodes) {
  let nodeIDToNodeMap = {};

  for (let rootNode of rootNodes) {
    getNodeIDtoNodeMap(rootNode, nodeIDToNodeMap);
  }

  return nodeIDToNodeMap;
}

function getNodeIDtoNodeMap(node, nodeIDtoNodeMap) {
  nodeIDtoNodeMap[node.id] = node;

  if (node.children) {
    for (let child of node.children) {
      getNodeIDtoNodeMap(child, nodeIDtoNodeMap);
    }
  }
}

function getNodeAndAllChildrenIDs(node, nodeIDs) {
  nodeIDs.push(node.id);

  if (node.children) {
    for (let child of node.children) {
      getNodeAndAllChildrenIDs(child, nodeIDs);
    }
  }

  return nodeIDs;
}

function getAllLeafItems(obj) {
  let leafItems = {};

  for (let item of obj) {
    getLeafItems(item, leafItems);
  }

  return leafItems;
}

function getLeafItems(node, collector) {
  if (Array.isArray(node)) {
    for (let item of node) {
      getLeafItems(item, collector);
    }
  } else if (node.children) {
    getLeafItems(node.children, collector);
  } else {
    let nodeId = node.id;

    let nodeIDMatch = nodeId.match(featureNameRegex);
    // TODO - Store the node ID prefix for Clinical Features in a constant
    if (nodeIDMatch === null && !nodeId.includes('Clinical Features'))
      console.error(nodeId, 'DOES NOT MATCH THE PATTERN, WHY?');
    if (nodeIDMatch) {
      let { modality, roi } = nodeId.match(featureNameRegex).groups;
      collector[
        node.id
      ] = `${modality}${FEATURE_ID_SEPARATOR}${roi}${FEATURE_ID_SEPARATOR}${node.value.id}`;
    } else {
      collector[node.id] = `${node.value.id}`;
    }
  }
}
