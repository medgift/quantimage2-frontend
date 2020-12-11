import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Input,
  Form,
  Table,
  Button,
  Collapse,
  Label,
  FormText,
  ListGroup,
  ListGroupItem,
  Badge,
  Tooltip,
} from 'reactstrap';

import './Train.css';
import Backend from './services/backend';
import { useKeycloak } from 'react-keycloak';

import _ from 'lodash';
import Kheops from './services/kheops';
import { trainModel } from './utils/feature-utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CheckboxGroup from 'react-checkbox-group';
import MyModal from './components/MyModal';
import FeaturesConfig from './components/FeaturesConfig';
import FeatureNames from './components/FeatureNames';
import DataLabels from './components/DataLabels';
import { MODEL_TYPES } from './Features';

export const PATIENT_ID_FIELD = 'PatientID';
export const ROI_FIELD = 'ROI';
export const MODALITY_FIELD = 'Modality';
export const NON_FEATURE_FIELDS = [PATIENT_ID_FIELD, MODALITY_FIELD, ROI_FIELD];

const CLASSIFICATION_ALGORITHMS = {
  LOGISTIC_REGRESSION: 'logistic_regression',
  LASSO_REGRESSION: 'lasso_regression',
  ELASTIC_NET: 'elastic_net',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm',
};

