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
import { Alert, Button, Form, FormGroup, Input, Label, ButtonGroup } from 'reactstrap';
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
  UMAP: 'umap'
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
  const [visualizationMode, setVisualizationMode] = useState(VISUALIZATION_MODES.HEATMAP);

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

  // Add new state for selected features for UMAP
  const [selectedUmapFeatures, setSelectedUmapFeatures] = useState([]);

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

  // Add feature selection component for UMAP
  const UmapFeatureSelection = () => {
    const featureOptions = useMemo(() => {
      if (!filteredFeatures) return [];
      return filteredFeatures.map(feature => ({
        value: feature.FeatureID,
        label: `${feature.FeatureID} (Rank: ${feature.Ranking})`
      }));
    }, []);

    return (
      <div className="mb-3">
        <Label for="umapFeatureSelect">Select Features for UMAP Analysis</Label>
        <Input
          type="select"
          id="umapFeatureSelect"
          multiple
          value={selectedUmapFeatures}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, option => option.value);
            setSelectedUmapFeatures(selected);
          }}
          style={{ minHeight: '100px' }}
        >
          {featureOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <small className="text-muted">
          Hold Ctrl/Cmd to select multiple features. UMAP will be computed using only the selected features.
        </small>
      </div>
    );
  };

  // Modify computeUMAP to use selected features
  const computeUMAP = useCallback(async () => {
    setIsComputingUmap(true);
    try {
      // Prepare data matrix (patients x features)
      const dataMatrix = [];
      for (let patient of sortedPatientIDs) {
        const patientFeatures = [];
        // Only use selected features if any are selected, otherwise use all features
        const featuresToUse = selectedUmapFeatures.length > 0 
          ? filteredFeatures.filter(f => selectedUmapFeatures.includes(f.FeatureID))
          : filteredFeatures;
        
        for (let feature of featuresToUse) {
          const value = feature[patient];
          patientFeatures.push(value !== undefined && value !== null ? +value : 0);
        }
        dataMatrix.push(patientFeatures);
      }

      // Configure UMAP with better parameters for visualization
      const umap = new UMAP({
        nComponents: 2,
        nNeighbors: Math.min(30, Math.floor(sortedPatientIDs.length / 3)),
        minDist: 0.3,
        spread: 1.5,
        random_state: 42,
      });

      // Fit and transform
      const embedding = await umap.fitAsync(dataMatrix);
      
      // Format for Highcharts
      const umapPoints = embedding.map((coords, idx) => ({
        x: coords[0],
        y: coords[1],
        name: sortedPatientIDs[idx],
        className: sortedOutcomes[idx]?.[outcomeField] || 'UNKNOWN',
      }));

      setUmapData(umapPoints);
    } catch (error) {
      console.error('Error computing UMAP:', error);
    } finally {
      setIsComputingUmap(false);
    }
  }, [filteredFeatures, sortedPatientIDs, sortedOutcomes, outcomeField, selectedUmapFeatures]);

  useEffect(() => {
    if (visualizationMode === VISUALIZATION_MODES.UMAP && filteredFeatures.length > 0 && sortedPatientIDs.length > 0) {
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
    console.log("Listing out clinincal feature definition in formatClinicalFeaturesTree")
    console.log(clinicalFeaturesDefinitions);
    return Object.keys(clinicalFeaturesDefinitions).reduce((acc, curr) => {
      acc[clinicalFeaturesDefinitions[curr]["name"]] = {
        id: clinicalFeaturesDefinitions[curr]["name"],
        description: clinicalFeaturesDefinitions[curr]["name"],
        shortName: clinicalFeaturesDefinitions[curr]["name"],
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
    
    console.log("selected in");
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
  );

  // UMAP Highcharts options
  const highchartsOptionsUMAP = useMemo(() => {
    if (!umapData) return {};

    // Clear distinct colors for binary classification
    const classColors = {
      '0': '#e74c3c',  
      '1': '#2ecc71',  // 2ecc71
      'UNKNOWN': '#95a5a6'  // gray for unknown
    };

    // Group data by class with enhanced styling
    const series = sortedClasses.map((className) => {
      const points = umapData.filter(point => String(point.className) === String(className));
      
      // Calculate density/clustering information
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
      const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;

      const color = classColors[String(className)] || classColors.UNKNOWN;

      return {
        name: `Class ${className}${className === '0' ? ' (Negative)' : className === '1' ? ' (Positive)' : ''}`,
        data: points.map(point => ({
          x: point.x,
          y: point.y,
          name: point.name,
          className: point.className,
          color: color,  // Set point color explicitly
          distanceFromCenter: Math.sqrt(
            Math.pow(point.x - xMean, 2) + Math.pow(point.y - yMean, 2)
          )
        })),
        color: color,  // Set series color
        marker: {
          symbol: 'circle',
          radius: 6,
          lineWidth: 1,
          lineColor: '#ffffff',
          fillOpacity: 0.85
        },
        center: { x: xMean, y: yMean }
      };
    });

    // Add cluster centers as separate series
    const centerSeries = series.map(s => ({
      name: `${s.name} center`,
      type: 'scatter',
      data: [{
        x: s.center.x,
        y: s.center.y,
        color: s.color  // Ensure center color matches series color
      }],
      marker: {
        symbol: 'diamond',
        radius: 12,
        fillColor: s.color,
        lineWidth: 2,
        lineColor: '#ffffff',
      },
      showInLegend: false
    }));

    return _.merge({}, COMMON_CHART_OPTIONS, {
      chart: {
        type: 'scatter',
        height: 600,
        zoomType: 'xy',
        backgroundColor: '#ffffff',
        style: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }
      },
      title: {
        text: 'UMAP Projection of Radiomics Features',
        style: {
          fontSize: '18px',
          fontWeight: 'bold'
        }
      },
      subtitle: {
        text: 'Red: Negative (Class 0) | Green: Positive (Class 1)',
        style: {
          fontSize: '14px',
          color: '#666'
        }
      },
      xAxis: {
        title: {
          text: 'UMAP Dimension 1',
          style: { fontSize: '14px' }
        },
        gridLineWidth: 1,
        gridLineColor: '#f0f0f0',
        lineColor: '#d0d0d0',
        tickColor: '#d0d0d0'
      },
      yAxis: {
        title: {
          text: 'UMAP Dimension 2',
          style: { fontSize: '14px' }
        },
        gridLineWidth: 1,
        gridLineColor: '#f0f0f0',
        lineColor: '#d0d0d0',
        tickColor: '#d0d0d0'
      },
      legend: {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'middle',
        borderWidth: 1,
        borderRadius: 5,
        backgroundColor: '#ffffff',
        shadow: true,
        padding: 12,
        itemStyle: {
          fontSize: '13px'
        }
      },
      plotOptions: {
        scatter: {
          marker: {
            radius: 6,
            lineWidth: 1,
            lineColor: '#ffffff',
            fillOpacity: 0.85,
            states: {
              hover: {
                enabled: true,
                lineColor: '#000000',
                lineWidth: 2,
                radius: 8
              }
            }
          },
          states: {
            hover: {
              enabled: true,
              brightness: 0.2
            }
          }
        }
      },
      tooltip: {
        useHTML: true,
        headerFormat: '<table>',
        pointFormat: `
          <tr><td style="color: {point.color}"><b>Patient:</b></td><td style="text-align: right"><b>{point.name}</b></td></tr>
          <tr><td style="color: {point.color}">Class:</td><td style="text-align: right">{point.className === "0" ? "Negative (0)" : point.className === "1" ? "Positive (1)" : point.className}</td></tr>
          <tr><td style="color: {point.color}">UMAP 1:</td><td style="text-align: right">{point.x:.2f}</td></tr>
          <tr><td style="color: {point.color}">UMAP 2:</td><td style="text-align: right">{point.y:.2f}</td></tr>
        `,
        footerFormat: '</table>',
        followPointer: true,
        style: {
          fontSize: '12px'
        }
      },
      series: [...series, ...centerSeries]
    });
  }, [umapData, sortedClasses]);

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
          color={visualizationMode === VISUALIZATION_MODES.HEATMAP ? 'primary' : 'secondary'}
          onClick={() => setVisualizationMode(VISUALIZATION_MODES.HEATMAP)}
        >
          <FontAwesomeIcon icon="th" /> Heatmap
        </Button>
        <Button
          color={visualizationMode === VISUALIZATION_MODES.UMAP ? 'primary' : 'secondary'}
          onClick={() => setVisualizationMode(VISUALIZATION_MODES.UMAP)}
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
          <UmapFeatureSelection />
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
          * Feature values are standardized and the scale is clipped
          to [-2, 2]. Extreme values appear either in 100% blue (
          {'<-2'}) or 100% red ({'>2'}).
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
