import { Parser } from 'json2csv';

import DicomFields from '../dicom/fields';
import slugify from 'slugify';
import Backend from '../services/backend';
import Kheops from '../services/kheops';
import JSZip from 'jszip';

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
    fields: fields
  });

  let parsedData = parser.parse(data);

  const fileContent = new Blob([parsedData], {
    type: 'text/csv'
  });

  const title = assembleFeatureTitles([tasks[0]], '_').toLowerCase();

  const filename = `features_${title}.csv`;

  downloadContent(fileContent, filename);
}

function assembleCSVHeader(allFeatures) {
  let fields = [];
  for (let features of allFeatures) {
    Object.keys(features)
      .filter(key => key !== PATIENT_ID_FIELD)
      .map(modality => {
        Object.keys(features[modality]).map(label => {
          Object.keys(features[modality][label]).map(featureName => {
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

  let alwaysPresentFields = [PATIENT_ID_FIELD, MODALITY_FIELD, LABEL_FIELD];

  for (let features of allFeatures) {
    let patientID = features[PATIENT_ID_FIELD];

    Object.keys(features)
      .filter(key => key !== PATIENT_ID_FIELD)
      .map(modality => {
        Object.keys(features[modality]).map(label => {
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

export async function analyzeFeatures(extraction, studies, album, token) {
  const featuresContent = assembleFeatures(extraction, studies, album);

  const tabularizedObject = tabularizeFeatures(featuresContent);

  let analyzedFeatures = await Backend.analyze(
    token,
    tabularizedObject.features
  );

  console.log(analyzedFeatures);
}

export async function downloadFeature(extraction, studies, album) {
  const featuresContent = assembleFeatures(extraction, studies, album);

  const tabularizedObject = tabularizeFeatures(featuresContent);

  // Create file for each modality & label
  let files = assembleFeatureFiles(
    extraction,
    studies,
    album,
    tabularizedObject.features,
    tabularizedObject.header
  );

  let zipFile = new JSZip();

  Object.keys(files).map(filename => {
    zipFile.file(filename, files[filename]);
  });

  let zipTitle = album
    ? slugify(album.name, { replacement: '_', lower: true })
    : `${
        studies[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
          DicomFields.ALPHABETIC
        ]
      }_${studies[DicomFields.STUDY_UID][DicomFields.VALUE][0]}`;

  let zipFileName = `features_${zipTitle}.zip`;

  let zipFileContent = await zipFile.generateAsync({ type: 'blob' });

  downloadContent(zipFileContent, zipFileName);
}

export function tabularizeFeatures(featuresContent) {
  // Single study, transform to array
  if (!Array.isArray(featuresContent)) {
    featuresContent = [featuresContent];
  }

  let formattedFeaturesContent = {};
  let csvHeader;

  // Format the features content in order to parse it and transform to CSV
  for (let features of featuresContent) {
    Object.keys(features)
      .filter(key => key !== PATIENT_ID_FIELD)
      .map(modality => {
        Object.keys(features[modality]).map(label => {
          let featuresKey = `${modality}_${label}`;
          if (!formattedFeaturesContent[featuresKey])
            formattedFeaturesContent[featuresKey] = [];

          let featuresWithPatientID = {
            [PATIENT_ID_FIELD]: features[PATIENT_ID_FIELD],
            ...features[modality][label]
          };

          if (!csvHeader) csvHeader = Object.keys(featuresWithPatientID);

          formattedFeaturesContent[featuresKey].push(featuresWithPatientID);
        });
      });
  }

  return { features: formattedFeaturesContent, header: csvHeader };
}

export function assembleFeatureFiles(
  extraction,
  studies,
  album,
  tabularizedFeatures,
  csvHeader
) {
  let featureFiles = {};

  // Generate CSV files for the different modality/label combinations
  const parser = new Parser({
    fields: csvHeader
  });

  Object.keys(tabularizedFeatures).map(featuresKey => {
    const fileContent = new Blob(
      [parser.parse(tabularizedFeatures[featuresKey])],
      {
        type: 'text/csv'
      }
    );

    let title = assembleFeatureTitles(extraction.families, '_').toLowerCase();
    title = `${title}_${featuresKey}`;

    const filename = `features${
      album
        ? '_' + slugify(album.name, { replacement: '_', lower: true })
        : /*studies[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
                DicomFields.ALPHABETIC
              ]*/ ''
    }_${title}.csv`;

    featureFiles[filename] = fileContent;
  });

  return featureFiles;
}

export function assembleFeatureTitles(families, separator = ',') {
  return families
    .map(family => {
      return family.feature_family.name;
    })
    .join(separator);
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

      let tasks = extraction.tasks.filter(task => task.study_uid === studyUID);

      let studyFeatures = getFeaturesFromTasks(patientID, tasks);

      features.push(studyFeatures);
    }
  }

  return features;
}

function getFeaturesFromTasks(patientID, tasks) {
  let leaveOutPrefix = 'diagnostics_';

  let filteredFeatures = { [PATIENT_ID_FIELD]: patientID };

  tasks.map(task => {
    // Go through modalities
    Object.keys(task.payload).map(modality => {
      if (!filteredFeatures[modality]) filteredFeatures[modality] = {};

      // Go through labels
      Object.keys(task.payload[modality]).map(label => {
        //if (!filteredFeatures[modality][label]) filteredFeatures[modality][label] = {};
        filteredFeatures[modality][label] = {
          ...filteredFeatures[modality][label],
          ...Object.fromEntries(
            Object.entries(task.payload[modality][label]).filter(
              ([key, val]) => !key.startsWith(leaveOutPrefix)
            )
          )
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
