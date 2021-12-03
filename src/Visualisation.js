import React, { useEffect, useState, useMemo } from 'react';
import Backend from './services/backend';
import { useHistory, useParams } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import HighchartsHeatmap from 'highcharts/modules/heatmap';
import HighchartsBoost from 'highcharts/modules/boost';

import _ from 'lodash';
import FilterTree from './components/FilterTree';
import { Alert, Button, Form, FormGroup, Input, Label } from 'reactstrap';
import CorrelatedFeatures from './components/CorrelatedFeatures';
import FeatureRanking from './components/FeatureRanking';
import { groupFeatures } from './utils/feature-naming';
import {
  FEATURE_DEFINITIONS,
  CATEGORY_DEFINITIONS,
  FEATURE_CATEGORY_ALIASES,
} from './utils/feature-mapping';
import FilterList from './components/FilterList';
import MyModal from './components/MyModal';
import {
  CLASSIFICATION_OUTCOMES,
  MODEL_TYPES,
  OUTCOME_CLASSIFICATION,
  OUTCOME_SURVIVAL_EVENT,
  OUTCOME_SURVIVAL_TIME,
  SURVIVAL_OUTCOMES,
} from './config/constants';
import {
  PET_SPECIFIC_PREFIXES,
  PYRADIOMICS_FEATURE_PREFIXES,
  RIESZ_FEATURE_PREFIXES,
} from './config/constants';
import { COMMON_CHART_OPTIONS } from './assets/charts/common';

import './Visualisation.css';

