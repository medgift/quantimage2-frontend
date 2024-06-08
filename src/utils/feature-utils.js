import { Parser } from 'json2csv';
import * as Papa from 'papaparse';

import DicomFields from '../dicom/fields';
import Backend from '../services/backend';
import Kheops from '../services/kheops';
import _ from 'lodash';
import React from 'react';
import * as detectNewline from 'detect-newline';
import * as csvString from 'csv-string';
import { parse } from 'csv-parse/lib/sync';

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

export function validateFileType(file) {
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

export async function validateLabelFile(file, dataPoints, headerFieldNames, dropNonMatchingOutomcesCheckBox) {
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
  let totalCount = 0;
  let labels = {};

  try {
    /* Add PatientID to the header field names (should always exist) */
    let fullHeaderFieldNames = ['PatientID', ...headerFieldNames];
    console.log('full header field names', fullHeaderFieldNames);

    let lineEnding = detectNewline(content);

    let firstLine = content.split(lineEnding)[0];

    let separator = csvString.detect(firstLine);

    let headerFields = firstLine.split(separator);

    if (headerFields[0] !== 'PatientID') {
      error = `Expected the first column to be PatientID - got ${headerFields[0]}`;
      return [false, error];
    }

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

    if (!dropNonMatchingOutomcesCheckBox){
      for (let record of records) {
        const { PatientID, ...recordContent } = record;
        labels[PatientID] = recordContent;
        totalCount++;
      }
      
      return [
        true,
        `The CSV had ${totalCount} patients.`,
        labels,
      ];
      
    }

    for (let patientID of dataPoints) {
      let matchingRecord = records.find(
        (record) => record.PatientID === patientID
      );
      if (matchingRecord) {
        nbMatches++;
 
        // Fill labelCategories
        const { PatientID, ...recordContent } = matchingRecord;
        labels[PatientID] = recordContent;
      }
    }

    if (nbMatches === 0) {
      error = `The CSV file matched none of the patients!`;
      return [valid, error, {}];
    }
  } catch (e) {
    console.error(e);
    error = 'The CSV file could not be parsed, check its format!';
    return [valid, error, {}];
  }

  valid = true;

  return [
    valid,
    `The CSV matched ${nbMatches}/${dataPoints.length} patients.`,
    labels,
  ];
}

const papaparse_config = {
  header: true,
  skipEmptyLines: true,
};

export async function validateClinicalFeaturesFile(file, dataPoints) {
  /* Validate file type */
  let fileTypeIsValid = validateFileType(file);

  let valid = false;
  let error = null;

  if (!fileTypeIsValid) {
    error = 'The file is not a CSV file!';
    return [valid, error];
  }

  let fileContent = await file.text();
  let csvData = Papa.parse(fileContent, papaparse_config);

  let nbMatches = 0;
  let labels = {};

  try {
    for (let patientID of dataPoints) {
      let matchingRecord = csvData.data.find(
        (record) => record.PatientID === patientID
      );

      if (matchingRecord) {
        nbMatches++;

        // Fill labelCategories
        const { PatientID, ...recordContent } = matchingRecord;
        labels[PatientID] = recordContent;
      }
    }
  } catch (e) {
    console.error(e);
    error = 'The CSV file could not be parsed, check its format!';
    return [valid, error, {}];
  }

  valid = true;

  return [
    valid,
    `The CSV matched ${nbMatches}/${dataPoints.length} patients.`,
    labels,
  ];
}

export async function parseClinicalFeatureNames(file) {
  let fileContent = await file.text();
  let data = Papa.parse(fileContent, papaparse_config);
  return data.meta.fields;
}

// This is a custom filter UI for selecting
// a unique option from a list
export function SelectColumnFilter({
  column: { filterValue, setFilter, preFilteredRows, id },
}) {
  // Calculate the options for filtering
  // using the preFilteredRows
  const options = React.useMemo(() => {
    const options = new Set();
    preFilteredRows.forEach((row) => {
      options.add(row.values[id]);
    });
    return [...options.values()];
  }, [id, preFilteredRows]);

  // Render a multi-select box
  return (
    <select
      value={filterValue}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
    >
      <option value="">All</option>
      {options.map((option, i) => (
        <option key={i} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
