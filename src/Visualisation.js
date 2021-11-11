import React, { useEffect, useState, useMemo } from 'react';
import './Visualisation.css';
import Backend from './services/backend';
// Chart Specs
import Lasagna from './assets/charts/Lasagna.json';
import { useHistory, useParams } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

import _ from 'lodash';
import FilterTree from './components/FilterTree';
import { Alert, Button, Form, FormGroup, Input, Label } from 'reactstrap';
import CorrelatedFeatures from './components/CorrelatedFeatures';
import FeatureRanking from './components/FeatureRanking';
import {
  groupFeatures,
  MODALITIES,
  MODALITIES_MAP,
} from './utils/feature-naming';
import {
  FEATURE_DEFINITIONS,
  CATEGORY_DEFINITIONS,
  FEATURE_CATEGORY_ALIASES,
} from './utils/feature-mapping';
import FilterList from './components/FilterList';
import MyModal from './components/MyModal';
import Loading from './visualisation/Loading';
import { VegaLite } from 'react-vega';
import {
  MODEL_TYPES,
  OUTCOME_CLASSIFICATION,
  OUTCOME_SURVIVAL_EVENT,
  OUTCOME_SURVIVAL_TIME,
} from './Features';
import {
  PET_SPECIFIC_PREFIXES,
  PYRADIOMICS_FEATURE_PREFIXES,
  RIESZ_FEATURE_PREFIXES,
} from './config/constants';
import { HeatMapCanvas } from '@nivo/heatmap';

const MAX_DISPLAYED_FEATURES = 200000;

let featureIDPattern = `(?<modality>.*?)-(?<roi>.*?)-(?<featureName>(?:${[
  ...RIESZ_FEATURE_PREFIXES,
  ...PYRADIOMICS_FEATURE_PREFIXES,
  ...PET_SPECIFIC_PREFIXES,
].join('|')}).*)`;

let featureIDRegex = new RegExp(featureIDPattern);

let featureCategories = Array.from(
  new Set(FEATURE_DEFINITIONS.map((fd) => fd.category))
);
featureCategories = [...featureCategories, ...PET_SPECIFIC_PREFIXES];
let featureNamePattern = `(?<modality>.*?)-(?<roi>.*)-(?<featureName>(?:${featureCategories.join(
  '|'
)}).*)`;

let featureNameRegex = new RegExp(featureNamePattern);