export default function Train({
  album,
  collection,
  tabularClassificationLabels,
  tabularSurvivalLabels,
  featureExtractionID,
  unlabelledDataPoints,
}) {
  let [keycloak] = useKeycloak();

  let [models, setModels] = useState([]);

  let [modelType, setModelType] = useState(MODEL_TYPES.CLASSIFICATION);

  let [algorithmType, setAlgorithmType] = useState(
    CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION
  );

  let [collections, setCollections] = useState([]);
  let [activeCollection, setActiveCollection] = useState('');

  let [usedModalities, setUsedModalities] = useState([]);
  let [usedROIs, setUsedROIs] = useState([]);
  let [albumExtraction, setAlbumExtraction] = useState(null);

  let [featuresConfigFamilies, setFeaturesConfigFamilies] = useState(null);
  let [featureConfigOpen, setFeatureConfigOpen] = useState(false);

  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);

  let [showNewModel, setShowNewModel] = useState(false);

  let [ciTooltipOpen, setCITooltipOpen] = useState(false);

  // Initialize all modalities & ROIs to be checked
  useEffect(() => {
    if (albumExtraction) {
      setUsedModalities(albumExtraction['extraction-modalities']);
      setUsedROIs(albumExtraction['extraction-rois']);
    }
  }, [albumExtraction]);

  // Get Models & Extraction
  useEffect(() => {
    async function getModels() {
      let models = await Backend.models(keycloak.token, album.album_id);
      let sortedModels = models.sort(
        (m1, m2) => new Date(m2.created_at) - new Date(m1.created_at)
      );
      setModels(sortedModels);
    }

    async function getExtraction() {
      let extraction = await Backend.extractions(
        keycloak.token,
        album.album_id
      );
      setAlbumExtraction(extraction);
    }

    getModels();
    getExtraction();
  }, [keycloak.token]);

  // Get Collections
  useEffect(() => {
    async function getCollections() {
      let collectionObjects = await Backend.collectionsByExtraction(
        keycloak.token,
        albumExtraction.id
      );

      setCollections(collectionObjects);
    }

    if (albumExtraction) getCollections();
  }, [albumExtraction]);

  let availableModalities = albumExtraction
    ? activeCollection
      ? collections.find((c) => c.collection.id === +activeCollection)
          .modalities
      : albumExtraction['extraction-modalities']
    : [];

  let availableROIs = albumExtraction
    ? activeCollection
      ? collections.find((c) => c.collection.id === +activeCollection).rois
      : albumExtraction['extraction-rois']
    : [];

  // Update used modalities
  useEffect(() => {
    if (usedModalities.length > 0 && availableModalities.length > 0) {
      let newUsed = usedModalities.filter((m) =>
        availableModalities.includes(m)
      );

      setUsedModalities(newUsed);
    }
  }, [availableModalities]);

  // Update used ROIs
  useEffect(() => {
    if (usedROIs.length > 0 && availableROIs.length > 0) {
      let newUsed = usedROIs.filter((m) => availableROIs.includes(m));

      setUsedROIs(newUsed);
    }
  }, [availableROIs]);

  const toggleCITooltip = () => setCITooltipOpen((open) => !open);

  const handleModelTypeChange = (e) => {
    setModelType(e.target.value);
  };

  const handleAlgorithmTypeChange = (e) => {
    setAlgorithmType(e.target.value);
  };

  const handleCollectionChange = (e) => {
    setActiveCollection(e.target.value);
  };

  const toggleFeatureConfig = () => {
    setFeatureConfigOpen((open) => !open);
  };

  const toggleFeatureNames = () => {
    setFeatureNamesOpen((open) => !open);
  };

  // Handle model train click
  const handleTrainModelClick = async () => {
    setIsTraining(true);

    let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

    let labels =
      modelType === MODEL_TYPES.CLASSIFICATION
        ? tabularClassificationLabels
        : tabularSurvivalLabels;

    let model = await trainModel(
      featureExtractionID,
      activeCollection ? +activeCollection : null,
      albumStudies,
      album,
      labels,
      modelType,
      algorithmType,
      usedModalities,
      usedROIs,
      keycloak.token
    );

    setIsTraining(false);
    setModels([model, ...models]);
    setShowNewModel(false);
  };

  const handleDeleteModelClick = async (id) => {
    const deletedModel = await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter((model) => model.id !== id));
  };

  const handleShowNewModelClick = () => {
    setShowNewModel(true);
  };

  const handleBackToModelsClick = () => {
    setShowNewModel(false);
  };

  const handleShowFeaturesConfig = (families) => {
    setFeaturesConfigFamilies(families);
    toggleFeatureConfig();
  };

  const handleShowFeatureNames = (names) => {
    setFeatureNames(names);
    toggleFeatureNames();
  };

  if (!album) return <span>Loading...</span>;

  //let album = albums.find((a) => a.album_id === albumID);

  let newModelForm = (
    <div>
      <h2>
        Train a new model on album "{album.name}"
        {collection ? (
          <span>, collection "{collection.collection.name}"</span>
        ) : null}
      </h2>

      {albumExtraction && (
        <div className="extractions-container">
          <p>
            Train model based on the latest extraction for this album, initiated
            at <strong>{albumExtraction.created_at}</strong>
          </p>
        </div>
      )}

      <h3>Model configuration</h3>
      <div>Choose the type of model to train</div>
      <div className="form-container">
        <Form>
          <Input
            type="select"
            id="model-type"
            name="model-type"
            value={modelType}
            onChange={handleModelTypeChange}
          >
            {Object.keys(MODEL_TYPES).map((key) => (
              <option key={key} value={MODEL_TYPES[key]}>
                {MODEL_TYPES[key]}
              </option>
            ))}
          </Input>
        </Form>
      </div>
      {modelType === MODEL_TYPES.CLASSIFICATION && (
        <>
          <div>Choose the classification algorithm</div>
          <div className="form-container">
            <Form>
              <Input
                type="select"
                id="algorithm-type"
                name="algorithm-type"
                value={algorithmType}
                onChange={handleAlgorithmTypeChange}
              >
                {Object.keys(CLASSIFICATION_ALGORITHMS).map((key) => (
                  <option key={key} value={CLASSIFICATION_ALGORITHMS[key]}>
                    {_.startCase(
                      CLASSIFICATION_ALGORITHMS[key].replace('_', ' ')
                    )}
                  </option>
                ))}
              </Input>
            </Form>
          </div>
        </>
      )}
      {albumExtraction && (
        <>
          <div>Choose the Collection used for training the model</div>
          <div className="form-container">
            <Form>
              <Input
                type="select"
                id="collection"
                name="collection"
                value={activeCollection}
                onChange={handleCollectionChange}
              >
                <option value="">{'<original>'}</option>
                {collections.map((c) => (
                  <option key={c.collection.id} value={c.collection.id}>
                    {c.collection.name}
                  </option>
                ))}
              </Input>
            </Form>
          </div>

          <h3>Train Model</h3>
          {unlabelledDataPoints > 0 ? (
            <p>
              There are still {unlabelledDataPoints} unlabelled PatientIDs,
              assign an outcome to them first!
              {/*/ROI pairs, assign an outcome to them first!*/}
            </p>
          ) : (
            <Button color="info" onClick={handleTrainModelClick}>
              {isTraining ? (
                <>
                  <FontAwesomeIcon icon="spinner" spin />{' '}
                  <span>Training Model...</span>
                </>
              ) : (
                <span>Train Model</span>
              )}
            </Button>
          )}

          {/* Hide this for now, we will just use the collections */}
          {/*<div>Choose the imaging modalities used for training the model</div>
          <CheckboxGroup
            name="modalities"
            value={usedModalities}
            onChange={setUsedModalities}
          >
            {(Checkbox) => (
              <>
                {availableModalities.sort().map((modality) => (
                  <label key={modality} style={{ margin: '0.5em' }}>
                    <Checkbox value={modality} /> {modality}
                  </label>
                ))}
              </>
            )}
          </CheckboxGroup>
          <div>Choose the ROIs used for training the model</div>
          <CheckboxGroup name="rois" value={usedROIs} onChange={setUsedROIs}>
            {(Checkbox) => (
              <>
                {availableROIs.sort().map((roi) => (
                  <label key={roi} style={{ margin: '0.5em' }}>
                    <Checkbox value={roi} /> {roi}
                  </label>
                ))}
              </>
            )}
          </CheckboxGroup>*/}
        </>
      )}
    </div>
  );

  const formatMetrics = (metrics) => {
    let formattedOtherMetrics = Object.keys(metrics).map((metricName) => (
      <tr key={metricName}>
        <td>
          <strong>{metricName}</strong>
        </td>
        <td>
          {metrics[metricName]['mean'].toFixed(3)} (
          {metrics[metricName]['inf_value'].toFixed(3)} -{' '}
          {metrics[metricName]['sup_value'].toFixed(3)})
        </td>
      </tr>
    ));

    /*let confusionMatrix = (
      <>
        <tr>
          <td>
            <span>
              <strong>True Positives</strong>
            </span>
            <br />
            <span>{true_pos}</span>
          </td>
          <td>
            <span>
              <strong>False Positives</strong>
            </span>
            <br />
            <span>{false_pos}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>
              <strong>False Negatives</strong>
            </span>
            <br />
            <span>{false_neg}</span>
          </td>
          <td>
            <span>
              <strong>True Negatives</strong>
            </span>
            <br />
            <span>{true_neg}</span>
          </td>
        </tr>
      </>
    );*/

    return (
      <>
        <Table className="metrics-table">
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>
                Metric Value{' '}
                <FontAwesomeIcon icon="question-circle" id="ciTooltip" />
                <Tooltip
                  placement="right"
                  isOpen={ciTooltipOpen}
                  target="ciTooltip"
                  toggle={toggleCITooltip}
                >
                  Shows the mean value & 95% confidence interval
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>{formattedOtherMetrics}</tbody>
        </Table>
        {/* Remove confusion matrix for now, focus on having confidence intervals}
        {true_pos !== undefined && (
          <>
            <strong>Confusion Matrix</strong>
            <Table className="confusion-matrix">
              <tbody>{confusionMatrix}</tbody>
            </Table>
          </>*/}
      </>
    );
  };

  const modelsList = (
    <>
      {albumExtraction && (
        <ListGroup>
          {models.map((model) => (
            <ListGroupItem key={model.id} className="model-entry">
              <h3>{model.name}</h3>
              <div className="model-details-container">
                <Table bordered className="model-details-table">
                  <tbody>
                    <tr>
                      <td>Created at</td>
                      <td>{model.created_at}</td>
                    </tr>
                    <tr>
                      <td>Model type</td>
                      <td>{model.type}</td>
                    </tr>
                    <tr>
                      <td>Algorithm Used</td>
                      <td>{model.algorithm}</td>
                    </tr>
                    <tr>
                      <td>Validation Strategy</td>
                      <td>
                        {model.validation_strategy
                          ? model.validation_strategy
                          : 'None'}
                      </td>
                    </tr>
                    <tr>
                      <td>Feature Selection</td>
                      <td>
                        {model.feature_selection
                          ? model.feature_selection
                          : 'None'}
                      </td>
                    </tr>
                    <tr>
                      <td>Modalities Used</td>
                      <td>
                        {model.modalities.map((modality) => (
                          <Badge
                            style={{ marginRight: '0.5em' }}
                            color="primary"
                            key={modality}
                          >
                            {modality}
                          </Badge>
                        ))}
                      </td>
                      {/*TODO - Get this dynamically or based on user input*/}
                    </tr>
                    <tr>
                      <td>ROIs Used</td>
                      <td>
                        {model.rois.map((roi) => (
                          <Badge
                            style={{ marginRight: '0.5em' }}
                            color="primary"
                            key={roi}
                          >
                            {roi}
                          </Badge>
                        ))}
                      </td>
                      {/*TODO - Get this dynamically or based on user input*/}
                    </tr>
                    <tr>
                      <td>Feature Families Used</td>
                      <td>
                        {model.extraction.families
                          .map((family) => family.feature_family.name)
                          .join(', ')}
                        {' - '}
                        <a
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            handleShowFeaturesConfig(model.extraction.families);
                          }}
                        >
                          Show details
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>Number of Features</td>
                      <td>
                        {model['feature-number']}
                        {' - '}
                        <a
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            handleShowFeatureNames(model['feature-names']);
                          }}
                        >
                          Show details
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>Number of Observations</td>
                      <td>{model.observations}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
              <hr />
              <div>
                <strong>Model Metrics</strong>
                {formatMetrics(model.metrics)}
              </div>
              <br />
              <p>
                <Button
                  color="danger"
                  onClick={() => handleDeleteModelClick(model.id)}
                >
                  Delete Model
                </Button>
              </p>
            </ListGroupItem>
          ))}
        </ListGroup>
      )}
      <MyModal
        isOpen={featureConfigOpen}
        toggle={toggleFeatureConfig}
        title={<span>Feature Groups</span>}
      >
        <FeaturesConfig families={featuresConfigFamilies} />
      </MyModal>
      <MyModal
        isOpen={featureNamesOpen}
        toggle={toggleFeatureNames}
        title={<span>Feature Names</span>}
      >
        <FeatureNames names={featureNames} />
      </MyModal>
    </>
  );

  if (models.length === 0) {
    return newModelForm;
  } else {
    if (showNewModel)
      return (
        <>
          <div>
            <Button color="primary" onClick={handleBackToModelsClick}>
              <FontAwesomeIcon icon="arrow-left"></FontAwesomeIcon>{' '}
              <span>Back to existing models</span>
            </Button>
          </div>
          <p> </p>
          {newModelForm}
        </>
      );
    else
      return (
        <>
          <h2>Existing models for album {album.name}</h2>
          <div>
            <br />
            <Button color="primary" onClick={handleShowNewModelClick}>
              <FontAwesomeIcon icon="plus"></FontAwesomeIcon>{' '}
              <span>Train a new model</span>
            </Button>
          </div>
          {modelsList}
        </>
      );
  }
}
