import React, { useEffect, useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import Backend from './services/backend';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UncontrolledTooltip, Modal, ModalHeader, ModalBody } from 'reactstrap';
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
import UMAPAnalysis from './UMAPAnalysis';

// ================= CONSTANTS =================
export const FEATURE_ID_SEPARATOR = '‑'; // This is a non-breaking hyphen to distinguish with normal hyphens that can occur in ROI names




// ...existing code...

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
  // Help modal state
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const toggleHelpModal = () => setHelpModalOpen((open) => !open);
  const [featureDefModal, setFeatureDefModal] = useState({ open: false, name: '', definition: '' });
  const openFeatureDefModal = (name) => {
    let def = null;
    if (FEATURE_DEFINITIONS && Array.isArray(FEATURE_DEFINITIONS)) {
      const found = FEATURE_DEFINITIONS.find((f) => f.name === name);
      if (found && found.definition) def = found.definition;
    }
    if (!def) def = 'No definition available.';
    setFeatureDefModal({ open: true, name, definition: def });
  };
  const closeFeatureDefModal = () => setFeatureDefModal({ open: false, name: '', definition: '' });

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
  useLayoutEffect(() => {    function handleResize() {
      console.log('Updating chart');
      if (chartRef.current) chartRef.current.chart.update({});
    }

    window.addEventListener('resize', handleResize);    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle patients modals

            // if your labels are strings “0”/“1”, convert; if numbers already, just return  // Toggle patients modals
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
  );

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
    <div className="Visualisation position-relative">
      {/* Contextual Help Button */}
      <button
        type="button"
        className="btn btn-link position-absolute"
        style={{ top: 10, right: 18, zIndex: 10, fontSize: 22, color: '#007bff' }}
        aria-label="Help"
        onClick={toggleHelpModal}
      >
        <FontAwesomeIcon icon="question-circle" />
      </button>
      {/* TODO - Would be better NOT to use a table here*/}
      <table className="visualization-table" style={{ marginTop: 16, marginBottom: 24 }}>
        <tbody>
          <tr>
            <td className="filter-data" style={{ borderRight: '1px solid #e0e0e0', paddingRight: 24, minWidth: 320 }}>
              <div style={{ marginBottom: 24 }}>
                <h6 style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 4, marginBottom: 12 }}>Filter Features (Lines)</h6>
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
                      // Feature definition tooltips/modal trigger
                      renderFeatureLabel={(name) => (
                        <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                          onClick={() => openFeatureDefModal(name)}
                          title="Click for feature definition"
                        >
                          {name}
                          <FontAwesomeIcon icon="info-circle" style={{ marginLeft: 4, fontSize: 13, color: '#007bff' }} />
                        </span>
                      )}
                    />
                    {selectedFeaturesHistory.length > 1 && (
                      <UndoButton handleClick={handleUndo} />
                    )}
                  </>
                )}
                <h6 className="mt-2" style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 4, marginBottom: 12, marginTop: 24 }}>Show Patients</h6>
                {/* UMAP projection info tooltip for user guidance */}
                <span style={{ display: 'inline-block', marginLeft: 8 }}>
                  <FontAwesomeIcon icon="info-circle" id="umapInfoIcon" style={{ color: '#007bff', cursor: 'pointer' }} />
                </span>
                <UncontrolledTooltip placement="right" target="umapInfoIcon">
                  <div style={{ maxWidth: 320 }}>
                    <strong>UMAP projection:</strong> UMAP (Uniform Manifold Approximation and Projection) is a dimensionality reduction technique that projects high-dimensional data (such as features) into 2D for visualization. Each point represents a patient, and the spatial arrangement reflects similarity in feature space. Use this to visually explore clusters or patterns among patients based on selected features.
                  </div>
                </UncontrolledTooltip>
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
                {/* UMAP projection info tooltip moved here from UMAPAnalysis.js */}
                <div className="d-flex align-items-center mt-2" style={{ marginBottom: 16 }}>
                  <span className="mr-1">UMAP projection</span>
                  <FontAwesomeIcon id="umap-info-icon" icon="info-circle" style={{ cursor: 'pointer', color: '#007bff' }} />
                  <UncontrolledTooltip placement="right" target="umap-info-icon">
                    UMAP (Uniform Manifold Approximation and Projection) is a dimensionality reduction technique used to visualize high-dimensional data in 2D. Here, each point represents a patient, and the distance between points reflects similarity in their selected features. Use this plot to explore patient clusters and patterns in the data.
                  </UncontrolledTooltip>
                </div>
              </div>
            </td>
            <td className="chart-cell" style={{ paddingLeft: 32, verticalAlign: 'top' }}>
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
                  <div className="d-flex justify-content-center mb-3" style={{ gap: 16 }}>
                    <ButtonGroup>
                      <Button
                        color={
                          visualizationMode === VISUALIZATION_MODES.HEATMAP
                            ? 'primary'
                            : 'secondary'
                        }
                        style={
                          visualizationMode === VISUALIZATION_MODES.HEATMAP
                            ? { border: '2px solid #007bff', fontWeight: 'bold', background: '#eaf3ff' }
                            : {}
                        }
                        onClick={() =>
                          setVisualizationMode(VISUALIZATION_MODES.HEATMAP)
                        }
                        aria-pressed={visualizationMode === VISUALIZATION_MODES.HEATMAP}
                      >
                        <FontAwesomeIcon icon="th" /> Heatmap
                      </Button>
                      <Button
                        color={
                          visualizationMode === VISUALIZATION_MODES.UMAP
                            ? 'primary'
                            : 'secondary'
                        }
                        style={
                          visualizationMode === VISUALIZATION_MODES.UMAP
                            ? { border: '2px solid #007bff', fontWeight: 'bold', background: '#eaf3ff' }
                            : {}
                        }
                        onClick={() =>
                          setVisualizationMode(VISUALIZATION_MODES.UMAP)
                        }
                        aria-pressed={visualizationMode === VISUALIZATION_MODES.UMAP}
                      >
                        <FontAwesomeIcon icon="chart-scatter" /> UMAP
                      </Button>
                    </ButtonGroup>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 24, marginTop: 8 }}>
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
                      </>                    ) : (
                      <UMAPAnalysis
                        filteredFeatures={filteredFeatures}
                        sortedPatientIDs={sortedPatientIDs}
                        sortedOutcomes={sortedOutcomes}
                        outcomeField={outcomeField}
                        isComputingUmap={isComputingUmap}
                        setIsComputingUmap={setIsComputingUmap}
                      />
                    )}
                  </div>

                  {/* Show the feature values explanation only for heatmap */}
                  {visualizationMode === VISUALIZATION_MODES.HEATMAP && (
                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                      <small>
                        * Feature values are standardized and the scale is
                        clipped to [-2, 2]. Extreme values appear either in 100%
                        blue ({'<-2'}) or 100% red ({'>2'}).
                      </small>
                    </div>
                  )}

                  {/* Move FeatureSelection outside the visualization mode conditional so it appears for both modes */}
                  <div className="d-flex justify-content-around" style={{ marginTop: 24 }}>
      {/* Help Modal */}
      <Modal isOpen={helpModalOpen} toggle={toggleHelpModal} size="lg">
        <ModalHeader toggle={toggleHelpModal}>Help & Documentation</ModalHeader>
        <ModalBody>
          <h5>How to Use This Page</h5>
          <ul>
            <li><strong>Visualization Mode:</strong> Use the Heatmap/UMAP toggle to switch between feature heatmap and patient clustering views. The active mode is highlighted.</li>
            <li><strong>Feature Selection:</strong> Select features on the left. Click on a feature name <FontAwesomeIcon icon="info-circle" style={{ color: '#007bff' }} /> to see its definition (IBSI standard where available).</li>
            <li><strong>Show Patients:</strong> View training/test patient IDs and explore UMAP projection explanations.</li>
            <li><strong>Collections:</strong> Save or update feature collections for further analysis.</li>
          </ul>
          <h5>Radiomics Standards</h5>
          <p>This tool follows <a href="https://ibsi.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer">IBSI</a> (Image Biomarker Standardisation Initiative) nomenclature for feature definitions where possible. For more, see the <a href="https://ibsi.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer">IBSI documentation</a>.</p>
          <h5>Troubleshooting</h5>
          <ul>
            <li>If a chart fails to load, check your feature selection and try reducing the number of features.</li>
            <li>For errors, look for clear messages below or in the alert banners. If a computation fails, try again or contact support with the error details.</li>
          </ul>
        </ModalBody>
      </Modal>

      {/* Feature Definition Modal */}
      <Modal isOpen={featureDefModal.open} toggle={closeFeatureDefModal}>
        <ModalHeader toggle={closeFeatureDefModal}>Feature Definition: {featureDefModal.name}</ModalHeader>
        <ModalBody>
          <p>{featureDefModal.definition}</p>
          <p style={{ fontSize: 13, color: '#888' }}>Source: <a href="https://ibsi.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer">IBSI Standard</a> (where available)</p>
        </ModalBody>
      </Modal>
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
