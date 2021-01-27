import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { useParams } from 'react-router-dom';
import Backend from './services/backend';
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardText,
  CardTitle,
  Form,
  FormGroup,
  Input,
  ListGroup,
  ListGroupItem,
  Nav,
  NavItem,
  NavLink,
  Spinner,
  TabContent,
  TabPane,
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

  const { albumID, tab } = useParams();

  // Album & extraction
  const [album, setAlbum] = useState(null);
  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [header, setHeader] = useState(null);
  const [features, setFeatures] = useState(null);

  // Collection management
  const [collections, setCollections] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);
  const [collectionName, setCollectionName] = useState('');

  // Filter management
  const [selectedModalities, setSelectedModalities] = useState([]);
  const [selectedROIs, setSelectedROIs] = useState([]);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [selectedFeatureGroups, setSelectedFeatureGroups] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  // Outcomes management
  const [outcomeType, setOutcomeType] = useState(MODEL_TYPES.CLASSIFICATION);
  const [dataPoints, setDataPoints] = useState(null);
  const [classificationLabels, setClassificationLabels] = useState({});
  const [survivalLabels, setSurvivalLabels] = useState({});

  // Loading / Saving state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isSavingLabels, setIsSavingLabels] = useState(false);

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
        +activeCollection
      );
      setDataPoints(response['data-points']);
    }

    if (featureExtractionID) {
      if (activeCollection) getCollectionDataPoints();
      else getDataPoints();
    }
  }, [featureExtractionID, activeCollection]);

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

      let features;
      let header;
      if (!activeCollection) {
        const {
          features: allFeatures,
          header: allHeader,
        } = await Backend.extractionFeatureDetails(
          keycloak.token,
          latestExtraction.id
        );

        features = allFeatures;
        header = allHeader;
      } else {
        const {
          features: collectionFeatures,
          header: collectionHeader,
        } = await Backend.extractionCollectionFeatureDetails(
          keycloak.token,
          latestExtraction.id,
          +activeCollection
        );

        features = collectionFeatures;
        header = collectionHeader;
      }

      setFeatures(features.map((f) => ({ ...f, isSelected: true })));
      setHeader(header);

      setIsLoading(false);
    }

    getFeatures();
  }, [albumID, activeCollection]);

  // Toggle active
  const toggle = (newTab) => {
    if (newTab !== tab) history.push(`/features/${albumID}/${newTab}`);
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

  // Handle feature groups
  let featureGroups = useMemo(() => {
    if (header) {
      let currentFeatureGroup = '';
      let groups = {};

      for (let featureName of header.filter(
        (c) => !NON_FEATURE_FIELDS.includes(c)
      )) {
        // TODO - Make this more elegant, maybe a convention for feature names is needed
        // Group PyRadiomics features by the second level,
        // first level for other backens so far
        let featureGroupName;
        if (featureName.startsWith(PYRADIOMICS_PREFIX)) {
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
  }, [header]);

  // Reset feature groups when features are updated (collection click for example)
  useEffect(() => {
    if (featureGroups) {
      setSelectedFeatureGroups(Object.keys(featureGroups));
    }
  }, [featureGroups]);

  // Update selected features based on selected feature groups
  useEffect(() => {
    setSelectedFeatures(
      selectedFeatureGroups.reduce((acc, group) => {
        acc.push(...featureGroups[group]);
        return acc;
      }, [])
    );
  }, [selectedFeatureGroups]);

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

  // Handle change of collection name
  const handleCollectionNameChange = (e) => {
    setCollectionName(e.target.value);
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
    setCollections((c) => [...c, newCollection]);
    setActiveCollection(newCollection.collection.id);
  };

  // Handle outcome type change
  const handleOutcomeTypeChange = (e) => {
    setOutcomeType(e.target.value);
  };

  return (
    <>
      <h2>Feature Manager</h2>
      {!isLoading && album && collections !== null ? (
        <div style={{ textAlign: 'center' }}>
          {features.length > 0 && (
            <div className="features-wrapper">
              <div className="collections-list">
                <CollectionSelection
                  album={album.name}
                  collections={collections}
                  activeCollection={activeCollection}
                  setActiveCollection={setActiveCollection}
                />
              </div>
              <div className="feature-tabs">
                <Nav tabs>
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
                      className={classnames({
                        active: tab === 'outcome',
                        'text-danger': unlabelledDataPoints > 0,
                      })}
                      onClick={() => {
                        toggle('outcome');
                      }}
                    >
                      {unlabelledDataPoints > 0 && (
                        <>
                          <FontAwesomeIcon icon="exclamation-circle" />{' '}
                        </>
                      )}
                      Outcomes
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({ active: tab === 'create' })}
                      onClick={() => {
                        toggle('create');
                      }}
                    >
                      Collection Creation
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: tab === 'visualize',
                        'text-danger': unlabelledDataPoints > 0,
                      })}
                      onClick={() => {
                        toggle('visualize');
                      }}
                    >
                      {unlabelledDataPoints > 0 && (
                        <>
                          <FontAwesomeIcon icon="exclamation-circle" />{' '}
                        </>
                      )}
                      Visualization
                    </NavLink>
                  </NavItem>
                  <NavItem>
                    <NavLink
                      className={classnames({
                        active: tab === 'train',
                        'text-danger': unlabelledDataPoints > 0,
                      })}
                      onClick={() => {
                        toggle('train');
                      }}
                    >
                      {unlabelledDataPoints > 0 && (
                        <>
                          <FontAwesomeIcon icon="exclamation-circle" />{' '}
                        </>
                      )}
                      Model Training
                    </NavLink>
                  </NavItem>
                </Nav>
                <TabContent activeTab={tab}>
                  <TabPane tabId="table">
                    <div className="features-table">
                      <FeatureTable
                        features={features}
                        header={header}
                        featureExtractionID={featureExtractionID}
                        setCollections={setCollections}
                        setActiveCollection={setActiveCollection}
                      />
                    </div>
                  </TabPane>
                  <TabPane tabId="outcome">
                    {dataPoints ? (
                      <>
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
                        {unlabelledDataPoints > 0 && (
                          <p className="text-danger">
                            {unlabelledDataPoints > 1
                              ? 'There are '
                              : 'There is '}
                            <strong>
                              {unlabelledDataPoints} data{' '}
                              {unlabelledDataPoints > 1 ? 'points' : 'point'}
                            </strong>{' '}
                            missing an outcome!
                          </p>
                        )}
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
                  <TabPane tabId="create">
                    <div>Filter data & features</div>
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
                        <FilterButtonGroup
                          values={Object.keys(featureGroups)}
                          selectedValues={selectedFeatureGroups}
                          setSelectedValues={setSelectedFeatureGroups}
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
                  </TabPane>
                  <TabPane tabId="visualize">
                    {dataPoints ? (
                      unlabelledDataPoints === 0 ? (
                        !isSavingLabels ? (
                          <Visualisation
                            collectionInfos={
                              activeCollection !== ''
                                ? collections.find(
                                    (c) => c.collection.id === +activeCollection
                                  )
                                : null
                            }
                            setSelectedModalities={setSelectedModalities}
                            setSelectedROIs={setSelectedROIs}
                            setSelectedPatients={setSelectedPatients}
                            setSelectedFeatureGroups={setSelectedFeatureGroups}
                            toggleTab={toggle}
                          />
                        ) : (
                          <p className="p-5">
                            Labels are being saved on the server, please wait
                            for a moment...
                          </p>
                        )
                      ) : (
                        <p className="p-5">
                          There are still {unlabelledDataPoints} unlabelled
                          PatientIDs, assign an outcome to them first in the
                          "Outcomes" tab!
                        </p>
                      )
                    ) : (
                      <span>Loading...</span>
                    )}
                  </TabPane>

                  <TabPane tabId="train">
                    {dataPoints ? (
                      unlabelledDataPoints === 0 ? (
                        !isSavingLabels ? (
                          <Train
                            album={album}
                            collectionInfos={
                              activeCollection !== ''
                                ? collections.find(
                                    (c) => c.collection.id === +activeCollection
                                  )
                                : null
                            }
                            dataPoints={dataPoints}
                            tabularClassificationLabels={
                              tabularClassificationLabels
                            }
                            tabularSurvivalLabels={tabularSurvivalLabels}
                            featureExtractionID={featureExtractionID}
                            unlabelledDataPoints={unlabelledDataPoints}
                          />
                        ) : (
                          <p className="p-5">
                            Labels are being saved on the server, please wait
                            for a moment...
                          </p>
                        )
                      ) : (
                        <p className="p-5">
                          There are still {unlabelledDataPoints} unlabelled
                          PatientIDs, assign an outcome to them first in the
                          "Outcomes" tab!
                        </p>
                      )
                    ) : (
                      <span>Loading...</span>
                    )}
                  </TabPane>
                </TabContent>
              </div>
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
      {/*<code>{JSON.stringify(value)}</code>*/}
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

  try {
    /* Add PatientID to the header field names (should always exist) */
    let fullHeaderFieldNames = ['PatientID', ...headerFieldNames];
    console.log('full header field names', fullHeaderFieldNames);

    let firstLine = content.split('\n')[0];

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

    // Check number of rows
    if (records.length !== dataPoints.length) {
      error = `The CSV file has ${records.length} entries, should have ${dataPoints.length}!`;
      return [valid, error];
    }

    // Match rows to data points
    console.log(dataPoints);

    let allMatched = true;
    let nbMatches = 0;

    let labels = {};

    for (let patientID of dataPoints) {
      let matchingRecord = records.find(
        (record) => record.PatientID === patientID
      );

      if (!matchingRecord) {
        allMatched = false;
      } else {
        nbMatches++;

        // Fill labels
        const { PatientID, ...recordContent } = matchingRecord;
        labels[PatientID] = recordContent;
      }
    }

    if (!allMatched) {
      error = `The CSV file matched only ${nbMatches}/${dataPoints.length} Patient/ROI pairs!`;
      return [valid, error];
    } else {
      setDataLabels(labels);
    }
  } catch (e) {
    error = 'The CSV file could not be parsed, check its format!';
    return [valid, error];
  }

  valid = true;
  return [valid, error];
}
