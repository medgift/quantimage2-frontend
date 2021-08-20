import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useCallback,
} from 'react';
import { useParams } from 'react-router-dom';
import fileDownload from 'js-file-download';
import Backend from './services/backend';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Form,
  FormGroup,
  Input,
  InputGroup,
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
  Collapse,
} from 'reactstrap';

import { useKeycloak } from 'react-keycloak';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

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
import Outcomes, {
  CLASSIFICATION_OUTCOMES,
  SURVIVAL_OUTCOMES,
} from './Outcomes';

const PYRADIOMICS_PREFIX = 'original';

export const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival',
};

export const OUTCOME_CLASSIFICATION = 'Outcome';
export const OUTCOME_SURVIVAL_EVENT = 'Event';
export const OUTCOME_SURVIVAL_TIME = 'Time';

function Features({ history }) {
  const [keycloak] = useKeycloak();

  const isAlternativeUser = useMemo(() => {
    if (keycloak.idTokenParsed) {
      let matches = keycloak.idTokenParsed.email.match(
        /user(?<user>\d+)@chuv\.ch/
      );
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
  const [dataPoints, setDataPoints] = useState(null);
  const [labelCategories, setLabelCategories] = useState(null);
  const [selectedLabelCategory, setSelectedLabelCategory] = useState(null);

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

      // Get more details for current collection
      let collectionDetails;
      if (collectionID) {
        collectionDetails = await Backend.collectionDetails(
          keycloak.token,
          collectionID
        );
      }

      let finalCollections = [...collections];

      if (collectionDetails) {
        let collectionToReplaceIndex = finalCollections.findIndex(
          (c) => c.collection.id === +collectionID
        );
        finalCollections.splice(collectionToReplaceIndex, 1, collectionDetails);
      }

      setCollections(finalCollections);
    }
    if (featureExtractionID) getCollections();
  }, [featureExtractionID, collectionID]);

  // Fetch label categories
  useEffect(() => {
    async function fetchLabelCategories() {
      let labelCategories = await Backend.labelCategories(
        keycloak.token,
        albumID
      );
      setLabelCategories(labelCategories);
    }

    if (albumID) fetchLabelCategories();
  }, [albumID, keycloak.token]);

  // Get active outcome
  useEffect(() => {
    async function fetchCurrentOutcomeID() {
      let currentOutcome = await Backend.getCurrentOutcome(
        keycloak.token,
        albumID
      );

      if (currentOutcome) setSelectedLabelCategory(currentOutcome);
    }
    if (albumID) fetchCurrentOutcomeID();
  }, [albumID, keycloak.token]);

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

  // Get feature extraction
  useEffect(() => {
    async function getExtraction() {
      setIsLoading(true);

      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      setFeatureExtractionID(latestExtraction.id);
      setFeatureExtraction(latestExtraction);
    }

    getExtraction();
  }, [albumID, collectionID]);

  // Get features
  useEffect(() => {
    async function getFeatures() {
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
          featureExtractionID
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
          featureExtractionID,
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

    if (featureExtractionID) getFeatures();
  }, [featureExtractionID, collectionID]);

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

  // Update labels (for current outcome)
  const updateCurrentLabels = useCallback(
    (labels) => {
      setFormattedDataLabels(labels);
    },
    [labelCategories, selectedLabelCategory]
  );

  // Format active data labels
  const [formattedDataLabels, setFormattedDataLabels] = useState({});

  // Reinitialize formatted data labels on changes
  useEffect(() => {
    if (!selectedLabelCategory || !dataPoints) return;

    let formattedLabels = selectedLabelCategory.labels.reduce((acc, label) => {
      acc[label.patient_id] = label.label_content;
      return acc;
    }, {});

    // Define columns based on the label type
    let outcomeColumns =
      selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
        ? CLASSIFICATION_OUTCOMES
        : SURVIVAL_OUTCOMES;

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

    setFormattedDataLabels(formattedLabels);
  }, [selectedLabelCategory, dataPoints]);

  // Compute unlabelled data points
  const unlabelledDataPoints = useMemo(() => {
    if (!selectedLabelCategory || !dataPoints) return null;

    let unlabelled = 0;
    let dataLabels = selectedLabelCategory.labels;

    for (let patientID of dataPoints) {
      let patientLabel = dataLabels.find((l) => l.patient_id === patientID);

      if (
        !patientLabel ||
        Object.keys(patientLabel.label_content).every(
          (column) => patientLabel.label_content[column] === ''
        )
      )
        unlabelled++;
    }

    return unlabelled;
  }, [selectedLabelCategory, dataPoints]);

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
                    setIsLoading={setIsLoading}
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
                        {selectedLabelCategory &&
                          ` (Current - ${selectedLabelCategory.name})`}
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
                      {tab === 'table' && (
                        <div className="features-table">
                          <FeatureTable
                            features={features}
                            header={header}
                            featureExtractionID={featureExtractionID}
                            setCollections={setCollections}
                          />
                        </div>
                      )}
                    </TabPane>
                    <TabPane tabId="outcome">
                      {tab === 'outcome' && dataPoints ? (
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
                          <Outcomes
                            albumID={albumID}
                            dataPoints={dataPoints}
                            isTraining={isTraining}
                            featureExtractionID={featureExtractionID}
                            isSavingLabels={isSavingLabels}
                            setIsSavingLabels={setIsSavingLabels}
                            selectedLabelCategory={selectedLabelCategory}
                            setSelectedLabelCategory={setSelectedLabelCategory}
                            labelCategories={labelCategories}
                            setLabelCategories={setLabelCategories}
                            setLasagnaData={setLasagnaData}
                            updateCurrentLabels={updateCurrentLabels}
                            formattedDataLabels={formattedDataLabels}
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
                              active={tab === 'visualize'}
                              selectedLabelCategory={selectedLabelCategory}
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
                      {tab === 'train' && dataPoints ? (
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
                              labelCategories={labelCategories}
                              selectedLabelCategory={selectedLabelCategory}
                              metadataColumns={metadataColumns}
                              dataPoints={dataPoints}
                              formattedDataLabels={formattedDataLabels}
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
