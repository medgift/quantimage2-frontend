import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, FormGroup, Input, Label } from 'reactstrap';
import {
  DATA_SPLITTING_DEFAULT_TRAINING_SPLIT,
  DATA_SPLITTING_TYPES,
  PATIENT_FIELDS,
  TRAIN_TEST_SPLIT_TYPES
} from './config/constants';

import _ from 'lodash';

import './DataSplitting.css';
import backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';
import Backend from './services/backend';

export default function DataSplitting({
  featureExtractionID,
  collectionID,
  dataSplittingType,
  updateDataSplittingType,
  trainTestSplitType,
  updateTrainTestSplitType,
  nbTrainingPatients,
  setNbTrainingPatients,
  dataPoints,
  outcomes,
  trainingPatients,
  testPatients,
  setTrainingPatients,
  setTestPatients,
  transferPatients
}) {
  const { keycloak } = useKeycloak();

  const handleSplitTypeChange = async e => {
    await updateTrainTestSplitType(e.target.id);
  };

  const handleDataSplitChange = async e => {
    await updateDataSplittingType(e.target.value);
  };

  const handleNbTrainingPatientsChange = async e => {
    setNbTrainingPatients(+e.target.value);
  };

  const patients = useMemo(() => {
    let trainingPatients;
    if (!outcomes) {
      trainingPatients = _.sampleSize(
        dataPoints,
        Math.floor(nbTrainingPatients)
      );
    } else {
      let filteredOutcomes = outcomes.filter(o =>
        dataPoints.includes(o.patient_id)
      );

      trainingPatients = _(filteredOutcomes)
        .groupBy('label_content.Outcome')
        .map(v =>
          _.sampleSize(
            v,
            Math.floor(v.length * (nbTrainingPatients / dataPoints.length))
          )
        )
        .flatten()
        .map(v => v.patient_id)
        .value();
    }

    // Fill up with another patient if split does not produce exact number of requested patients
    if (trainingPatients.length < nbTrainingPatients) {
      trainingPatients.push(
        _.sample(_.difference(dataPoints, trainingPatients))
      );
    }

    let testPatients = _.difference(dataPoints, trainingPatients);

    return { trainingPatients, testPatients };
  }, [dataPoints, outcomes, nbTrainingPatients]);

  const [selectedTrainingPatients, setSelectedTrainingPatients] = useState([]);
  const [selectedTestPatients, setSelectedTestPatients] = useState([]);

  const savePatients = useCallback(async () => {
    await backend.saveTrainingTestPatients(
      keycloak.token,
      featureExtractionID,
      collectionID,
      patients.trainingPatients,
      patients.testPatients
    );

    setTrainingPatients(patients.trainingPatients);
    setTestPatients(patients.testPatients);
  }, [
    keycloak.token,
    featureExtractionID,
    collectionID,
    patients,
    setTrainingPatients,
    setTestPatients
  ]);

  const resetPatients = useCallback(async () => {
    await backend.saveTrainingTestPatients(
      keycloak.token,
      featureExtractionID,
      collectionID,
      null,
      null
    );
    setTrainingPatients(null);
    setTestPatients(null);
    setNbTrainingPatients(
      Math.round(dataPoints.length * DATA_SPLITTING_DEFAULT_TRAINING_SPLIT)
    );
  }, [
    keycloak.token,
    featureExtractionID,
    collectionID,
    setTrainingPatients,
    setTestPatients,
    setNbTrainingPatients,
    dataPoints
  ]);

  useEffect(() => {
    async function initPatients() {
      if (trainingPatients === null) await savePatients();
    }

    async function reinitPatients() {
      if (trainingPatients !== null) await resetPatients();
    }

    if (dataSplittingType !== DATA_SPLITTING_TYPES.FULL_DATASET) {
      initPatients();
    } else {
      reinitPatients();
    }
  }, [savePatients, resetPatients, trainingPatients, dataSplittingType]);

  return (
    <div>
      <h4>Data Splitting</h4>
      <Form>
        <FormGroup tag="fieldset" className="d-flex">
          <FormGroup check className="flex-grow-1" style={{ flexBasis: 0 }}>
            <Label>
              <Input
                type="radio"
                name="model-validation"
                value={DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT}
                checked={
                  dataSplittingType !== DATA_SPLITTING_TYPES.FULL_DATASET
                }
                onChange={handleDataSplitChange}
              />{' '}
              Split the dataset into training & test sets
            </Label>
            <Alert color="secondary">
              <span>
                Using this mode, the data will be split into{' '}
                <strong>training</strong> & <strong>test</strong> sets. Test
                patients will not be shown in the visualization tab. Machine
                learning models are created using the training set only and are
                subsequently evaluated on the unseen test patients. Confidence
                Intervals (CIs) at 95 % are computed using bootstrap resampling
                (with N=1000 bootstraps).
              </span>
            </Alert>
          </FormGroup>
          <FormGroup check className="flex-grow-1 Splitting-choice">
            <Label>
              <Input
                type="radio"
                name="model-validation"
                value={DATA_SPLITTING_TYPES.FULL_DATASET}
                checked={
                  dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET
                }
                onChange={handleDataSplitChange}
              />{' '}
              Explore entire dataset/collection ({dataPoints.length} patients)
            </Label>
            <Alert color="secondary">
              <span>
                Using this mode, you will be able to visualize the features of{' '}
                <strong>all patients</strong>. When creating machine learning
                models, evaluation metrics will be based on a stratified K-fold
                cross-validation of all available data.
              </span>
            </Alert>
          </FormGroup>
        </FormGroup>
      </Form>
      {dataSplittingType !== DATA_SPLITTING_TYPES.FULL_DATASET && (
        <>
          <h4>Training & Test Set Split</h4>

          <FormGroup tag="fieldset">
            <p>Splitting Method</p>
            <FormGroup check inline>
              <Input
                id={TRAIN_TEST_SPLIT_TYPES.AUTO}
                type="radio"
                checked={trainTestSplitType === TRAIN_TEST_SPLIT_TYPES.AUTO}
                onChange={handleSplitTypeChange}
              />
              <Label check for={TRAIN_TEST_SPLIT_TYPES.AUTO}>
                Automatic randomized split
              </Label>
            </FormGroup>
            <FormGroup check inline>
              <Input
                id={TRAIN_TEST_SPLIT_TYPES.MANUAL}
                type="radio"
                checked={trainTestSplitType === TRAIN_TEST_SPLIT_TYPES.MANUAL}
                onChange={handleSplitTypeChange}
              />
              <Label check for={TRAIN_TEST_SPLIT_TYPES.MANUAL}>
                Manual split
              </Label>
            </FormGroup>
          </FormGroup>

          {trainTestSplitType === TRAIN_TEST_SPLIT_TYPES.AUTO && (
            <FormGroup style={{ width: '66%' }} className="m-auto">
              <Input
                id="nb-training-patients-range"
                name="nbtrainingpatients"
                type="range"
                className="custom-range"
                value={nbTrainingPatients}
                onChange={handleNbTrainingPatientsChange}
                onMouseUp={savePatients}
                onKeyUp={savePatients}
                min={1}
                max={dataPoints.length - 1}
              />
              <Label
                for="train-test-split-range"
                className="d-flex flex-grow-1 justify-content-between"
              >
                <span>
                  Training : {nbTrainingPatients} patients (
                  {Math.round((nbTrainingPatients / dataPoints.length) * 100)}%)
                </span>
                <span>
                  Test : {dataPoints.length - nbTrainingPatients} patients (
                  {Math.round(
                    ((dataPoints.length - nbTrainingPatients) /
                      dataPoints.length) *
                      100
                  )}
                  %)
                </span>
              </Label>
            </FormGroup>
          )}

          {trainTestSplitType === TRAIN_TEST_SPLIT_TYPES.MANUAL && (
            <div className="d-flex align-items-center justify-content-center">
              <PatientSelectList
                title="Training Patients"
                patients={trainingPatients}
                selectedPatients={selectedTrainingPatients}
                setSelectedPatients={setSelectedTrainingPatients}
              />
              <div className="m-5">
                <Button
                  color="primary"
                  title="Transfer to Test"
                  onClick={() => {
                    transferPatients(
                      selectedTrainingPatients,
                      PATIENT_FIELDS.TRAINING,
                      PATIENT_FIELDS.TEST
                    );
                    setSelectedTrainingPatients([]);
                  }}
                  style={{ minWidth: 270 }}
                >
                  {`Transfer ${selectedTrainingPatients.length} patients to Test >>`}
                </Button>
                <br className="m-3" />
                <Button
                  color="primary"
                  title="Transfer to Training"
                  onClick={() => {
                    transferPatients(
                      selectedTestPatients,
                      PATIENT_FIELDS.TEST,
                      PATIENT_FIELDS.TRAINING
                    );
                    setSelectedTestPatients([]);
                  }}
                  style={{ minWidth: 270 }}
                >
                  {`<< Transfer ${selectedTestPatients.length} patients to Training`}
                </Button>
              </div>
              <PatientSelectList
                title="Test Patients"
                patients={testPatients}
                selectedPatients={selectedTestPatients}
                setSelectedPatients={setSelectedTestPatients}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PatientSelectList({
  title,
  patients,
  selectedPatients,
  setSelectedPatients
}) {
  const handleSelectionChange = e => {
    setSelectedPatients([...e.target.selectedOptions].map(p => p.value));
  };

  const selectAll = () => setSelectedPatients(patients);
  const deselectAll = () => setSelectedPatients([]);

  return (
    <FormGroup>
      <Label>
        {title}
        <Input
          type="select"
          multiple
          onChange={handleSelectionChange}
          value={selectedPatients}
          style={{ minHeight: 300 }}
        >
          {[...patients]
            .sort((p1, p2) =>
              p1.localeCompare(p2, undefined, { numeric: true })
            )
            .map(p => (
              <option value={p} key={p}>
                {p}
              </option>
            ))}
        </Input>
      </Label>
      <div>
        <Button color="link" onClick={selectAll}>
          <small>Select All</small>
        </Button>
        <Button color="link" onClick={deselectAll}>
          <small>Deselect All</small>
        </Button>
      </div>
    </FormGroup>
  );
}
