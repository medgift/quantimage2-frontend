import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Form, FormGroup, FormText, Input, Label } from 'reactstrap';
import {
  DATA_SPLITTING_DEFAULT_TRAINING_PERCENTAGE,
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
  trainTestSplit,
  setTrainTestSplit,
  dataPoints,
  outcomes,
  trainingPatients,
  testingPatients,
  setTrainingPatients,
  setTestingPatients
}) {
  const { keycloak } = useKeycloak();

  const handleDataSplitChange = e => {
    setDataSplittingType(e.target.value);
  };

  const handleTrainTestSplitChange = async e => {
    setTrainTestSplit(+e.target.value);
  };

  const patients = useMemo(() => {
    let filteredOutcomes = outcomes.filter(o =>
      dataPoints.includes(o.patient_id)
    );

    let groupedOutcomes = _.groupBy(filteredOutcomes, 'label_content.Outcome');

    // TODO - This needs to be modified if more than 2 classes need to be supported!
    let firstClassProportion =
      groupedOutcomes[Object.keys(groupedOutcomes)[0]].length /
      filteredOutcomes.length;

    let trainingPatients = _(filteredOutcomes)
      .groupBy('label_content.Outcome')
      .map(v => _.sampleSize(v, v.length * (trainTestSplit / 100)))
      .flatten()
      .map(v => v.patient_id)
      .value();

    let testingPatients = _.difference(dataPoints, trainingPatients);

    return { trainingPatients, testingPatients };
  }, [dataPoints, outcomes, trainTestSplit]);

  const savePatients = useCallback(async () => {
    await backend.saveTrainingTestingPatients(
      keycloak.token,
      featureExtractionID,
      collectionID,
      patients.trainingPatients,
      patients.testingPatients
    );

    setTrainingPatients(patients.trainingPatients);
    setTestingPatients(patients.testingPatients);
  }, [
    keycloak.token,
    featureExtractionID,
    collectionID,
    patients,
    setTrainingPatients,
    setTestingPatients
  ]);

  const resetPatients = useCallback(async () => {
    await backend.saveTrainingTestingPatients(
      keycloak.token,
      featureExtractionID,
      collectionID,
      null,
      null
    );
    setTrainingPatients(null);
    setTestingPatients(null);
    setTrainTestSplit(DATA_SPLITTING_DEFAULT_TRAINING_PERCENTAGE);
  }, [
    keycloak.token,
    featureExtractionID,
    collectionID,
    setTrainingPatients,
    setTestingPatients,
    setTrainTestSplit
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
              Explore whole dataset/collection with {dataPoints.length} patients
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
              Split the dataset into training & testing sets
            </Label>
            <Alert color="secondary">
              <span>
                Using this mode, the data will be split into{' '}
                <strong>training</strong> & <strong>testing</strong> sets.
                Testing patients will not be shown in the visualization tab.
                Machine learning models are created using only the training set
                and are subsequently evaluated on the unseen testing set.
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
              id="train-test-split-range"
              name="traintestsplit"
              type="range"
              className="custom-range"
              value={trainTestSplit}
              onChange={handleTrainTestSplitChange}
              onMouseUp={savePatients}
              onKeyUp={savePatients}
            />
            <Label
              for="train-test-split-range"
              className="d-flex flex-grow-1 justify-content-between"
            >
              <span>Training : {trainTestSplit}%</span>
              <span>Testing : {100 - trainTestSplit}%</span>
            </Label>
            <h6>Training & Testing Patients</h6>
            <p>{computeClassProportions(dataPoints)}</p>
            {trainingPatients && testingPatients && (
              <div className="d-flex align-items-start justify-content-center">
                <div className="Patients-list">
                  <p>{computeClassProportions(trainingPatients)}</p>
                  {[...trainingPatients]
                    .sort((p1, p2) =>
                      p1.localeCompare(p2, undefined, {
                        numeric: true,
                        sensitivity: 'base'
                      })
                    )
                    .map(p => (
                      <p key={p} style={{ color: computePatientColor(p) }}>
                        {p}
                      </p>
                    ))}
                </div>
                <div className="Patients-list">
                  <p>{computeClassProportions(testingPatients)}</p>
                  {[...testingPatients]
                    .sort((p1, p2) =>
                      p1.localeCompare(p2, undefined, {
                        numeric: true,
                        sensitivity: 'base'
                      })
                    )
                    .map(p => (
                      <p key={p} style={{ color: computePatientColor(p) }}>
                        {p}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </FormGroup>
        </>
      )}
    </div>
  );
}
