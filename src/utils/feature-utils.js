import { Parser } from 'json2csv';

import DicomFields from '../dicom/fields';
import slugify from 'slugify';
import Kheops from '../services/kheops';

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

export function downloadFeature(extraction, studies, album) {
  const featuresContent = assembleFeatures(extraction, studies, album);

  const parser = new Parser({
    fields: Object.keys(
      Array.isArray(featuresContent) ? featuresContent[0] : featuresContent
    )
  });

  const fileContent = new Blob([parser.parse(featuresContent)], {
    type: 'text/csv'
  });

  const title = assembleFeatureTitles(extraction.families, '_').toLowerCase();

  const filename = `features_${
    album
      ? slugify(album.name, { replacement: '_', lower: true })
      : studies[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
          DicomFields.ALPHABETIC
        ]
  }_${title}.csv`;

  downloadContent(fileContent, filename);
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

  let features = { patientID: patientID };

  tasks.map(task => {
    let filteredTask = Object.fromEntries(
      Object.entries(task.payload).filter(
        ([key, val]) => !key.startsWith(leaveOutPrefix)
      )
    );

    features = { ...features, ...filteredTask };

    return task;
  });

  return features;
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
