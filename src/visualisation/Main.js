import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  createRef,
  useMemo,
} from 'react';
import {
  Button,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  UncontrolledTooltip,
} from 'reactstrap';
import VegaChart from './VegaChart';
import Loading from './Loading';
import DisplayedAnnotation from './DisplayedAnnotation';
import useDynamicRefs from 'use-dynamic-refs';
import classnames from 'classnames';

import _ from 'lodash';

import * as ss from 'simple-statistics';

import './Main.scss';
import { NON_FEATURE_FIELDS } from '../Train';
import MyCheckbox from '../components/MyCheckbox';
import Measure from 'react-measure';
import FilterTree from '../components/FilterTree';
import {
  groupFeatures,
  MODALITIES,
  MODALITIES_MAP,
} from '../utils/feature-naming';
import FeaturesList from '../components/FeaturesList';
import MyModal from '../components/MyModal';

import Backend from '../services/backend';
import { useKeycloak } from 'react-keycloak';
import { useHistory } from 'react-router-dom';
import CorrelatedFeatures from '../components/CorrelatedFeatures';
import { get } from 'local-storage';
import {
  CATEGORY_DEFINITIONS,
  FEATURE_CATEGORY_ALIASES,
} from '../utils/feature-mapping';
import FeatureRanking from '../components/FeatureRanking';

const PYRADIOMICS_PREFIX = 'original';

