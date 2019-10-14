import { Parser } from 'json2csv';

export default function downloadFeature(feature) {
  // Filter out diagnostics fields, keep only original features
  const featuresContent = {};
  for (let key in feature.payload) {
    if (!key.startsWith('diagnostics')) {
      featuresContent[key] = feature.payload[key];
    }
  }

  const parser = new Parser({ fields: Object.keys(featuresContent) });

  const fileContent = new Blob([parser.parse(featuresContent)], {
    type: 'text/csv'
  });

  downloadContent(
    fileContent,
    `features_${feature.study_uid}_${feature.name}.csv`
  );
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