HighchartsHeatmap(Highcharts);
HighchartsBoost(Highcharts);

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
  const [isRecomputingChart, setIsRecomputingChart] = useState(false);

  // Manage feature selections (checkboxes)
  const [selected, setSelected] = useState([]);

  // Collection creation
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCollectionSaving, setIsCollectionSaving] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Filtered features (based on selections)
  const [filteredFeatures, setFilteredFeatures] = useState([]);

  // Determine outcome column to inspect for chart
  const outcomeField = useMemo(() => {
    if (!selectedLabelCategory) return null;

    let outcomeField =
      selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
        ? OUTCOME_CLASSIFICATION
        : OUTCOME_SURVIVAL_EVENT;

    return outcomeField;
  }, [selectedLabelCategory]);

  // Filter selected patients
  const selectedPatients = useMemo(() => {
    return new Set(patients.filter((p) => p.selected).map((p) => p.name));
  }, [patients]);

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
    for (let patient of selectedPatients) {
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
                patientOutcome.label_content[o] !== ''
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
  }, [selectedLabelCategory, selectedPatients, sortedClasses, outcomeField]);

  // Sort Patient IDs for the chart data
  const sortedPatientIDs = useMemo(() => {
    if (sortedOutcomes.length > 0) {
      return Array.from(new Set(sortedOutcomes.map((o) => o.PatientID)));
    } else {
      return Array.from(selectedPatients).sort((p1, p2) =>
        p1.localeCompare(p2, undefined, { numeric: true })
      );
    }
  }, [sortedOutcomes, selectedPatients]);

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

  // Initialize feature IDs & patients
  useEffect(() => {
    if (featuresChart) {
      let featureIDs = new Set(featuresChart.map((f) => f.FeatureID));
      setFeatureIDs(featureIDs);
      setSelectedFeatureIDs(featureIDs);

      // Get the patient IDs from the first "line" of the chart
      let { FeatureID, Ranking, ...patientIDs } = featuresChart[0];

      setPatients(
        Object.keys(patientIDs).map((p) => ({
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
    // Filter out non-selected feature IDs
    let filteredFeatures = featuresChart.filter((f) => {
      return selectedFeatureIDs.has(f.FeatureID);
    });
    // For each remaining feature ID, keep only selected patients
    filteredFeatures = filteredFeatures.map((featureObject) => {
      return {
        FeatureID: featureObject.FeatureID,
        Ranking: +featureObject.Ranking,
        ..._.pickBy(featureObject, (v, k) => selectedPatients.has(k)),
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
  }, [featuresChart, selectedFeatureIDs, selectedPatients]);

  // Calculate number of values to display (based on filtered features)
  const nbFeatures =
    filteredFeatures.length > 0
      ? filteredFeatures.length * (Object.keys(filteredFeatures[0]).length - 1)
      : 0;

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
      let formattedTreeData = formatTreeData(filteringItems);

      let allNodeIDs = [];
      for (let topLevelElement of formattedTreeData) {
        let nodeAndChildrenIds = getNodeAndAllChildrenIDs(topLevelElement, []);
        allNodeIDs.push(...nodeAndChildrenIds);
      }

      setSelected(allNodeIDs);

      return formattedTreeData;
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

  // Update chart
  useEffect(() => {
    if (featuresChart && featureIDs && loading === true) {
      setLoading(false);
      console.log('chart loaded');
    }
  }, [featuresChart, featureIDs, loading]);

  // Define the Highcharts options dynamically (features)
  const highchartsOptionsFeatures = useMemo(
    () =>
      _.merge({}, COMMON_CHART_OPTIONS, {
        chart: {
          height: 350,
        },
        xAxis: {
          categories: sortedPatientIDs,
        },
        yAxis: {
          categories: filteredFeatures.map((f) => f.FeatureID),
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
        tooltip: {
          formatter: function () {
            let chart = this.series.chart;
            let yIndex = this.y;

            let { modality, roi, featureName } = chart.yAxis[0].categories[
              yIndex
            ].match(featureIDRegex).groups;

            return (
              `<strong>Patient:</strong> ${
                chart.xAxis[0].categories[this.point.options.x]
              }<br />` +
              `<strong>Modality:</strong> ${modality}<br />` +
              `<strong>ROI:</strong> ${roi}<br />` +
              `<strong>Feature:</strong> ${featureName}<br />` +
              `<strong>Value:</strong> ${this.point.options.value}`
            );
          },
        },
        colorAxis: {
          stops: [
            [0, '#ff0000'],
            [0.005, '#eef8bc'],
            [0.5, '#47b5c1'],
            [0.995, '#1c3185'],
            [1, '#00ff00'],
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
            nullColor: '#000',
          },
        ],
        boost: {
          useGPUTranslations: true,
          usePreallocated: true,
        },
      }),
    [formattedHighchartsDataFeatures, filteredFeatures, sortedPatientIDs]
  );

  // Define the Highcharts options dynamically (outcomes)
  const highchartsOptionsOutcome = useMemo(() => {
    let colors = ['#59c26e', '#f25a38', '#666666'];

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

  function getPointCategoryName(point, dimension) {
    const series = point.series;
    const isY = dimension === 'y';
    const axis = series[isY ? 'yAxis' : 'xAxis'];

    return axis.categories[point[isY ? 'y' : 'x']];
  }

  // Define spec dynamically
  /*const lasagnaSpec = useMemo(() => {
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
      // finalSpec.vconcat[0].encoding.tooltip = [
      //   ...finalSpec.vconcat[0].encoding.tooltip,
      //   tooltipNode,
      // ];

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

    if (rankFeatures) finalSpec.vconcat[0].encoding.y.field = 'Ranking';
    else finalSpec.vconcat[0].encoding.y.field = 'FeatureID';

    return finalSpec;
  }, [selectedLabelCategory, filteredStatus, rankFeatures]);*/

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
      <div className="Visualisation d-flex justify-content-center align-items-center">
        <h3>
          <FontAwesomeIcon icon="sync" spin /> Loading Charts...
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

              {active && nbFeatures < MAX_DISPLAYED_FEATURES ? (
                <div>
                  <div style={{ position: 'relative' }}>
                    {isRecomputingChart && (
                      <div className="chart-loading-overlay d-flex flex-grow-1 justify-content-center align-items-center">
                        <FontAwesomeIcon
                          icon="sync"
                          spin
                          color="white"
                          size="4x"
                        />
                      </div>
                    )}
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={highchartsOptionsFeatures}
                    />
                  </div>
                  {selectedLabelCategory && (
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={highchartsOptionsOutcome}
                    />
                  )}
                  {selectedLabelCategory &&
                    selectedLabelCategory.label_type ===
                      MODEL_TYPES.SURVIVAL && (
                      <div className="mt-3">
                        <HighchartsReact
                          highcharts={Highcharts}
                          options={highchartsOptionsSurvival}
                        />
                      </div>
                    )}
                </div>
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
                  setIsRecomputingChart={setIsRecomputingChart}
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
