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
  Tooltip
} from 'reactstrap';

import './Train.css';
import Backend from './services/backend';
import { useKeycloak } from 'react-keycloak';

import * as parse from 'csv-parse/lib/sync';
import * as csvString from 'csv-string';

import _ from 'lodash';
import Kheops from './services/kheops';
import { trainModel } from './utils/feature-utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CheckboxGroup from 'react-checkbox-group';
import MyModal from './components/MyModal';
import FeaturesConfig from './components/FeaturesConfig';
import FeatureNames from './components/FeatureNames';
import DataLabels from './components/DataLabels';

const PATIENT_ID_FIELD = 'PatientID';
const ROI_FIELD = 'ROI';
const MODALITY_FIELD = 'Modality';
const NON_FEATURE_FIELDS = [PATIENT_ID_FIELD, MODALITY_FIELD, ROI_FIELD];

const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival'
};

const CLASSIFICATION_ALGORITHMS = {
  LOGISTIC_REGRESSION: 'logistic_regression',
  LASSO_REGRESSION: 'lasso_regression',
  ELASTIC_NET: 'elastic_net',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm'
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

export default function Train({ match, albums }) {
  let {
    params: { albumID }
  } = match;

  let [keycloak] = useKeycloak();

  let [models, setModels] = useState([]);
  let [modelType, setModelType] = useState(MODEL_TYPES.CLASSIFICATION);
  let [algorithmType, setAlgorithmType] = useState(
    CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION
  );

  let [usedModalities, setUsedModalities] = useState([]);
  let [usedROIs, setUsedROIs] = useState([]);
  let [albumExtraction, setAlbumExtraction] = useState(null);
  let [dataPoints, setDataPoints] = useState(null);

  let [featuresConfigFamilies, setFeaturesConfigFamilies] = useState(null);
  let [featureConfigOpen, setFeatureConfigOpen] = useState(false);

  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);

  let [showNewModel, setShowNewModel] = useState(false);

  let [classificationLabels, setClassificationLabels] = useState({});
  let [survivalLabels, setSurvivalLabels] = useState({});

  let [ciTooltipOpen, setCITooltipOpen] = useState(false);

  // Initialize all modalities & ROIs to be checked
  useEffect(() => {
    if (albumExtraction) {
      setUsedModalities(albumExtraction['extraction-modalities']);
      setUsedROIs(albumExtraction['extraction-rois']);
    }
  }, [albumExtraction]);

  useEffect(() => {
    async function getModels() {
      let models = await Backend.models(keycloak.token, albumID);
      let sortedModels = models.sort(
        (m1, m2) => new Date(m2.created_at) - new Date(m1.created_at)
      );
      setModels(sortedModels);
    }

    async function getExtraction() {
      let extraction = await Backend.extractions(keycloak.token, albumID);
      setAlbumExtraction(extraction);
    }

    getModels();
    getExtraction();
  }, [keycloak.token]);

  useEffect(() => {
    async function getDataPoints() {
      let response = await Backend.extractionDataPoints(
        keycloak.token,
        albumExtraction.id
      );
      setDataPoints(response['data-points']);
    }

    if (albumExtraction) getDataPoints();
  }, [albumExtraction]);

  const toggleCITooltip = () => setCITooltipOpen(open => !open);

  const handleModelTypeChange = e => {
    setModelType(e.target.value);
  };

  const handleAlgorithmTypeChange = e => {
    setAlgorithmType(e.target.value);
  };

  const tabularClassificationLabels = useMemo(() => {
    let formattedLabels = [];
    for (let patientID in classificationLabels) {
      formattedLabels.push([
        patientID,
        classificationLabels[patientID].Outcome
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
        survivalLabels[patientID].Event
      ]);
    }
    return formattedLabels;
  });

  const toggleFeatureConfig = () => {
    setFeatureConfigOpen(open => !open);
  };

  const toggleFeatureNames = () => {
    setFeatureNamesOpen(open => !open);
  };

  // Get classification labels
  useEffect(() => {
    if (!dataPoints) return;

    async function getLabels() {
      let formattedLabels = await getFormattedLabels(
        keycloak.token,
        albumID,
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
        albumID,
        dataPoints,
        MODEL_TYPES.SURVIVAL,
        SURVIVAL_OUTCOMES
      );
      setSurvivalLabels(formattedLabels);
    }

    getLabels();
  }, [dataPoints]);

  const handleTrainModelClick = async () => {
    setIsTraining(true);

    let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

    let labels =
      modelType === MODEL_TYPES.CLASSIFICATION
        ? tabularClassificationLabels
        : tabularSurvivalLabels;

    let model = await trainModel(
      albumExtraction,
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

  const handleDeleteModelClick = async id => {
    const deletedModel = await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter(model => model.id !== id));
  };

  const handleShowNewModelClick = () => {
    setShowNewModel(true);
  };

  const handleBackToModelsClick = () => {
    setShowNewModel(false);
  };

  const handleShowFeaturesConfig = families => {
    setFeaturesConfigFamilies(families);
    toggleFeatureConfig();
  };

  const handleShowFeatureNames = names => {
    setFeatureNames(names);
    toggleFeatureNames();
  };

  if (albums.length === 0) return <span>Loading...</span>;

  let album = albums.find(a => a.album_id === albumID);

  let newModelForm = (
    <div>
      <h2>Train a new model on album "{album.name}"</h2>

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
            {Object.keys(MODEL_TYPES).map(key => (
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
                {Object.keys(CLASSIFICATION_ALGORITHMS).map(key => (
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
          <div>Choose the imaging modalities used for training the model</div>
          <CheckboxGroup
            name="modalities"
            value={usedModalities}
            onChange={setUsedModalities}
          >
            {Checkbox => (
              <>
                {albumExtraction['extraction-modalities']
                  .sort()
                  .map(modality => (
                    <label key={modality} style={{ margin: '0.5em' }}>
                      <Checkbox value={modality} /> {modality}
                    </label>
                  ))}
              </>
            )}
          </CheckboxGroup>
          <div>Choose the ROIs used for training the model</div>
          <CheckboxGroup name="rois" value={usedROIs} onChange={setUsedROIs}>
            {Checkbox => (
              <>
                {albumExtraction['extraction-rois'].sort().map(roi => (
                  <label key={roi} style={{ margin: '0.5em' }}>
                    <Checkbox value={roi} /> {roi}
                  </label>
                ))}
              </>
            )}
          </CheckboxGroup>
        </>
      )}
      {dataPoints ? (
        <>
          <h3>Data Labelling</h3>
          <p>
            There are <strong>{dataPoints.length} data points</strong>
            (PatientID)
          </p>
          {modelType === MODEL_TYPES.CLASSIFICATION && (
            <DataLabels
              albumID={albumID}
              dataPoints={dataPoints}
              isTraining={isTraining}
              handleTrainModelClick={handleTrainModelClick}
              dataLabels={classificationLabels}
              setDataLabels={setClassificationLabels}
              labelType={MODEL_TYPES.CLASSIFICATION}
              outcomeColumns={CLASSIFICATION_OUTCOMES}
              validateLabelFile={(file, dataPoints, setDataLabels) =>
                validateLabelFile(
                  file,
                  dataPoints,
                  setDataLabels,
                  CLASSIFICATION_OUTCOMES
                )
              }
            />
          )}
          {modelType === MODEL_TYPES.SURVIVAL && (
            <DataLabels
              albumID={albumID}
              dataPoints={dataPoints}
              isTraining={isTraining}
              handleTrainModelClick={handleTrainModelClick}
              dataLabels={survivalLabels}
              setDataLabels={setSurvivalLabels}
              labelType={MODEL_TYPES.SURVIVAL}
              outcomeColumns={SURVIVAL_OUTCOMES}
              validateLabelFile={(file, dataPoints, setDataLabels) =>
                validateLabelFile(
                  file,
                  dataPoints,
                  setDataLabels,
                  SURVIVAL_OUTCOMES
                )
              }
            />
          )}
        </>
      ) : (
        <span>Loading...</span>
      )}
    </div>
  );

  const formatMetrics = metrics => {
    let formattedOtherMetrics = Object.keys(metrics).map(metricName => (
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
          {models.map(model => (
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
                        {model.modalities.map(modality => (
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
                        {model.rois.map(roi => (
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
                          .map(family => family.feature_family.name)
                          .join(', ')}
                        {' - '}
                        <a
                          href="#"
                          onClick={event => {
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
                          onClick={event => {
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

function validateFileType(file) {
  /* Validate metadata - file type */
  if (
    ![
      'text/csv',
      'text/comma-separated-values',
      'text/tab-separated-values',
      'application/csv',
      'application/x-csv'
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
      fullHeaderFieldNames.every(fieldName => headerFields.includes(fieldName));

    let columns = hasHeader ? true : fullHeaderFieldNames;

    const records = parse(content, {
      columns: columns,
      skip_empty_lines: true
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
        record => record.PatientID === patientID
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
