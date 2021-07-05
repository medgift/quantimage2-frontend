import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useCallback,
} from 'react';
import { useHistory, useParams } from 'react-router-dom';
import fileDownload from 'js-file-download';
import Backend from './services/backend';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardText,
  CardTitle,
  Form,
  FormGroup,
  Input,
  InputGroup,
  InputGroupText,
  InputGroupAddon,
  Label,
  ListGroup,
  ListGroupItem,
  Nav,
  NavItem,
  NavLink,
  Spinner,
  TabContent,
  Table,
  TabPane,
  ButtonDropdown,
  Collapse,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import FeaturesModal from './FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { downloadFeatureSet, trainModel } from './utils/feature-utils';
import MaterialTable from 'material-table';

import AddBox from '@material-ui/icons/AddBox';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import Check from '@material-ui/icons/Check';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import Clear from '@material-ui/icons/Clear';
import DeleteOutline from '@material-ui/icons/DeleteOutline';
import Edit from '@material-ui/icons/Edit';
import FilterList from '@material-ui/icons/FilterList';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';
import Remove from '@material-ui/icons/Remove';
import SaveAlt from '@material-ui/icons/SaveAlt';
import Search from '@material-ui/icons/Search';
import ViewColumn from '@material-ui/icons/ViewColumn';
import Train, {
  MODALITY_FIELD,
  NON_FEATURE_FIELDS,
  PATIENT_ID_FIELD,
  ROI_FIELD,
} from './Train';
import FeatureTable from './components/FeatureTable';
import classnames from 'classnames';

import * as parse from 'csv-parse/lib/sync';
import * as csvString from 'csv-string';
import * as detectNewline from 'detect-newline';

import './Features.css';
import CollectionSelection from './components/CollectionSelection';
import Kheops from './services/kheops';
import _ from 'lodash';
import DataLabels from './components/DataLabels';
import Visualisation from './Visualisation';

const tableIcons = {
  Add: forwardRef((props, ref) => <AddBox {...props} ref={ref} />),
  Check: forwardRef((props, ref) => <Check {...props} ref={ref} />),
  Clear: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Delete: forwardRef((props, ref) => <DeleteOutline {...props} ref={ref} />),
  DetailPanel: forwardRef((props, ref) => (
    <ChevronRight {...props} ref={ref} />
  )),
  Edit: forwardRef((props, ref) => <Edit {...props} ref={ref} />),
  Export: forwardRef((props, ref) => <SaveAlt {...props} ref={ref} />),
  Filter: forwardRef((props, ref) => <FilterList {...props} ref={ref} />),
  FirstPage: forwardRef((props, ref) => <FirstPage {...props} ref={ref} />),
  LastPage: forwardRef((props, ref) => <LastPage {...props} ref={ref} />),
  NextPage: forwardRef((props, ref) => <ChevronRight {...props} ref={ref} />),
  PreviousPage: forwardRef((props, ref) => (
    <ChevronLeft {...props} ref={ref} />
  )),
  ResetSearch: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Search: forwardRef((props, ref) => <Search {...props} ref={ref} />),
  SortArrow: forwardRef((props, ref) => <ArrowDownward {...props} ref={ref} />),
  ThirdStateCheck: forwardRef((props, ref) => <Remove {...props} ref={ref} />),
  ViewColumn: forwardRef((props, ref) => <ViewColumn {...props} ref={ref} />),
};

const PYRADIOMICS_PREFIX = 'original';

export const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival',
};

const CLASSIFICATION_OUTCOMES = ['Outcome'];

const SURVIVAL_OUTCOMES = ['Time', 'Event'];

async function getFormattedLabels(
  token,
  albumID,
  dataPoints,
  labelType,
  outcomeColumns
) {
  let labels = await Backend.labels(token, albumID, labelType);

  let formattedLabels = labels.reduce((acc, label) => {
    acc[label.patient_id] = label.label_content;
    return acc;
  }, {});

  // Add potentially missing labels
  for (let patientID of dataPoints) {
    // Go through all outcome columns
    if (!Object.keys(formattedLabels).includes(patientID)) {
      formattedLabels[patientID] = {};
      for (let outcomeColumn of outcomeColumns) {
        formattedLabels[patientID][outcomeColumn] = '';
      }
    } else {
      for (let outcomeColumn of outcomeColumns) {
        if (!Object.keys(formattedLabels[patientID]).includes(outcomeColumn))
          formattedLabels[patientID][outcomeColumn] = '';
      }
    }
  }

  return formattedLabels;
}