export default function Visualisation({
  active,
  selectedLabelCategory,
  album,
  featuresChart,
  outcomes,
  featureExtractionID,
  setCollections,
}) {
  // Route
  const { albumID } = useParams();

  // Keycloak
  const [keycloak] = useKeycloak();

  // History
  const history = useHistory();

  // Init
  const [loading, setLoading] = useState(true);

  // Features
  const [patients, setPatients] = useState([]);
  const [featureIDs, setFeatureIDs] = useState(null);
  const [selectedFeatureIDs, setSelectedFeatureIDs] = useState(null);

  // Feature ranking
  const [rankFeatures, setRankFeatures] = useState(false);

  // Drop correlated features
  const [dropCorrelatedFeatures, setDropCorrelatedFeatures] = useState(false);

  // Manage feature selections (checkboxes)
  const [selected, setSelected] = useState([]);

  // Selected features
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  // Collection creation
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCollectionSaving, setIsCollectionSaving] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Filter selected patients
  const selectedPatients = useMemo(() => {
    return new Set(patients.filter((p) => p.selected).map((p) => p.name));
  }, [patients]);

  // Initialize feature IDs & patients
  useEffect(() => {
    if (featuresChart) {
      let featureIDs = new Set(featuresChart.map((f) => f.feature_id));
      setFeatureIDs(featureIDs);
      setSelectedFeatureIDs(featureIDs);

      setPatients(
        [...new Set(featuresChart.map((f) => f.PatientID))].map((p) => ({
          name: p,
          selected: true,
        }))
      );
    }
  }, [featuresChart]);

  // Calculate features to keep based on selections
  useEffect(() => {
    if (!featuresChart || selectedFeatureIDs === null) return undefined;

    const start = Date.now();
    let filteredFeatures = featuresChart.filter((f) => {
      return (
        selectedFeatureIDs.has(f.feature_id) &&
        selectedPatients.has(f.PatientID)
      );
    });
    const end = Date.now();
    console.log(
      `filtered features in ${end - start}ms `,
      filteredFeatures.length
    );

    setSelectedFeatures(filteredFeatures);
  }, [featuresChart, selectedFeatureIDs, selectedPatients]);

  const filteringItems = useMemo(() => {
    if (!featureIDs) return {};

    // Create tree of items to check/uncheck
    let ungroupedTree = {};

    // Go through feature IDs to build the tree items
    for (let featureID of featureIDs) {
      let { modality, roi, featureName } = featureID.match(
        featureIDRegex
      ).groups;

      if (!ungroupedTree[modality]) ungroupedTree[modality] = {};
      if (!ungroupedTree[modality][roi]) ungroupedTree[modality][roi] = [];

      ungroupedTree[modality][roi].push(featureName);
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

    return groupedTree;
  }, [featureIDs]);

  const treeData = useMemo(() => {
    if (filteringItems) {
      let formattedData = formatTreeData(filteringItems);

      let allNodeIDs = [];
      for (let topLevelElement of formattedData) {
        let nodeAndChildrenIds = getNodeAndAllChildrenIDs(topLevelElement, []);
        allNodeIDs.push(...nodeAndChildrenIds);
      }

      setSelected(allNodeIDs);

      return formattedData;
    }

    return [];
  }, [filteringItems]);

  const leafItems = useMemo(() => {
    if (treeData.length > 0) {
      let items = getAllLeafItems(treeData);
      console.log('leaf items', items);
      return items;
    }

    return {};
  }, [treeData]);

  // Get filtered status data
  const filteredStatus = useMemo(() => {
    if (!featuresChart) return [];

    return outcomes.filter((o) => selectedPatients.has(o.PatientID));
  }, [outcomes, selectedPatients]);

  // Update Vega
  useEffect(() => {
    if (featuresChart && featureIDs && loading === true) {
      setLoading(false);
      console.log('charts loaded');
    }
  }, [featuresChart, featureIDs, loading]);

  // Define spec dynamically
  const lasagnaSpec = useMemo(() => {
    let finalSpec = _.cloneDeep(Lasagna);

    if (!filteredStatus) {
      finalSpec.vconcat = finalSpec.vconcat.splice(1, 1);
      return finalSpec;
    }

    let statusSorted;

    if (selectedLabelCategory) {
      let modelType = selectedLabelCategory.label_type;

      // Define field to use for outcomes based on the current label type
      let outcomeField =
        modelType === MODEL_TYPES.SURVIVAL
          ? OUTCOME_SURVIVAL_EVENT
          : OUTCOME_CLASSIFICATION;

      // Define tooltip
      let tooltipNode = {
        field: outcomeField,
        type: 'nominal',
        title: outcomeField,
      };

      // Add tooltip
      finalSpec.vconcat[0].encoding.tooltip = [
        ...finalSpec.vconcat[0].encoding.tooltip,
        tooltipNode,
      ];

      // Custom sort of patients
      statusSorted = filteredStatus.sort((p1, p2) => {
        if (modelType === MODEL_TYPES.SURVIVAL) {
          if (p1[OUTCOME_SURVIVAL_EVENT] > p2[OUTCOME_SURVIVAL_EVENT]) return 1;
          else if (p1[OUTCOME_SURVIVAL_EVENT] < p2[OUTCOME_SURVIVAL_EVENT])
            return -1;
          else if (+p1[OUTCOME_SURVIVAL_TIME] > +p2[OUTCOME_SURVIVAL_TIME])
            return 1;
          else if (+p1[OUTCOME_SURVIVAL_TIME] < +p2[OUTCOME_SURVIVAL_TIME])
            return -1;
          else return p1.PatientID > p2.PatientID;
        } else {
          if (p1[outcomeField] > p2[outcomeField]) return 1;
          else if (p1[outcomeField] < p2[outcomeField]) return -1;
          else return p1.PatientID > p2.PatientID;
        }
      });

      // Update patient labels at the bottom
      finalSpec.vconcat[1].encoding.color.field = outcomeField;

      // Custom color scheme (for UNKNOWN and then others)
      finalSpec.vconcat[1].encoding.color.scale.domain = [
        ...new Set(filteredStatus.map((p) => p[outcomeField])),
      ];
      finalSpec.vconcat[1].encoding.color.scale.range = [
        '#f25a38',
        '#59c26e',
        '#cccccc',
      ];

      // Survival, add also time below Event & remove x axis title for the Event
      if (outcomeField === OUTCOME_SURVIVAL_EVENT) {
        finalSpec.vconcat[1].encoding.x.title = false;
        finalSpec.vconcat[2] = { ...lasagnaSurvivalTimeChart };
      }
    } else {
      // No active outcome - Don't show the second chart
      finalSpec.vconcat.splice(1, 1);
      statusSorted = filteredStatus.sort(
        (p1, p2) => p1.PatientID > p2.PatientID
      );
    }

    let patientIDsSorted = statusSorted.map((p) => p.PatientID);

    for (let chart of finalSpec.vconcat) {
      chart.encoding.x.sort = patientIDsSorted;
    }

    if (rankFeatures) finalSpec.vconcat[0].encoding.y.field = 'feature_rank';
    else finalSpec.vconcat[0].encoding.y.field = 'feature_id';

    return finalSpec;
  }, [selectedLabelCategory, filteredStatus, rankFeatures]);

  const handleCreateCollectionClick = () => {
    console.log(
      'Creating new collection using',
      selectedFeatureIDs.size,
      'features'
    );
    toggleCollectionModal();
  };

  const handleSaveCollectionClick = async () => {
    setIsCollectionSaving(true);
    console.log('saving collection...');
    let newCollection = await Backend.saveCollectionNew(
      keycloak.token,
      featureExtractionID,
      newCollectionName,
      [...selectedFeatureIDs],
      patients
    );
    toggleCollectionModal();
    setIsCollectionSaving(false);

    setCollections((c) => [...c, newCollection]);

    history.push(
      `/features/${albumID}/collection/${newCollection.collection.id}/visualize`
    );
  };

  const toggleCollectionModal = () => {
    setIsCollectionModalOpen((o) => !o);
    setNewCollectionName('');
  };

  if (loading) {
    return (
      <div className="Visualisation">
        <Loading color="dark" className="flex-grow-1">
          <h3>Loading Charts...</h3>
        </Loading>
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
                  <FilterTree
                    filteringItems={filteringItems}
                    formatTreeData={formatTreeData}
                    treeData={treeData}
                    leafItems={leafItems}
                    getNodeAndAllChildrenIDs={getNodeAndAllChildrenIDs}
                    setSelectedFeatureIDs={setSelectedFeatureIDs}
                    selected={selected}
                    setSelected={setSelected}
                    disabled={dropCorrelatedFeatures}
                  />
                )}
                <h6>Filter Patients (Columns)</h6>
                <div className="filter-visualization">
                  <FilterList
                    label="patient"
                    values={patients}
                    setter={setPatients}
                  />
                </div>
              </div>
            </td>
            <td className="chart-cell">
              <Button
                color="success"
                onClick={handleCreateCollectionClick}
                disabled={selectedFeatureIDs.size === 0}
              >
                + Create new collection with these settings (
                {selectedFeatureIDs.size} features)
              </Button>

              {active && selectedFeatures.length < MAX_DISPLAYED_FEATURES ? (
                <div>
                  <VegaLite
                    spec={lasagnaSpec}
                    data={
                      lasagnaSpec.vconcat.length > 1
                        ? {
                            features: selectedFeatures,
                            status: filteredStatus,
                          }
                        : { features: selectedFeatures }
                    }
                  />
                </div>
              ) : (
                <Alert
                  color="warning"
                  className="m-3"
                  style={{ whiteSpace: 'normal' }}
                >
                  <p>
                    Number of data points ({selectedFeatures.length}) is too
                    high to display chart.
                  </p>
                  <span>
                    Deselect some features or patients on the left in order to
                    reduce the number of data points to display.
                  </span>
                </Alert>
              )}

              <div>
                <small>
                  * Feature values are standardized and the scale is clipped to
                  [-2, 2]. Outliers will appear either in white ({'<-2'}) or
                  black (>2).
                </small>
              </div>
              <div className="d-flex justify-content-around">
                <CorrelatedFeatures
                  featuresChart={featuresChart}
                  filteringItems={filteringItems}
                  leafItems={leafItems}
                  loading={loading}
                  featureIDs={featureIDs}
                  selected={selected}
                  setSelected={setSelected}
                  dropCorrelatedFeatures={dropCorrelatedFeatures}
                  setDropCorrelatedFeatures={setDropCorrelatedFeatures}
                />
                {selectedLabelCategory && (
                  <FeatureRanking
                    rankFeatures={rankFeatures}
                    setRankFeatures={setRankFeatures}
                  />
                )}
              </div>
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
          The collection contains <strong>{selectedFeatureIDs.size}</strong>{' '}
          different features (combining modalities, ROIs & feature types)
        </p>
        <Form>
          <FormGroup>
            <Label for="exampleEmail">New Collection Name</Label>
            <Input
              type="text"
              name="collectionName"
              id="collectionNAme"
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
    prefix.split('-').length > 1 ? prefix.split('-')[0] : null;

  return Object.entries(object).map(([key, value]) => {
    let alias =
      firstPrefixPart && FEATURE_CATEGORY_ALIASES?.[firstPrefixPart]?.[key];

    return value &&
      _.isPlainObject(value) &&
      !Object.keys(value).includes('shortName')
      ? {
          id: `${prefix}${key}`,
          name: alias ? alias : key,
          children: formatTreeData(value, `${prefix}${key}-`),
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

    let match = nodeId.match(featureNameRegex);
    if (match === null)
      console.error(nodeId, 'DOES NOT MATCH THE PATTERN, WHY?');

    let { modality, roi } = nodeId.match(featureNameRegex).groups;
    collector[node.id] = `${modality}-${roi}-${node.value.id}`;
  }
}

const lasagnaSurvivalTimeChart = {
  data: {
    name: 'status',
  },
  mark: 'rect',
  height: 20,
  width: 700,
  encoding: {
    x: {
      field: 'PatientID',
      type: 'nominal',
      title: 'Patients',
      sort: 'ascending',
      axis: {
        labels: false,
      },
    },
    color: {
      field: 'Time',
      type: 'quantitative',
      scale: {
        scheme: 'redblue',
      },
    },
    tooltip: [
      {
        field: 'PatientID',
        type: 'nominal',
        title: 'Patient',
      },
      { field: 'Event', type: 'nominal', title: 'Event' },
      { field: 'Time', type: 'quantitative', title: 'Time' },
    ],
  },
};
