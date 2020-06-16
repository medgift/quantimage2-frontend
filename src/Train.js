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
  ListGroupItem
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
  let [albumExtraction, setAlbumExtraction] = useState(null);
  let [dataPoints, setDataPoints] = useState(null);

  let [isManualLabellingOpen, setIsManualLabellingOpen] = useState(false);
  let [isAutoLabellingOpen, setIsAutoLabellingOpen] = useState(false);

  let [showNewModel, setShowNewModel] = useState(false);

  let [isLabelFileValid, setIsLabelFileValid] = useState(null);
  let [labelFileError, setLabelFileError] = useState(null);

  let [dataLabels, setDataLabels] = useState({});

  let [isTraining, setIsTraining] = useState(false);

  let fileInput = useRef(null);

  useEffect(() => {
    async function getModels() {
      let models = await Backend.models(keycloak.token, albumID);
      setModels(models);
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

  const handleModelTypeChange = e => {
    setModelType(e.target.value);
  };

  const handleAlgorithmTypeChange = e => {
    setAlgorithmType(e.target.value);
  };

  const handleLabelInputChange = (e, patientID, roi) => {
    let updatedLabels = { ...dataLabels };

    if (!updatedLabels[patientID]) updatedLabels[patientID] = {};

    updatedLabels[patientID][roi] = e.target.value;

    setDataLabels(updatedLabels);
  };

  const handleSaveLabelsClick = async e => {
    await Backend.saveLabels(keycloak.token, albumID, dataLabels);
  };

  const handleFileInputChange = async () => {
    let [isValid, error] = await validateLabelFile(
      fileInput.current.files[0],
      dataPoints,
      setDataLabels
    );
    setIsLabelFileValid(isValid);
    setLabelFileError(error);
  };

  const handleTrainModelClick = async () => {
    setIsTraining(true);

    let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

    let model = await trainModel(
      albumExtraction,
      albumStudies,
      album,
      tabularDataLabels,
      modelType,
      algorithmType,
      keycloak.token
    );

    setIsTraining(false);
    setModels([...models, model]);
    setShowNewModel(false);
  };

  const toggleManualLabelling = () => {
    setIsManualLabellingOpen(open => !open);
    setIsAutoLabellingOpen(false);
  };

  const toggleAutoLabelling = () => {
    setIsAutoLabellingOpen(open => !open);
    setIsManualLabellingOpen(false);
  };

  useEffect(() => {
    if (!dataPoints) return;

    async function getLabels() {
      let labels = await Backend.labels(keycloak.token, albumID);

      let formattedLabels = labels.reduce((acc, label) => {
        if (!acc[label.patient_id]) acc[label.patient_id] = {};

        acc[label.patient_id][label.roi] = label.outcome;

        return acc;
      }, {});

      // Add potentially missing labels
      for (let [patientID, roi] of dataPoints) {
        if (!Object.keys(formattedLabels).includes(patientID)) {
          formattedLabels[patientID] = {};
        }

        if (!Object.keys(formattedLabels[patientID]).includes(roi)) {
          formattedLabels[patientID][roi] = '';
        }
      }

      setDataLabels(formattedLabels);
    }

    getLabels();
  }, [dataPoints]);

  const unlabelledDataPoints = useMemo(() => {
    let unlabelled = 0;
    for (let patientID in dataLabels) {
      for (let roi in dataLabels[patientID]) {
        if (dataLabels[patientID][roi] === '') unlabelled++;
      }
    }

    return unlabelled;
  }, [dataLabels]);

  const tabularDataLabels = useMemo(() => {
    let formattedLabels = [];
    for (let patientID in dataLabels) {
      for (let roi in dataLabels[patientID]) {
        formattedLabels.push([patientID, roi, dataLabels[patientID][roi]]);
      }
    }

    return formattedLabels;
  }, [dataLabels]);

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
                      CLASSIFICATION_ALGORITHMS[key].replaceAll('_', ' ')
                    )}
                  </option>
                ))}
              </Input>
            </Form>
          </div>
        </>
      )}
      {dataPoints ? (
        <>
          <h3>Data Labelling</h3>
          <p>
            There are <strong>{dataPoints.length} data points</strong>
            (PatientID,ROI)
          </p>
          <p>
            <Button color="primary" onClick={toggleManualLabelling}>
              Manual labelling
            </Button>{' '}
            <Button color="success" onClick={toggleAutoLabelling}>
              Automatic labelling
            </Button>
          </p>
          <Collapse isOpen={isManualLabellingOpen}>
            <Table className="narrow-table">
              <thead>
                <tr>
                  <th>PatientID</th>
                  <th>ROI</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody className="data-points">
                {dataPoints.map(dataPoint => (
                  <tr key={`${dataPoint[0]}-${dataPoint[1]}`}>
                    <td>{dataPoint[0]}</td>
                    <td>{dataPoint[1]}</td>
                    <td className="data-label">
                      <Input
                        type="text"
                        placeholder="LABEL"
                        value={
                          dataLabels[dataPoint[0]] &&
                          dataLabels[dataPoint[0]][dataPoint[1]]
                            ? dataLabels[dataPoint[0]][dataPoint[1]]
                            : ''
                        }
                        onChange={e => {
                          handleLabelInputChange(e, dataPoint[0], dataPoint[1]);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Button color="success" onClick={handleSaveLabelsClick}>
              Save Labels
            </Button>
          </Collapse>

          <Collapse isOpen={isAutoLabellingOpen}>
            <p>
              Please upload a CSV file with{' '}
              <strong>{dataPoints.length} rows</strong> (+optionnally a header
              row) containing the following <strong>3 columns</strong>:
            </p>
            <Table className="narrow-table">
              <thead>
                <tr>
                  <th>PatientID</th>
                  <th>ROI</th>
                  <th>Outcome</th>
                </tr>
              </thead>
            </Table>
            <Label for="label-file">Upload CSV File</Label>
            <Input
              type="file"
              name="file"
              id="label-file"
              innerRef={fileInput}
              style={{ textAlign: 'center' }}
              onChange={handleFileInputChange}
            />
            <br />
            {fileInput.current &&
              fileInput.current.files[0] &&
              !isLabelFileValid && (
                <Alert color="danger">
                  The selected file is not valid: {labelFileError}
                </Alert>
              )}
            {fileInput.current &&
              fileInput.current.files[0] &&
              isLabelFileValid && (
                <>
                  <Alert color="success">The selected file is valid!</Alert>
                  <Button color="success" onClick={handleSaveLabelsClick}>
                    Save Labels
                  </Button>
                </>
              )}
          </Collapse>
          <br />
          <h3>Train Model</h3>
          {unlabelledDataPoints > 0 ? (
            <p>
              There are still {unlabelledDataPoints} unlabelled PatientID/ROI
              pairs, assign an outcome to them first!
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
        </>
      ) : (
        <span>Loading...</span>
      )}
    </div>
  );

  const formatMetrics = metrics => {
    let { true_pos, true_neg, false_pos, false_neg, ...otherMetrics } = metrics;

    let formattedOtherMetrics = Object.keys(otherMetrics).map(metricName => (
      <tr key={metricName}>
        <td>
          <strong>{metricName}</strong>
        </td>
        <td>{metrics[metricName]}</td>
      </tr>
    ));

    let confusionMatrix = (
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
    );

    return (
      <>
        <Table>
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>Metric Value</th>
            </tr>
          </thead>
          <tbody>{formattedOtherMetrics}</tbody>
        </Table>
        <Table>
          <thead>
            <tr>
              <th colSpan="2">Confusion Matrix</th>
            </tr>
          </thead>
          <tbody>{confusionMatrix}</tbody>
        </Table>
      </>
    );
  };

  const modelsList = (
    <>
      <h2>Existing models for album {album.name}</h2>
      <ListGroup>
        {models.map(model => (
          <ListGroupItem key={model.id} className="model-entry">
            <h3>{model.name}</h3>
            <div>
              <strong>Created at :</strong> {model.created_at}
            </div>
            <div>
              <strong>Model type :</strong> {model.type}
            </div>
            <div>
              <strong>Used Algorithm :</strong> {model.algorithm}
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
          {modelsList}
          <div>
            <br />
            <Button color="primary" onClick={handleShowNewModelClick}>
              <FontAwesomeIcon icon="plus"></FontAwesomeIcon>{' '}
              <span>Train a new model</span>
            </Button>
          </div>
        </>
      );
  }
}

async function validateLabelFile(file, dataPoints, setDataLabels) {
  console.log(file);
  let valid = false;
  let error = null;

  /* Validate metadata - file type */
  if (!['text/csv'].includes(file.type)) {
    error = 'The file is not a CSV file!';
    return [valid, error];
  }

  /* Validate file content */
  const content = await file.text();

  try {
    let firstLine = content.split('\n')[0];

    let separator = csvString.detect(firstLine);

    let headerFields = firstLine.split(separator);

    let hasHeader =
      headerFields.length === 3 &&
      headerFields.includes('PatientID') &&
      headerFields.includes('ROI') &&
      headerFields.includes('Outcome');

    let columns = hasHeader ? true : ['PatientID', 'ROI', 'Outcome'];

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

    for (let dataPoint of dataPoints) {
      let matchingRecord = records.find(
        record =>
          record.PatientID === dataPoint[0] && record.ROI === dataPoint[1]
      );
      if (!matchingRecord) {
        allMatched = false;
      } else {
        nbMatches++;

        // Fill labels
        if (!labels[matchingRecord.PatientID]) {
          labels[matchingRecord.PatientID] = {};
        }

        labels[matchingRecord.PatientID][matchingRecord.ROI] =
          matchingRecord.Outcome;
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
