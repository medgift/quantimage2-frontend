import { Parser } from 'json2csv';

export function downloadFeature(extraction) {
  const featuresContent = assembleFeatures(extraction.tasks);

  const parser = new Parser({ fields: Object.keys(featuresContent) });

  const fileContent = new Blob([parser.parse(featuresContent)], {
    type: 'text/csv'
  });

  const title = assembleFeatureTitles(extraction.families, '_').toLowerCase();

  downloadContent(fileContent, `features_${extraction.study_uid}_${title}.csv`);
}

export function assembleFeatureTitles(families, separator = ',') {
  const familyNames = [];

  families.map(family => {
    familyNames.push(family.feature_family.name);
  });

  return familyNames.join(separator);
}

export function assembleFeatures(tasks) {
  let features = {};

  let leaveOutPrefix = 'diagnostics_';

  tasks.map(task => {
    let filteredTask = Object.fromEntries(
      Object.entries(task.payload).filter(
        ([key, val]) => !key.startsWith(leaveOutPrefix)
      )
    );

    features = { ...features, ...filteredTask };
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
