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
                    return <TabPane key={c.id} tabId={c.id}></TabPane>;
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
