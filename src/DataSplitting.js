import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Form, FormGroup, FormText, Input, Label } from 'reactstrap';
import {
  DATA_SPLITTING_DEFAULT_TRAINING_SPLIT,
  DATA_SPLITTING_TYPES
} from './config/constants';

import _ from 'lodash';

import './DataSplitting.css';
import backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';

export default function DataSplitting({
  featureExtractionID,
  collectionID,
  dataSplittingType,
  setDataSplittingType,
  nbTrainingPatients,
  setNbTrainingPatients,
  dataPoints,
  outcomes,
  trainingPatients,
  testPatients,
  setTrainingPatients,
  setTestPatients
}) {
  const { keycloak } = useKeycloak();

  const handleDataSplitChange = e => {
    setDataSplittingType(e.target.value);
  };

  const handleNbTrainingPatientsChange = async e => {
    setNbTrainingPatients(+e.target.value);
  };

  const patients = useMemo(() => {
    let filteredOutcomes = outcomes.filter(o =>
      dataPoints.includes(o.patient_id)
    );

    let trainingPatients = _(filteredOutcomes)
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

    // Fill up with another patient if split does not produce exact number of requested patients
    if (trainingPatients.length < nbTrainingPatients) {
      trainingPatients.push(
        _.sample(_.difference(dataPoints, trainingPatients))
      );
    }

    let testPatients = _.difference(dataPoints, trainingPatients);

    return { trainingPatients, testPatients };
  }, [dataPoints, outcomes, nbTrainingPatients]);

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
      Math.floor(dataPoints.length * DATA_SPLITTING_DEFAULT_TRAINING_SPLIT)
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

    if (dataSplittingType === DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT) {
      initPatients();
    } else {
      reinitPatients();
    }
  }, [savePatients, dataSplittingType, resetPatients, trainingPatients]);

  const computePatientColor = patientID => {
    let patientOutcome = outcomes.find(o => o.patient_id === patientID);

    return patientOutcome.label_content.Outcome === 'PLC-' ? 'green' : 'red';
  };

  const computeClassProportions = patientIDs => {
    let patientOutcomes = {};

    for (let patientID of patientIDs) {
      let patientLabel = outcomes.find(o => o.patient_id === patientID);
      let patientOutcome = patientLabel.label_content.Outcome;

      if (!Object.keys(patientOutcomes).includes(patientOutcome)) {
        patientOutcomes[patientOutcome] = 1;
      } else {
        patientOutcomes[patientOutcome]++;
      }
    }

    return Object.keys(patientOutcomes)
      .sort((o1, o2) => o1.localeCompare(o2))
      .map(
        label =>
          `${label} : ${patientOutcomes[label]} (${(
            (patientOutcomes[label] / patientIDs.length) *
            100
          ).toFixed(1)}%) `
      );
  };

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
                  dataSplittingType === DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT
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
                learning models are created using only the training set and are
                subsequently evaluated on the unseen test set using the
                Bootstrap method.
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
              Explore whole dataset/collection ({dataPoints.length} patients)
            </Label>
            <Alert color="secondary">
              <span>
                Using this mode, you will be able to visualize the features of{' '}
                <strong>all patients</strong>. When creating machine learning
                models, evaluation metrics will be based on a{' '}
                <strong>cross-validation</strong> of all available data.
              </span>
            </Alert>
          </FormGroup>
        </FormGroup>
      </Form>
      {dataSplittingType === DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT && (
        <>
          <h5>Training & Test Set Split</h5>
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
                {Math.floor((nbTrainingPatients / dataPoints.length) * 100)}%)
              </span>
              <span>
                Test : {dataPoints.length - nbTrainingPatients} patients (
                {Math.floor(
                  ((dataPoints.length - nbTrainingPatients) /
                    dataPoints.length) *
                    100
                )}
                %)
              </span>
            </Label>
          </FormGroup>
        </>
      )}
    </div>
  );
}