const Main = (props, ref) => {
  const [getRef, setRef] = useDynamicRefs();

  const history = useHistory();

  const [keycloak, initialized] = useKeycloak();

  const [activeTab, setActiveTab] = useState(props.charts[0].id);

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  const [isCollectionSaving, setIsCollectionSaving] = useState(false);

  const [newCollectionName, setNewCollectionName] = useState('');

  const [isFeatureGroupModalOpen, setIsFeatureGroupModalOpen] = useState(false);

  const [currentFeatureGroup, setCurrentFeatureGroup] = useState(null);

  const [selected, setSelected] = useState([]);

  const [dropCorrelatedFeatures, setDropCorrelatedFeatures] = useState(false);

  // Feature ranking
  const [nRankedFeatures, setNRankedFeatures] = useState(null);

  const filteringItems = useMemo(() => {
    // Create tree of items to check/uncheck
    let tree = {};

    let featureGroups = groupFeatures(props.featureNames);

    // Go through modalities
    for (let modality of props.modalities) {
      if (!tree[modality.name]) tree[modality.name] = {};

      // Go through ROIs
      for (let region of props.regions) {
        if (!tree[modality.name][region.name])
          tree[modality.name][region.name] = {};

        // Filter out any modality-specific features that don't correspond to the current one
        let filteredFeatureGroups = _.omitBy(
          featureGroups,
          (value, key) =>
            MODALITIES.includes(key) && modality.name !== MODALITIES_MAP[key]
        );
        console.log('lets filter');

        // Spread feature groups into the current Modality/ROI
        tree[modality.name][region.name] = { ...filteredFeatureGroups };
      }
    }

    return tree;
  }, [props.modalities, props.regions, props.featureNames]);

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
    if (treeData) {
      let items = getAllLeafItems(treeData);
      console.log('leaf items', items);
      return items;
    }

    return {};
  }, [treeData]);

  // TODO - We can filter once the feature selection is more comprehensive (e.g. hierarchical)
  // React to "keep n ranked features" change
  /*useEffect(() => {
    if (props.featureNames.length > 0 && nRankedFeatures === null)
      setNRankedFeatures(Math.ceil(props.featureNames.length / 2));

    let selectedFeatures = props.featureNames.filter((f) => f.selected);

    if (nRankedFeatures > selectedFeatures.length)
      setNRankedFeatures(selectedFeatures.length);
  }, [props.featureNames, props.rankFeatures]);*/

  const toggle = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  const toggleModal = () => {
    setIsFeatureGroupModalOpen((o) => !o);
  };

  const toggleCollectionModal = () => {
    setIsCollectionModalOpen((o) => !o);
    setNewCollectionName('');
  };

  const [displayAnnotation, setDisplayedAnnotation] = useState(null);

  /*useEffect(() => {
    const temp = [];
    props.images.map((img, index) => {
      convertURIToImageData(props.images[index].img).then((image) => {
        image.id = img.id;
        image.raw = img.img;
        temp.push(image);
      });
    });
    setImages(temp);
  }, [props.images]);*/

  useImperativeHandle(ref, () => ({
    /*getChart(type) {
      return getRef(type + '-chart').current.getChart(type);
    },*/
    displayAnnotation(annotation) {
      setDisplayedAnnotation(annotation);
    },
    closeAnnotation() {
      closeAnnotation();
    },
  }));

  const closeAnnotation = () => {
    setDisplayedAnnotation(null);
  };

  const deleteAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askDelete(displayAnnotation);
  };

  const editAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askEdit(displayAnnotation);
  };

  const answerAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askAnswer(displayAnnotation);
  };

  const handleCreateCollectionClick = () => {
    //props.toggleTab('create');
    console.log(
      'Creating new collection using',
      props.featureIDs.length,
      'features'
    );
    toggleCollectionModal();
  };

  const handleSaveCollectionClick = async () => {
    setIsCollectionSaving(true);
    console.log('saving collection...');
    let newCollection = await Backend.saveCollectionNew(
      keycloak.token,
      props.featureExtractionID,
      newCollectionName,
      props.featureIDs,
      props.patients
    );
    toggleCollectionModal();
    setIsCollectionSaving(false);

    props.setCollections((c) => [...c, newCollection]);

    history.push(
      `/features/${props.albumID}/collection/${newCollection.collection.id}/visualize`
    );
  };

  return (
    <>
      <div className="Main-Visualization">
        {displayAnnotation ? (
          <>
            <DisplayedAnnotation
              annotation={displayAnnotation}
              close={closeAnnotation}
              delete={deleteAnnotation}
              edit={editAnnotation}
              answer={answerAnnotation}
              images={props.images}
            />
          </>
        ) : props.loading ? (
          <Loading color="dark">
            <h3>Loading Charts...</h3>
          </Loading>
        ) : (
          <>
            <Nav pills>
              {props.charts.map((c) => (
                <NavItem key={c.id}>
                  <NavLink
                    className={classnames({ active: activeTab === c.id })}
                    onClick={() => {
                      toggle(c.id);
                    }}
                  >
                    {c.title}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
            <div className="d-flex flex-column">
              {activeTab === 'pca' && <h2>Coming soon...</h2>}
              <div className="charts">
                <TabContent activeTab={activeTab}>
                  {props.charts.map((c) => {
                    return (
                      <TabPane key={c.id} tabId={c.id}>
                        {/*{activeTab === 'lasagna' && (
                          <div className="d-flex flex-column">
                            <div className="filters-visualization">
                              <div className="filter-visualization">
                                <div>Modalities</div>
                                <FilterList
                                  label="modality"
                                  values={props.modalities}
                                  setter={props.setModalities}
                                />
                              </div>
                              <div className="filter-visualization">
                                <div>ROIs</div>
                                <FilterList
                                  label="roi"
                                  values={props.regions}
                                  setter={props.setRegions}
                                />
                              </div>
                              <div className="filter-visualization">
                                <div>Patients</div>
                                <FilterList
                                  label="patient"
                                  values={props.patients}
                                  setter={props.setPatients}
                                />
                              </div>
                              <div className="filter-visualization">
                                <div>Feature Groups</div>
                                <FilterList
                                  label="featureGroup"
                                  values={featureGroups}
                                  setter={updateFeatureGroups}
                                  subgroups={true}
                                  subgroupClick={handleFeatureSubgroupClick}
                                  disabled={dropCorrelatedFeatures}
                                />
                              </div>
                            </div>
                            <div>
                              <Button
                                color="link"
                                onClick={handleCreateCollectionClick}
                              >
                                + Create collection with these settings
                              </Button>
                            </div>
                          </div>
                        )}*/}
                        <div id={c.id} key={c.id}>
                          {/* TODO - Would be better NOT to use a table here*/}
                          <table className="visualization-table">
                            <tbody>
                              <tr>
                                <td className="filter-data">
                                  <div>
                                    <h6>Filter Features (Lines)</h6>
                                    <FilterTree
                                      filteringItems={filteringItems}
                                      formatTreeData={formatTreeData}
                                      treeData={treeData}
                                      leafItems={leafItems}
                                      getNodeAndAllChildrenIDs={
                                        getNodeAndAllChildrenIDs
                                      }
                                      modalities={props.modalities}
                                      regions={props.regions}
                                      featureNames={props.featureNames}
                                      featureIDs={props.featureIDs}
                                      setFeatureIDs={props.setFeatureIDs}
                                      selected={selected}
                                      setSelected={setSelected}
                                      disabled={dropCorrelatedFeatures}
                                    />
                                    <h6>Filter Patients (Columns)</h6>
                                    <div className="filter-visualization">
                                      <FilterList
                                        label="patient"
                                        values={props.patients}
                                        setter={props.setPatients}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="chart-cell">
                                  <Button
                                    color="success"
                                    onClick={handleCreateCollectionClick}
                                    disabled={props.featureIDs.length === 0}
                                  >
                                    + Create new collection with these settings
                                    ({props.featureIDs.length} features)
                                  </Button>
                                  <VegaChart
                                    ref={setRef(c.id + '-chart')}
                                    title={c.title}
                                    chart={c.chart}
                                    type={c.type}
                                    setImage={
                                      c.id === 'lasagna'
                                        ? props.setLasagnaImg
                                        : props.setPcaImg
                                    }
                                  />
                                  <div>
                                    <small>
                                      * Feature values are standardized and the
                                      scale is clipped to [-2, 2]. Outliers will
                                      appear either in white ({'<-2'}) or black
                                      (>2).
                                    </small>
                                  </div>
                                  <div className="d-flex justify-content-around">
                                    <CorrelatedFeatures
                                      filteringItems={filteringItems}
                                      leafItems={leafItems}
                                      charts={props.charts}
                                      loading={props.loading}
                                      featureIDs={props.featureIDs}
                                      selected={selected}
                                      setSelected={setSelected}
                                      dropCorrelatedFeatures={
                                        dropCorrelatedFeatures
                                      }
                                      setDropCorrelatedFeatures={
                                        setDropCorrelatedFeatures
                                      }
                                    />
                                    <FeatureRanking
                                      rankFeatures={props.rankFeatures}
                                      setRankFeatures={props.setRankFeatures}
                                    />
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          {/*

                            <hr />
                            <p className="mt-4">
                              <strong>Feature ranking</strong>
                            </p>
                            <div>
                              <input
                                id="rank-feats"
                                type="checkbox"
                                value={props.rankFeatures}
                                onChange={(e) => {
                                  props.setRankFeatures(e.target.checked);
                                }}
                              />{' '}
                              <label htmlFor="rank-feats">
                                Rank by F-value{' '}
                                <FontAwesomeIcon
                                  icon="info-circle"
                                  id="ranking-explanation"
                                />
                                <UncontrolledTooltip
                                  placement="right"
                                  target="ranking-explanation"
                                >
                                  Sort the features (lines of the chart) so that
                                  more predictive features (when taken
                                  individually) will appear at the top and less
                                  predictive features will appear at the bottom.
                                </UncontrolledTooltip>
                              </label>
                            </div>*/}
                          {/* TODO - Put this back once it's possible to select specific features for a given modality/ROI*/}
                          {/*
                          <div>
                            <label htmlFor="n-features">
                              Number of features to keep
                            </label>
                            <br />
                            <input
                              id="n-features"
                              type="range"
                              min={1}
                              max={
                                props.featureNames.filter((f) => f.selected)
                                  .length
                              }
                              step={1}
                              onChange={(e) => {
                                setNRankedFeatures(+e.target.value);
                              }}
                              onMouseUp={(e) => {
                                disableFeatures([]);
                              }}
                              value={nRankedFeatures}
                              className="slider"
                            />
                            <span>{nRankedFeatures}</span>
                          </div>
                          */}
                        </div>
                      </TabPane>
                    );
                  })}
                </TabContent>
              </div>
            </div>
          </>
        )}
      </div>
      <MyModal
        isOpen={isCollectionModalOpen}
        toggle={toggleCollectionModal}
        title={
          <span>
            Create new collection for Album <strong>{props.album}</strong>
          </span>
        }
      >
        <p>
          The collection contains <strong>{props.featureIDs.length}</strong>{' '}
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
    </>
  );
};

function getFeatureGroups(featureNames) {
  let featureGroups = {};
  let currentFeatureGroup = '';

  for (let featureName of featureNames) {
    // TODO - Make this more elegant, maybe a convention for feature names is needed
    // Group PyRadiomics features by the second level,
    // first level for other backends so far
    let featureGroupName;

    let { name, selected } = featureName;

    // PET - Special case
    if (name.startsWith('PET')) {
      featureGroupName = 'PET';
    } else if (name.startsWith(PYRADIOMICS_PREFIX)) {
      featureGroupName = name.split('_')[1];
    } else {
      featureGroupName = name.split('_')[0] + '_' + name.split('_')[1];
    }

    if (featureGroupName !== currentFeatureGroup) {
      featureGroups[featureGroupName] = [];
      currentFeatureGroup = featureGroupName;
    }

    featureGroups[featureGroupName].push(name);
  }

  return Object.keys(featureGroups).map((fg) => ({
    name: fg,
    selected: featureNames
      .filter((f) => featureGroups[fg].includes(f.name))
      .every((f) => f.selected),
    isIndeterminate:
      featureNames
        .filter((f) => featureGroups[fg].includes(f.name))
        .every((f) => f.selected) === false &&
      featureNames
        .filter((f) => featureGroups[fg].includes(f.name))
        .every((f) => !f.selected) === false,
  }));
}

function FilterList({
  label,
  values,
  setter,
  subgroups,
  subgroupClick,
  disabled,
}) {
  const toggleValue = (name, checked, values, setter) => {
    let newValues = [...values];

    let valueToUpdate = newValues.find((v) => v.name === name);

    valueToUpdate.selected = checked;

    setter(newValues);
  };

  const handleAllClick = (selected) => {
    let newValues = [...values];

    let updatedValues = newValues.map((v) => ({ ...v, selected: selected }));

    setter(updatedValues);
  };

  return (
    <>
      <div>
        <Button
          color="link"
          onClick={() => handleAllClick(true)}
          disabled={disabled}
        >
          All
        </Button>{' '}
        |{' '}
        <Button
          color="link"
          onClick={() => handleAllClick(false)}
          disabled={disabled}
        >
          None
        </Button>{' '}
      </div>
      <ul>
        {values.map((v) => (
          <li key={`${label}-${v.name}`}>
            <MyCheckbox
              id={`${label}-${v.name}`}
              checked={v.selected === true}
              onChange={(e) => {
                toggleValue(v.name, e.target.checked, values, setter);
              }}
              isIndeterminate={v.isIndeterminate ? v.isIndeterminate : false}
              disabled={disabled}
            />{' '}
            <label htmlFor={`${label}-${v.name}`} disabled={disabled}>
              {v.name}
            </label>
            {subgroups && (
              <Button
                color="link"
                onClick={(e) => subgroupClick(e, v.name)}
                disabled={disabled}
              >
                +
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default forwardRef(Main);

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
