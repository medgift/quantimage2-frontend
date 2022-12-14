import { Parser } from 'json2csv';

import DicomFields from '../dicom/fields';
import Backend from '../services/backend';
import Kheops from '../services/kheops';
import _ from 'lodash';
import React from 'react';

const PATIENT_ID_FIELD = 'patientID';
const MODALITY_FIELD = 'modality';
const LABEL_FIELD = 'label';

export async function downloadFeatureSet(token, tasks) {
  let allFeatures = [];

  for (let task of tasks) {
    let study = await Kheops.study(token, task.study_uid);

    let studyUID = task.study_uid;

    let patientID = `${
      study[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
        DicomFields.ALPHABETIC
      ]
    }_${studyUID}`;

    let features = getFeaturesFromTasks(patientID, [task]);

    allFeatures.push(features);
  }

  // Assemble CSV header & data
  let fields = assembleCSVHeader(allFeatures);
  let data = assembleCSVData(allFeatures);

  const parser = new Parser({
    fields: fields,
  });

  let parsedData = parser.parse(data);

  const fileContent = new Blob([parsedData], {
    type: 'text/csv',
  });

  const filename = `features.csv`;

  downloadContent(fileContent, filename);
}

function assembleCSVHeader(allFeatures) {
  let fields = [];
  for (let features of allFeatures) {
    Object.keys(features)
      .filter((key) => key !== PATIENT_ID_FIELD)
      // eslint-disable-next-line no-loop-func
      .forEach((modality) => {
        Object.keys(features[modality]).forEach((label) => {
          Object.keys(features[modality][label]).forEach((featureName) => {
            if (!fields.includes(featureName)) fields.push(featureName);
          });
        });
      });
  }
  fields = [PATIENT_ID_FIELD, MODALITY_FIELD, LABEL_FIELD, ...fields.sort()];

  return fields;
}

function assembleCSVData(allFeatures, fields) {
  let dataLines = [];

  for (let features of allFeatures) {
    let patientID = features[PATIENT_ID_FIELD];

    Object.keys(features)
      .filter((key) => key !== PATIENT_ID_FIELD)
      .forEach((modality) => {
        Object.keys(features[modality]).forEach((label) => {
          let dataLine = {};

          dataLine[PATIENT_ID_FIELD] = patientID;
          dataLine[MODALITY_FIELD] = modality;
          dataLine[LABEL_FIELD] = label;

          dataLine = { ...dataLine, ...features[modality][label] };

          dataLines.push(dataLine);
        });
      });
  }

  return dataLines;
}

export async function trainModel(
  extractionID,
  collection,
  labelCategoryID,
  studies,
  album,
  labels,
  dataSplittingType,
  trainTestSplitType,
  trainingPatients,
  testPatients,
  usedModalities,
  usedROIs,
  token
) {
  let response = await Backend.trainModel(
    token,
    extractionID,
    collection,
    labelCategoryID,
    studies,
    album,
    labels,
    dataSplittingType,
    trainTestSplitType,
    trainingPatients,
    testPatients,
    usedModalities,
    usedROIs
  );

  let trainingID = response['training-id'];
  let nSteps = response['n-steps'];

  return { trainingID, nSteps };
}

export function assembleFeatures(extraction, studies, album) {
  let features;

  if (!album) {
    let study = studies;

    let patientID = `${
      study[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
        DicomFields.ALPHABETIC
      ]
    }`;

    features = getFeaturesFromTasks(patientID, extraction.tasks);
  } else {
    features = [];

    for (let study of studies) {
      let studyUID = study[DicomFields.STUDY_UID][DicomFields.VALUE][0];

      let patientID = `${
        study[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
          DicomFields.ALPHABETIC
        ]
      }_${studyUID}`;

      let tasks = extraction.tasks.filter(
        (task) => task.study_uid === studyUID
      );

      let studyFeatures = getFeaturesFromTasks(patientID, tasks);

      features.push(studyFeatures);
    }
  }

  return features;
}

function getFeaturesFromTasks(patientID, tasks) {
  let leaveOutPrefix = 'diagnostics_';

  let filteredFeatures = { [PATIENT_ID_FIELD]: patientID };

  tasks.map((task) => {
    // Go through modalities
    Object.keys(task.payload).forEach((modality) => {
      if (!filteredFeatures[modality]) filteredFeatures[modality] = {};

      // Go through labelCategories
      Object.keys(task.payload[modality]).forEach((label) => {
        //if (!filteredFeatures[modality][label]) filteredFeatures[modality][label] = {};
        filteredFeatures[modality][label] = {
          ...filteredFeatures[modality][label],
          ...Object.fromEntries(
            Object.entries(task.payload[modality][label]).filter(
              ([key, val]) => !key.startsWith(leaveOutPrefix)
            )
          ),
        };
      });
    });

    // The return value is not really used in this case, we are just filling the features object
    return task;
  });

  return filteredFeatures;
}

function downloadContent(content, filename) {
  const windowUrl = window.webkitURL ? window.webkitURL : window.URL;
  const url = windowUrl.createObjectURL(content);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  // the filename you want
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  windowUrl.revokeObjectURL(url);
}

export function formatMetric(metric) {
  return (
    <>
      {_.isNumber(metric['mean'])
        ? formatMetricDisplay(metric['mean'])
        : metric['mean']}{' '}
      (
      {_.isNumber(metric['inf_value'])
        ? formatMetricDisplay(metric['inf_value'])
        : metric['inf_value']}{' '}
      -{' '}
      {_.isNumber(metric['sup_value'])
        ? formatMetricDisplay(metric['sup_value'])
        : metric['sup_value']}
      )
    </>
  );
}

export function formatMetricDisplay(value) {
  return clamp(value).toFixed(3);
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}