function Features({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();

  const isAlternativeUser = useMemo(() => {
    if (keycloak.idTokenParsed) {
      let matches = keycloak.idTokenParsed.email.match(
        /user(?<user>\d+)@chuv\.ch/
      );
      console.log('matches', matches);
      if (matches && matches.groups.user && +matches.groups.user % 2 === 1) {
        return true;
      } else {
        return false;
      }
    } else {
      return null;
    }
  }, [keycloak.idTokenParsed]);

  const { albumID, collectionID, tab } = useParams();

  // Album & extraction
  const [album, setAlbum] = useState(null);
  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [featureExtraction, setFeatureExtraction] = useState(null);
  const [header, setHeader] = useState(null);
  const [features, setFeatures] = useState(null);

  // Visualization
  const [lasagnaData, setLasagnaData] = useState(null);

  // Collection management
  const [collections, setCollections] = useState(null);
  const [collectionName, setCollectionName] = useState('');
  const [activeCollectionName, setActiveCollectionName] = useState('');

  // Filter management
  const [selectedModalities, setSelectedModalities] = useState([]);
  const [selectedROIs, setSelectedROIs] = useState([]);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  // Outcomes management
  const [outcomeType, setOutcomeType] = useState(MODEL_TYPES.CLASSIFICATION);
  const [dataPoints, setDataPoints] = useState(null);
  const [classificationLabels, setClassificationLabels] = useState({});
  const [survivalLabels, setSurvivalLabels] = useState({});

  // Models management
  const [models, setModels] = useState([]);

  // Loading / Saving state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  const [isSavingCollectionName, setIsSavingCollectionName] = useState(false);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get classes of a tab
  const getTabClassName = (targetTab) => {
    return classnames({
      active: tab === targetTab,
      'text-danger':
        unlabelledDataPoints > 0 && unlabelledDataPoints === dataPoints.length,
      'text-warning':
        unlabelledDataPoints > 0 && unlabelledDataPoints < dataPoints.length,
    });
  };

  // Get symbol of a tab
  const getTabSymbol = () => {
    return unlabelledDataPoints > 0 ? (
      unlabelledDataPoints === dataPoints.length ? (
        <>
          <FontAwesomeIcon icon="exclamation-circle" />{' '}
        </>
      ) : (
        <>
          <FontAwesomeIcon icon="exclamation-triangle" />{' '}
        </>
      )
    ) : null;
  };

  // Get album
  useEffect(() => {
    async function getAlbum() {
      try {
        let album = await Kheops.album(keycloak.token, albumID);
        setAlbum(album);
      } catch (err) {
        //setKheopsError(true);
        console.error(err);
      }
    }

    getAlbum();
  }, []);

  // Get collections
  useEffect(() => {
    async function getCollections() {
      const collections = await Backend.collectionsByExtraction(
        keycloak.token,
        featureExtractionID
      );

      setCollections(collections);
    }
    if (featureExtractionID) getCollections();
  }, [featureExtractionID]);

  // Set active collection name
  useEffect(() => {
    if (collections && collectionID && currentCollection) {
      setActiveCollectionName(currentCollection.collection.name);
    }
  }, [collectionID, collections]);

  // Get Data Points for Labelling
  useEffect(() => {
    async function getDataPoints() {
      let response = await Backend.extractionDataPoints(
        keycloak.token,
        featureExtractionID
      );
      setDataPoints(response['data-points']);
    }

    async function getCollectionDataPoints() {
      let response = await Backend.extractionCollectionDataPoints(
        keycloak.token,
        featureExtractionID,
        +collectionID
      );
      setDataPoints(response['data-points']);
    }

    if (featureExtractionID) {
      if (collectionID) getCollectionDataPoints();
      else getDataPoints();
    }
  }, [featureExtractionID, collectionID]);

  // Get classification labels
  useEffect(() => {
    if (!dataPoints) return;

    async function getLabels() {
      let formattedLabels = await getFormattedLabels(
        keycloak.token,
        album.album_id,
        dataPoints,
        MODEL_TYPES.CLASSIFICATION,
        CLASSIFICATION_OUTCOMES
      );
      setClassificationLabels(formattedLabels);
    }

    getLabels();
  }, [dataPoints]);

  // Get survival labels
  useEffect(() => {
    if (!dataPoints) return;

    async function getLabels() {
      let formattedLabels = await getFormattedLabels(
        keycloak.token,
        album.album_id,
        dataPoints,
        MODEL_TYPES.SURVIVAL,
        SURVIVAL_OUTCOMES
      );
      setSurvivalLabels(formattedLabels);
    }

    getLabels();
  }, [dataPoints]);

  // Get features
  useEffect(() => {
    async function getFeatures() {
      setIsLoading(true);

      console.log('Show features for albumID:', albumID);

      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      setFeatureExtractionID(latestExtraction.id);
      setFeatureExtraction(latestExtraction);

      let features;
      let header;
      let lasagna;
      if (!collectionID) {
        const {
          features: allFeatures,
          header: allHeader,
          visualization: lasagnaData,
        } = await Backend.extractionFeatureDetails(
          keycloak.token,
          latestExtraction.id
        );

        features = allFeatures;
        header = allHeader;
        lasagna = lasagnaData;
      } else {
        const {
          features: collectionFeatures,
          header: collectionHeader,
          visualization: lasagnaData,
        } = await Backend.extractionCollectionFeatureDetails(
          keycloak.token,
          latestExtraction.id,
          +collectionID
        );

        features = collectionFeatures;
        header = collectionHeader;
        lasagna = lasagnaData;
      }

      setFeatures(features.map((f) => ({ ...f, isSelected: true })));
      setLasagnaData(lasagna);
      setHeader(header);

      setIsLoading(false);
    }

    getFeatures();
  }, [albumID, collectionID]);

  // Get models
  useEffect(() => {
    async function getModels() {
      let models = await Backend.models(keycloak.token, albumID);

      // Filter out models that are not for this collection / original feature set
      let filteredModels = collectionID
        ? models.filter((m) => m.feature_collection_id === +collectionID)
        : models.filter((m) => m.feature_collection_id === null);

      let sortedModels = filteredModels.sort(
        (m1, m2) => new Date(m2.created_at) - new Date(m1.created_at)
      );
      setModels(sortedModels);
    }

    if (albumID) getModels();
  }, [keycloak.token, albumID, collectionID]);

  // Toggle active
  const toggle = (newTab) => {
    if (newTab !== tab) {
      if (!collectionID) history.push(`/features/${albumID}/${newTab}`);
      else
        history.push(
          `/features/${albumID}/collection/${collectionID}/${newTab}`
        );
    }
  };

  // Determine available Modalities, ROIs & Patients (for filtering)
  let metadataColumns = useMemo(() => {
    if (features)
      return features.reduce(
        (acc, currentRow) => {
          if (!acc[MODALITY_FIELD].includes(currentRow[MODALITY_FIELD]))
            acc[MODALITY_FIELD].push(currentRow[MODALITY_FIELD]);

          if (!acc[ROI_FIELD].includes(currentRow[ROI_FIELD]))
            acc[ROI_FIELD].push(currentRow[ROI_FIELD]);

          if (!acc[PATIENT_ID_FIELD].includes(currentRow[PATIENT_ID_FIELD]))
            acc[PATIENT_ID_FIELD].push(currentRow[PATIENT_ID_FIELD]);

          acc[MODALITY_FIELD].sort();
          acc[ROI_FIELD].sort();
          acc[PATIENT_ID_FIELD].sort();

          return acc;
        },
        { [MODALITY_FIELD]: [], [ROI_FIELD]: [], [PATIENT_ID_FIELD]: [] }
      );
  }, [features]);

  const tabularClassificationLabels = useMemo(() => {
    let formattedLabels = [];
    for (let patientID in classificationLabels) {
      formattedLabels.push([
        patientID,
        classificationLabels[patientID].Outcome,
      ]);
    }

    return formattedLabels;
  }, [classificationLabels]);

  const tabularSurvivalLabels = useMemo(() => {
    let formattedLabels = [];
    for (let patientID in survivalLabels) {
      formattedLabels.push([
        patientID,
        survivalLabels[patientID].Time,
        survivalLabels[patientID].Event,
      ]);
    }
    return formattedLabels;
  });

  // Reset selected modalities etc. when features are updated (collection click for example)
  useEffect(() => {
    if (metadataColumns) {
      setSelectedModalities([...metadataColumns[MODALITY_FIELD]]);
      setSelectedROIs([...metadataColumns[ROI_FIELD]]);
      setSelectedPatients([...metadataColumns[PATIENT_ID_FIELD]]);
    }
  }, [metadataColumns]);

  // Handle feature names
  let featureNames = useMemo(() => {
    if (header) {
      return header.filter((c) => !NON_FEATURE_FIELDS.includes(c));
    }

    return null;
  }, [header]);

  // Reset selected features when features change
  useEffect(() => {
    if (featureNames) {
      setSelectedFeatures([...featureNames]);
    }
  }, [featureNames]);

  // Handle feature groups
  let featureGroups = useMemo(() => {
    if (featureNames) {
      let currentFeatureGroup = '';
      let groups = {};

      for (let featureName of featureNames) {
        // TODO - Make this more elegant, maybe a convention for feature names is needed
        // Group PyRadiomics features by the second level,
        // first level for other backens so far
        let featureGroupName;

        // PET - Special case
        if (featureName.startsWith('PET')) {
          featureGroupName = 'PET';
        } else if (featureName.startsWith(PYRADIOMICS_PREFIX)) {
          featureGroupName = featureName.split('_')[1];
        } else {
          featureGroupName =
            featureName.split('_')[0] + '_' + featureName.split('_')[1];
        }

        if (featureGroupName !== currentFeatureGroup) {
          groups[featureGroupName] = [];
          currentFeatureGroup = featureGroupName;
        }

        groups[featureGroupName].push(featureName);
      }

      return groups;
    }

    return null;
  }, [featureNames]);

  // Get current collection
  const currentCollection =
    collections && collectionID
      ? collections.find((c) => c.collection.id === +collectionID)
      : null;

  // Compute unlabelled data points
  const unlabelledDataPoints = useMemo(() => {
    let unlabelled = 0;
    let dataLabels =
      outcomeType === MODEL_TYPES.CLASSIFICATION
        ? classificationLabels
        : survivalLabels;

    // Nothing loaded yet
    if (Object.keys(dataLabels).length === 0) return null;

    for (let patientID in dataLabels) {
      if (
        !dataLabels[patientID] ||
        Object.keys(dataLabels[patientID]).every(
          (outcomeColumn) => dataLabels[patientID][outcomeColumn] === ''
        )
      )
        unlabelled++;
    }

    return unlabelled;
  }, [classificationLabels, survivalLabels]);

  // Handle click on a filter button
  const handleFilterClick = (selected, field, setField) => {
    const index = field.indexOf(selected);
    if (index < 0) {
      field.push(selected);
    } else {
      field.splice(index, 1);
    }
    setField([...field]);
  };

  // Handle download click
  const handleDownloadClick = async (e) => {
    e.preventDefault();
    setIsDownloading(true);

    let url = collectionID
      ? Backend.downloadCollectionURL(
          +collectionID,
          null,
          null,
          keycloak.tokenParsed.sub
        )
      : Backend.downloadExtractionURL(
          featureExtractionID,
          null,
          null,
          keycloak.tokenParsed.sub
        );

    let response = await fetch(url);

    let contentDisposition = response.headers.get('Content-Disposition');
    let filename = contentDisposition.split('=')[1];
    let responseContent = await response.blob();

    fileDownload(responseContent, filename);

    //window.location.href = url;

    setIsDownloading(false);
  };

  // Handle change of collection name
  const handleCollectionNameChange = (e) => {
    setCollectionName(e.target.value);
  };

  // Handle change of active collection name
  const handleActiveCollectionNameChange = (e) => {
    setActiveCollectionName(e.target.value);
  };

  // Handle renaming of existing collection
  const handleSaveCollectionNameClick = async (e) => {
    e.preventDefault();
    setIsSavingCollectionName(true);
    let updatedCollection = await Backend.updateCollection(
      keycloak.token,
      collectionID,
      { name: activeCollectionName }
    );

    // Update collections with new name
    setCollections((c) => {
      let collections = [...c];

      let collectionToUpdate = collections.find(
        (c) => c.collection.id === +collectionID
      );
      collectionToUpdate.collection.name = updatedCollection.name;

      return collections;
    });

    setIsSavingCollectionName(false);
  };

  // Handle deleting collection
  const handleDeleteCollectionClick = async (e) => {
    e.preventDefault();
    setIsDeletingCollection(true);
    let deletedCollection = await Backend.deleteCollection(
      keycloak.token,
      collectionID
    );
    setIsDeletingCollection(false);

    // Remove deleted collection and redirect to original feature set
    setCollections((c) => {
      let collections = [...c];

      let collectionToDeleteIndex = collections.findIndex(
        (c) => c.collection.id === +collectionID
      );
      collections.splice(collectionToDeleteIndex, 1);

      return collections;
    });

    history.push(`/features/${albumID}/overview`);
  };

  // Handle save collection click
  const saveFeatures = async () => {
    setIsSaving(true);
    let newCollection = await Backend.saveCollection(
      keycloak.token,
      featureExtractionID,
      collectionName,
      selectedModalities,
      selectedROIs,
      selectedPatients,
      selectedFeatures
    );
    setIsSaving(false);
    setCollectionName('');
    setCollections((c) => [...c, newCollection]);

    history.push(
      `/features/${albumID}/collection/${newCollection.collection.id}/overview`
    );
  };

  // Handle outcome type change
  const handleOutcomeTypeChange = (e) => {
    setOutcomeType(e.target.value);
  };

  // Handle back to overview click
  const handleBackToOverviewClick = (e) => {
    history.push(`/features/${albumID}/overview`);
  };

  // Print modalities
  const printModalities = () => {
    let modalities =
      collectionID && currentCollection
        ? currentCollection.modalities
        : featureExtraction.modalities;

    return modalities.map((modality) => (
      <Badge style={{ marginRight: '0.5em' }} color="primary" key={modality}>
        {modality}
      </Badge>
    ));
  };

  // Print ROIs
  const printROIs = () => {
    let rois =
      collectionID && currentCollection
        ? currentCollection.rois
        : featureExtraction.rois;

    return rois.map((roi) => (
      <Badge style={{ marginRight: '0.5em' }} color="primary" key={roi}>
        {roi}
      </Badge>
    ));
  };

  // Print data points
  const printDataPoints = () => {
    return dataPoints ? dataPoints.length : '';
  };

  // Print Features
  const printFeatures = () => {
    let features =
      collectionID && currentCollection
        ? currentCollection.features
        : featureExtraction.feature_definitions;

    return features.length;
  };

  return (
    <>
      <h2>Feature Explorer</h2>
      {!isLoading && album && collections !== null ? (
        <div style={{ textAlign: 'center' }}>
          {features.length > 0 && (
            <div className="features-wrapper">
              {tab !== 'create' && (
                <div className="collections-list">
                  <CollectionSelection
                    albumID={album.album_id}
                    album={album.name}
                    collections={collections}
                    collectionID={collectionID}
                    isAlternativeUser={isAlternativeUser}
                  />
                </div>
              )}
              {tab === 'create' ? (
                <div className="flex-grow-1 collection-container">
                  <div className="align-left">
                    <Button color="link" onClick={handleBackToOverviewClick}>
                      <FontAwesomeIcon icon="arrow-left" /> Back to overview
                    </Button>
                  </div>
                  <h3>Create a new collection for album "{album.name}"</h3>
                  <h5>Filter modalities, ROIs, patients & features</h5>
                  <div className="data-filters">
                    <div className="data-filter modality-filter">
                      <div>Modality</div>
                      <FilterButtonGroup
                        values={metadataColumns[MODALITY_FIELD]}
                        selectedValues={selectedModalities}
                        setSelectedValues={setSelectedModalities}
                        handleClick={handleFilterClick}
                      />
                    </div>
                    <div className="data-filter roi-filter">
                      <div>ROIs</div>
                      <FilterButtonGroup
                        values={metadataColumns[ROI_FIELD]}
                        selectedValues={selectedROIs}
                        setSelectedValues={setSelectedROIs}
                        handleClick={handleFilterClick}
                      />
                    </div>
                    <div className="data-filter patient-filter">
                      <div>Patients</div>
                      <FilterButtonGroup
                        values={metadataColumns[PATIENT_ID_FIELD]}
                        selectedValues={selectedPatients}
                        setSelectedValues={setSelectedPatients}
                        handleClick={handleFilterClick}
                      />
                    </div>
                    <div className="data-filter feature-filter">
                      <div>Features</div>
                      <FeatureFilterButtonGroup
                        groups={featureGroups}
                        values={featureNames}
                        selectedValues={selectedFeatures}
                        setSelectedValues={setSelectedFeatures}
                        handleClick={handleFilterClick}
                      />
                    </div>
                  </div>
                  <div className="info-container">
                    <MetadataAlert
                      values={metadataColumns[MODALITY_FIELD]}
                      selectedValues={selectedModalities}
                      title="Modalities"
                    />
                    <MetadataAlert
                      values={metadataColumns[ROI_FIELD]}
                      selectedValues={selectedROIs}
                      title="ROIs"
                    />
                    <MetadataAlert
                      values={metadataColumns[PATIENT_ID_FIELD]}
                      selectedValues={selectedPatients}
                      title="Patients"
                    />
                    <MetadataAlert
                      values={header.filter(
                        (c) => !NON_FEATURE_FIELDS.includes(c)
                      )}
                      selectedValues={selectedFeatures}
                      title="Features"
                    />
                  </div>
                  <Input
                    type="text"
                    name="collectionName"
                    id="collectionName"
                    placeholder="Name of your collection"
                    value={collectionName}
                    onChange={handleCollectionNameChange}
                    disabled={
                      selectedModalities.length == 0 ||
                      selectedROIs.length === 0 ||
                      selectedPatients.length === 0 ||
                      selectedFeatures.length === 0
                    }
                  />
                  <Button
                    color="success"
                    onClick={saveFeatures}
                    className="mt-2"
                    disabled={
                      selectedModalities.length == 0 ||
                      selectedROIs.length === 0 ||
                      selectedPatients.length === 0 ||
                      selectedFeatures.length === 0 ||
                      collectionName === ''
                    }
                  >
                    {isSaving ? (
                      <>
                        <FontAwesomeIcon icon="spinner" spin /> Saving Custom
                        Features
                      </>
                    ) : (
                      'Save Custom Features'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="feature-tabs">
                  <Nav tabs>
                    <NavItem>
                      <NavLink
                        className={classnames({ active: tab === 'overview' })}
                        onClick={() => {
                          toggle('overview');
                        }}
                      >
                        Overview
                      </NavLink>
                    </NavItem>
                    <NavItem>
                      <NavLink
                        className={classnames({ active: tab === 'table' })}
                        onClick={() => {
                          toggle('table');
                        }}
                      >
                        Feature Table
                      </NavLink>
                    </NavItem>
                    <NavItem>
                      <NavLink
                        className={getTabClassName('outcome')}
                        onClick={() => {
                          toggle('outcome');
                        }}
                      >
                        {getTabSymbol()}
                        Outcomes
                      </NavLink>
                    </NavItem>
                    {isAlternativeUser !== true && (
                      <NavItem>
                        <NavLink
                          className={getTabClassName('visualize')}
                          onClick={() => {
                            toggle('visualize');
                          }}
                        >
                          {getTabSymbol()}
                          Visualization
                        </NavLink>
                      </NavItem>
                    )}
                    <NavItem>
                      <NavLink
                        className={getTabClassName('train')}
                        onClick={() => {
                          toggle('train');
                        }}
                      >
                        {getTabSymbol()}
                        Model Training{' '}
                        {models.length > 0 && <Badge>{models.length}</Badge>}
                      </NavLink>
                    </NavItem>
                  </Nav>
                  <TabContent activeTab={tab} className="p-3">
                    <TabPane tabId="overview">
                      <div className="collection-overview">
                        <h3>Overview</h3>
                        <Table bordered className="model-details-table mx-auto">
                          <tbody>
                            <tr>
                              <td>
                                {collectionID
                                  ? 'Collection created on'
                                  : 'Features extracted on'}
                              </td>
                              <td>
                                {collectionID && currentCollection
                                  ? currentCollection.collection.created_at
                                  : featureExtraction.created_at}
                              </td>
                            </tr>
                            <tr>
                              <td>
                                Modalities in{' '}
                                {collectionID ? 'collection' : 'extraction'}
                              </td>
                              <td>{printModalities()}</td>
                            </tr>
                            <tr>
                              <td>
                                ROIs in{' '}
                                {collectionID ? 'collection' : 'extraction'}
                              </td>
                              <td>{printROIs()}</td>
                            </tr>
                            <tr>
                              <td>
                                Number of data points in{' '}
                                {collectionID ? 'collection' : 'extraction'}
                              </td>
                              <td>{printDataPoints()}</td>
                            </tr>
                            <tr>
                              <td>
                                Number of feature types in{' '}
                                {collectionID ? 'collection' : 'extraction'}
                              </td>
                              <td>{printFeatures()}</td>
                            </tr>
                          </tbody>
                        </Table>
                        <FormGroup>
                          <Label for="selected-collection-name">
                            <strong>
                              <FontAwesomeIcon icon="download" /> Download
                              features
                            </strong>
                          </Label>
                          <br />
                          <Button color="success" onClick={handleDownloadClick}>
                            {isDownloading
                              ? 'Downloading features...'
                              : 'Download features'}
                          </Button>
                        </FormGroup>
                        {collectionID && (
                          <Form onSubmit={handleSaveCollectionNameClick}>
                            <FormGroup>
                              <Label for="selected-collection-name">
                                <strong>
                                  <FontAwesomeIcon icon="edit" /> Edit
                                  Collection Name
                                </strong>
                              </Label>
                              <InputGroup>
                                <Input
                                  id="selected-collection-name"
                                  type="text"
                                  placeholder="Collection Name"
                                  value={activeCollectionName}
                                  onChange={handleActiveCollectionNameChange}
                                />
                                <InputGroupAddon addonType="append">
                                  <Button
                                    color="primary"
                                    onClick={handleSaveCollectionNameClick}
                                  >
                                    {isSavingCollectionName
                                      ? 'Saving...'
                                      : 'Save'}
                                  </Button>
                                </InputGroupAddon>
                              </InputGroup>
                            </FormGroup>
                            <FormGroup>
                              <Label for="selected-collection-name">
                                <strong>
                                  <FontAwesomeIcon icon="trash-alt" /> Delete
                                  Collection (WARNING: Cannot be undone!)
                                </strong>
                              </Label>
                              <br />
                              <Button
                                color="danger"
                                onClick={handleDeleteCollectionClick}
                              >
                                {isDeletingCollection
                                  ? 'Deleting Collection & All associated models...'
                                  : 'Delete Collection & All associated models'}
                              </Button>
                            </FormGroup>
                          </Form>
                        )}
                      </div>
                    </TabPane>
                    <TabPane tabId="table">
                      <div className="features-table">
                        <FeatureTable
                          features={features}
                          header={header}
                          featureExtractionID={featureExtractionID}
                          setCollections={setCollections}
                        />
                      </div>
                    </TabPane>
                    <TabPane tabId="outcome">
                      {dataPoints ? (
                        <>
                          {unlabelledDataPoints > 0 && (
                            <Alert
                              color={
                                unlabelledDataPoints === dataPoints.length
                                  ? 'danger'
                                  : 'warning'
                              }
                            >
                              {getFeatureTitleSingularOrPlural(
                                unlabelledDataPoints
                              )}
                            </Alert>
                          )}
                          <h3>Patient Outcomes</h3>
                          <div>Choose the type of outcomes to input</div>
                          <div className="form-container">
                            <Form>
                              <Input
                                type="select"
                                id="outcome-type"
                                name="outcome-type"
                                value={outcomeType}
                                onChange={handleOutcomeTypeChange}
                              >
                                {Object.keys(MODEL_TYPES).map((key) => (
                                  <option key={key} value={MODEL_TYPES[key]}>
                                    {MODEL_TYPES[key]}
                                  </option>
                                ))}
                              </Input>
                            </Form>
                          </div>

                          <DataLabels
                            albumID={albumID}
                            dataPoints={dataPoints}
                            isTraining={isTraining}
                            isSavingLabels={isSavingLabels}
                            setIsSavingLabels={setIsSavingLabels}
                            dataLabels={
                              outcomeType === MODEL_TYPES.CLASSIFICATION
                                ? classificationLabels
                                : survivalLabels
                            }
                            setDataLabels={
                              outcomeType === MODEL_TYPES.CLASSIFICATION
                                ? setClassificationLabels
                                : setSurvivalLabels
                            }
                            labelType={
                              outcomeType === MODEL_TYPES.CLASSIFICATION
                                ? MODEL_TYPES.CLASSIFICATION
                                : MODEL_TYPES.SURVIVAL
                            }
                            outcomeColumns={
                              outcomeType === MODEL_TYPES.CLASSIFICATION
                                ? CLASSIFICATION_OUTCOMES
                                : SURVIVAL_OUTCOMES
                            }
                            validateLabelFile={(
                              file,
                              dataPoints,
                              setDataLabels
                            ) =>
                              validateLabelFile(
                                file,
                                dataPoints,
                                setDataLabels,
                                outcomeType === MODEL_TYPES.CLASSIFICATION
                                  ? CLASSIFICATION_OUTCOMES
                                  : SURVIVAL_OUTCOMES
                              )
                            }
                          />
                        </>
                      ) : (
                        <span>Loading...</span>
                      )}
                    </TabPane>
                    <TabPane tabId="visualize">
                      {isAlternativeUser !== true && dataPoints ? (
                        !isSavingLabels ? (
                          <>
                            {unlabelledDataPoints > 0 && (
                              <Alert color="warning">
                                There are {unlabelledDataPoints} unlabelled
                                PatientIDs!
                              </Alert>
                            )}
                            <Visualisation
                              lasagnaData={lasagnaData}
                              setLasagnaData={setLasagnaData}
                              collectionInfos={
                                collectionID && currentCollection
                                  ? currentCollection
                                  : null
                              }
                              featureExtractionID={featureExtractionID}
                              setCollections={setCollections}
                              album={album.name}
                            />
                          </>
                        ) : (
                          <p className="p-5">
                            Labels are being saved on the server, please wait
                            for a moment...
                          </p>
                        )
                      ) : (
                        <span>Loading...</span>
                      )}
                    </TabPane>

                    <TabPane tabId="train">
                      {dataPoints ? (
                        !isSavingLabels ? (
                          <>
                            {unlabelledDataPoints > 0 && (
                              <Alert color="warning">
                                There are {unlabelledDataPoints} unlabelled
                                PatientIDs, these will be ignored for training!
                                To include them, assign an outcome to them in
                                the "Outcomes" tab.
                              </Alert>
                            )}
                            <Train
                              album={album}
                              albumExtraction={featureExtraction}
                              models={models}
                              setModels={setModels}
                              collectionInfos={
                                collectionID && currentCollection
                                  ? currentCollection
                                  : null
                              }
                              metadataColumns={metadataColumns}
                              dataPoints={dataPoints}
                              tabularClassificationLabels={
                                tabularClassificationLabels
                              }
                              tabularSurvivalLabels={tabularSurvivalLabels}
                              featureExtractionID={featureExtractionID}
                              unlabelledDataPoints={unlabelledDataPoints}
                            />
                          </>
                        ) : (
                          <p className="p-5">
                            Labels are being saved on the server, please wait
                            for a moment...
                          </p>
                        )
                      ) : (
                        <span>Loading...</span>
                      )}
                    </TabPane>
                  </TabContent>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="Container-fill">
          <Spinner />
        </div>
      )}
    </>
  );
}

function getFeatureTitleSingularOrPlural(unlabelledDataPoints) {
  return (
    <span>
      {unlabelledDataPoints > 1 ? 'There are ' : 'There is '}
      <strong>
        {unlabelledDataPoints} data{' '}
        {unlabelledDataPoints > 1 ? 'points' : 'point'}
      </strong>{' '}
      missing an outcome!
    </span>
  );
}

function FilterButtonGroup({
  values,
  selectedValues,
  setSelectedValues,
  handleClick,
}) {
  return (
    <>
      <div>
        <ButtonGroup>
          <Button
            size="sm"
            color="primary"
            onClick={() => setSelectedValues(values)}
          >
            All
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setSelectedValues([])}
          >
            None
          </Button>
        </ButtonGroup>
      </div>
      <div className="pre-scrollable mt-2">
        <ButtonGroup
          vertical
          style={{ marginRight: '-14px', width: 'calc(100% - 14px)' }}
        >
          {values.map((v) => (
            <Button
              key={v}
              color={selectedValues.includes(v) ? 'primary' : 'secondary'}
              onClick={() => handleClick(v, selectedValues, setSelectedValues)}
            >
              {v}
            </Button>
          ))}
        </ButtonGroup>
      </div>
    </>
  );
}

function FeatureFilterButtonGroup({
  groups,
  values,
  selectedValues,
  setSelectedValues,
  handleClick,
}) {
  const [groupsOpen, setGroupsOpen] = useState({});

  const toggleGroupOpen = (group) => {
    let wasOpen = groupsOpen[group];
    setGroupsOpen((g) => ({ ...g, [group]: !wasOpen }));
  };

  const toggleGroupSelected = (g) => {
    let wasSelected = groups[g].some((f) => selectedValues.includes(f));

    let groupFeatures = groups[g];

    let newValues = [...values];

    let updatedSelectedValues = [...selectedValues];

    // Remove the group's features or keep them?
    if (wasSelected) {
      // Remove the features
      for (let f of groupFeatures) {
        let featureIndex = updatedSelectedValues.findIndex(
          (feature) => feature === f
        );

        if (featureIndex > -1) updatedSelectedValues.splice(featureIndex, 1);
      }
    } else {
      updatedSelectedValues = [...updatedSelectedValues, ...groupFeatures];
    }

    setSelectedValues(updatedSelectedValues);
  };

  return (
    <>
      <div>
        <ButtonGroup>
          <Button
            size="sm"
            color="primary"
            onClick={() => setSelectedValues(values)}
          >
            All
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setSelectedValues([])}
          >
            None
          </Button>
        </ButtonGroup>
      </div>
      <div className="pre-scrollable mt-2">
        <ListGroup vertical flush>
          {Object.keys(groups).map((g) => (
            <>
              <ListGroupItem key={g} className="p-0">
                <div className="d-flex">
                  <Button
                    className="flex-grow-1"
                    color={
                      groups[g].every((f) => selectedValues.includes(f))
                        ? 'primary'
                        : groups[g].some((f) => selectedValues.includes(f))
                        ? 'info'
                        : 'secondary'
                    }
                    onClick={() => {
                      toggleGroupSelected(g);
                    }}
                  >
                    {g}
                  </Button>
                  <Button
                    color="link"
                    onClick={() => toggleGroupOpen(g)}
                    style={{ boxSizing: 'border-box', width: '36px' }}
                  >
                    {groupsOpen[g] === true ? '-' : '+'}
                  </Button>
                </div>

                <Collapse isOpen={groupsOpen[g] === true} className="text-left">
                  <ButtonGroup
                    vertical
                    style={{ width: 'calc(100% - 36px)' }}
                    className="mt-2 mb-2"
                  >
                    {groups[g].map((f) => (
                      <Button
                        key={f}
                        color={
                          selectedValues.includes(f) ? 'primary' : 'secondary'
                        }
                        onClick={() =>
                          handleClick(f, selectedValues, setSelectedValues)
                        }
                      >
                        {f}
                      </Button>
                    ))}
                  </ButtonGroup>
                </Collapse>
              </ListGroupItem>
            </>
          ))}
        </ListGroup>
      </div>
    </>
  );
}

function MetadataAlert({ selectedValues, values, title }) {
  return (
    <Alert
      color={selectedValues.length > 0 ? 'primary' : 'danger'}
      className="mt-2"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selectedValues.length}/{values.length} {title}
    </Alert>
  );
}

export default Features;

function validateFileType(file) {
  /* Validate metadata - file type */
  if (
    ![
      'text/csv',
      'text/comma-separated-values',
      'text/tab-separated-values',
      'application/csv',
      'application/x-csv',
    ].includes(file.type)
  ) {
    if (
      file.type === 'application/vnd.ms-excel' &&
      file.name.endsWith('.csv')
    ) {
      // Ok, Windows sends strange MIME type
      return true;
    } else {
      return false;
    }
  }

  return true;
}

async function validateLabelFile(
  file,
  dataPoints,
  setDataLabels,
  headerFieldNames
) {
  console.log(file);
  let valid = false;
  let error = null;

  /* Validate file type */
  let fileTypeIsValid = validateFileType(file);

  if (!fileTypeIsValid) {
    error = 'The file is not a CSV file!';
    return [valid, error];
  }

  /* Validate file content */
  const content = await file.text();

  let nbMatches = 0;

  try {
    /* Add PatientID to the header field names (should always exist) */
    let fullHeaderFieldNames = ['PatientID', ...headerFieldNames];
    console.log('full header field names', fullHeaderFieldNames);

    let lineEnding = detectNewline(content);

    let firstLine = content.split(lineEnding)[0];

    let separator = csvString.detect(firstLine);

    let headerFields = firstLine.split(separator);

    let hasHeader =
      headerFields.length === fullHeaderFieldNames.length &&
      fullHeaderFieldNames.every((fieldName) =>
        headerFields.includes(fieldName)
      );

    let columns = hasHeader ? true : fullHeaderFieldNames;

    const records = parse(content, {
      columns: columns,
      skip_empty_lines: true,
    });

    // Match rows to data points
    console.log(dataPoints);

    let labels = {};

    for (let patientID of dataPoints) {
      let matchingRecord = records.find(
        (record) => record.PatientID === patientID
      );

      if (matchingRecord) {
        nbMatches++;

        // Fill labels
        const { PatientID, ...recordContent } = matchingRecord;
        labels[PatientID] = recordContent;
      }
    }

    if (nbMatches === 0) {
      error = `The CSV file matched none of the patients!`;
      return [valid, error];
    } else {
      setDataLabels(labels);
    }
  } catch (e) {
    error = 'The CSV file could not be parsed, check its format!';
    return [valid, error];
  }

  valid = true;
  return [valid, `The CSV matched ${nbMatches}/${dataPoints.length} patients.`];
}
