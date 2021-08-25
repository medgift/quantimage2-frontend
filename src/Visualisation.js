import React, { useEffect, useState, useMemo } from 'react';
import './Visualisation.css';
import Backend from './services/backend';
// Chart Specs
import Lasagna from './assets/charts/Lasagna.json';
import { useHistory, useParams } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

import _ from 'lodash';
import FilterTree from './components/FilterTree';
import { Button, Form, FormGroup, Input, Label } from 'reactstrap';
import CorrelatedFeatures from './components/CorrelatedFeatures';
import FeatureRanking from './components/FeatureRanking';
import {
  groupFeatures,
  MODALITIES,
  MODALITIES_MAP,
} from './utils/feature-naming';
import {
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

export default function Visualisation({
  active,
  selectedLabelCategory,
  lasagnaData,
  setLasagnaData,
  album,
  featureExtractionID,
  collectionInfos,
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
  const [featureNames, setFeatureNames] = useState([]);
  const [regions, setRegions] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [patients, setPatients] = useState([]);
  const [featureIDs, setFeatureIDs] = useState(null);

  // Feature ranking
  const [rankFeatures, setRankFeatures] = useState(false);

  // Drop correlated features
  const [dropCorrelatedFeatures, setDropCorrelatedFeatures] = useState(false);

  // Manage feature selections
  const [selected, setSelected] = useState([]);

  // Selected features
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  // Collection creation
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCollectionSaving, setIsCollectionSaving] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Get features & annotations
  useEffect(() => {
    async function initSelections() {
      setFeatureNames(
        [...new Set(lasagnaData.features.map((f) => f.feature_name))].map(
          (f) => ({
            name: f,
            selected: true,
          })
        )
      );
      setModalities(
        [...new Set(lasagnaData.features.map((f) => f.Modality))].map((m) => ({
          name: m,
          selected: true,
        }))
      );
      setRegions(
        [...new Set(lasagnaData.features.map((f) => f.ROI))].map((r) => ({
          name: r,
          selected: true,
        }))
      );
      setPatients(
        [...new Set(lasagnaData.features.map((f) => f.PatientID))].map((p) => ({
          name: p,
          selected: true,
        }))
      );

      // Set initial feature IDs (all) to show the chart in the right moment
      setFeatureIDs(new Set(lasagnaData.features.map((f) => f.feature_id)));
    }

    if (lasagnaData) initSelections();
  }, [lasagnaData]);

  // Filter selected patients
  const selectedPatients = useMemo(() => {
    return new Set(patients.filter((p) => p.selected).map((p) => p.name));
  }, [patients]);

  // Calculate features to keep based on selections
  useEffect(() => {
    if (!lasagnaData || featureIDs === null) return undefined;

    const start = Date.now();
    let filteredFeatures = lasagnaData.features.filter((f) => {
      return featureIDs.has(f.feature_id) && selectedPatients.has(f.PatientID);
    });
    const end = Date.now();
    console.log(`filtered features in ${end - start}ms `, filteredFeatures);

    setSelectedFeatures(filteredFeatures);
  }, [lasagnaData, featureIDs, selectedPatients]);

  const filteringItems = useMemo(() => {
    // Create tree of items to check/uncheck
    let tree = {};

    let featureGroups = groupFeatures(featureNames);

    // Go through modalities
    for (let modality of modalities) {
      if (!tree[modality.name]) tree[modality.name] = {};

      // Go through ROIs
      for (let region of regions) {
        if (!tree[modality.name][region.name])
          tree[modality.name][region.name] = {};

        // Filter out any modality-specific features that don't correspond to the current one
        let filteredFeatureGroups = _.omitBy(
          featureGroups,
          (value, key) =>
            MODALITIES.includes(key) && modality.name !== MODALITIES_MAP[key]
        );

        // Spread feature groups into the current Modality/ROI
        tree[modality.name][region.name] = { ...filteredFeatureGroups };
      }
    }

    return tree;
  }, [modalities, regions, featureNames]);

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
    if (!lasagnaData) return [];

    return lasagnaData.outcomes.filter((o) =>
      selectedPatients.has(o.PatientID)
    );
  }, [lasagnaData, selectedPatients]);

  // Update Vega
  useEffect(() => {
    if (lasagnaData && featureIDs && loading === true) {
      setLoading(false);
      console.log('charts loaded');
    }
  }, [lasagnaData, featureIDs, loading]);

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
    console.log('Creating new collection using', featureIDs.size, 'features');
    toggleCollectionModal();
  };

  const handleSaveCollectionClick = async () => {
    setIsCollectionSaving(true);
    console.log('saving collection...');
    let newCollection = await Backend.saveCollectionNew(
      keycloak.token,
      featureExtractionID,
      newCollectionName,
      [...featureIDs],
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
                    modalities={modalities}
                    regions={regions}
                    featureNames={featureNames}
                    featureIDs={featureIDs}
                    setFeatureIDs={setFeatureIDs}
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
                disabled={featureIDs.size === 0}
              >
                + Create new collection with these settings ({featureIDs.size}{' '}
                features)
              </Button>
              <div>
                {active && (
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
                )}
              </div>
              <div>
                <small>
                  * Feature values are standardized and the scale is clipped to
                  [-2, 2]. Outliers will appear either in white ({'<-2'}) or
                  black (>2).
                </small>
              </div>
              <div className="d-flex justify-content-around">
                <CorrelatedFeatures
                  lasagnaData={lasagnaData}
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
          The collection contains <strong>{featureIDs.size}</strong> different
          features (combining modalities, ROIs & feature types)
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

const FULL_FEATURE_NAME_PATTERN = /(?<modality>.*?)-(?<region>.*?)-(?<name>.*)/;

function getLeafItems(node, collector) {
  if (Array.isArray(node)) {
    for (let item of node) {
      getLeafItems(item, collector);
    }
  } else if (node.children) {
    getLeafItems(node.children, collector);
  } else {
    let nodeId = node.id;
    let { modality, region } = nodeId.match(FULL_FEATURE_NAME_PATTERN).groups;
    collector[node.id] = `${modality}-${region}-${node.value.id}`;
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
