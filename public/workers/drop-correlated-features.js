self.importScripts('simple-statistics.min.js');

self.onmessage = function (event) {
  // The object that the web page sent is stored in the event.data property.
  let features = event.data.features;
  let corrThreshold = event.data.corrThreshold;

  // Calculate features to drop based on the correlation threshold
  let featuresToDrop = getFeaturesToDrop(features, corrThreshold);

  // Now the search is finished. Send back the results.
  postMessage(featuresToDrop);
};

postMessage('test');

function getFeaturesToDrop(features, corrThreshold) {
  let start;
  let end;

  // Build correlation matrix
  start = Date.now();
  let corrMatrix = [];

  let featureNames = Object.keys(features);

  for (let i = 0; i < featureNames.length; i++) {
    let corrArray = [];
    for (let j = 0; j < featureNames.length; j++) {
      let featuresI = [...features[featureNames[i]]];
      let featuresJ = [...features[featureNames[j]]];

      // Check if the array needs to be padded (e.g. PET features don't exist for CT)
      // TODO - Correlations with NaNs don't work so great perhaps...
      if (featuresI.length > featuresJ.length) {
        fillArray(NaN, featuresJ, featuresI.length);
      } else if (featuresJ.length > featuresI.length) {
        fillArray(NaN, featuresI, featuresJ.length);
      }

      corrArray.push(
        Math.abs(+ss.sampleCorrelation(featuresI, featuresJ).toFixed(4))
      );
    }

    corrMatrix.push(corrArray);
  }
  end = Date.now();
  console.log(`Building the correlation matrix took ${end - start}ms`);

  let featuresIndexDropList = [];

  // Select features to drop
  for (let i = 0; i < corrMatrix.length; i++) {
    for (let j = i + 1; j < corrMatrix[i].length; j++) {
      if (
        corrMatrix[i][j] >= corrThreshold &&
        !featuresIndexDropList.includes(i) &&
        !featuresIndexDropList.includes(j)
      ) {
        if (corrMatrix[i] >= corrMatrix[j]) {
          featuresIndexDropList.push(i);
        } else {
          featuresIndexDropList.push(j);
        }
      }
    }
  }

  let featuresToDrop = featuresIndexDropList.map(
    (i) => Object.keys(features)[i]
  );

  return featuresToDrop;
}

function fillArray(value, arr, targetLength) {
  while (arr.length !== targetLength) {
    arr.push(value);
  }
  return arr;
}
