import { Parser } from 'json2csv';

import DicomFields from '../dicom/fields';
import slugify from 'slugify';
import Kheops from '../services/kheops';
import JSZip from 'jszip';

const PATIENT_ID_FIELD = 'patientID';

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

  const parser = new Parser({
    fields: Object.keys(
      Array.isArray(allFeatures) ? allFeatures[0] : allFeatures
    )
  });

  const fileContent = new Blob([parser.parse(allFeatures)], {
    type: 'text/csv'
  });

  const title = assembleFeatureTitles([tasks[0]], '_').toLowerCase();

  const filename = `features_${title}.csv`;

  downloadContent(fileContent, filename);
}

export async function downloadFeature(extraction, studies, album) {
  const featuresContent = assembleFeatures(extraction, studies, album);

  // Create file for each modality & label
  let files = assembleFeatureFiles(extraction, studies, album, featuresContent);

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

export function assembleFeatureFiles(
  extraction,
  studies,
  album,
  featuresContent
) {
  let featureFiles = {};

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

  // Generate CSV files for the different modality/label combinations
  const parser = new Parser({
    fields: csvHeader
  });

  Object.keys(formattedFeaturesContent).map(featuresKey => {
    const fileContent = new Blob(
      [parser.parse(formattedFeaturesContent[featuresKey])],
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
