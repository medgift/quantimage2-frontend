self.importScripts('spearson.js');

self.onmessage = function (event) {
  // The object that the web page sent is stored in the event.data property.
  // Calculate features to drop based on the correlation threshold & n features to keep
  let featuresToDrop = getFeaturesToDrop(...Object.values(event.data));

  // Now the search is finished. Send back the results.
  postMessage(featuresToDrop);
};

//self.correlationMatrix = null;

function getFeaturesToDrop(features, leafItems, selected, corrThreshold) {
  let selectedFeatureIDs = new Set(
    selected.filter((s) => leafItems[s]).map((f) => leafItems[f])
  );

  // Get feature names & selected feature IDs
  let featureNames = features
    .filter((f) => selectedFeatureIDs.has(f.FeatureID))
    .map((f) => f.FeatureID);

  console.log('Filtering features', featureNames.length);

  /*if (
    self.featureNames &&
    self.correlationMatrix &&
    self.featureNames.length === featureNames.length &&
    self.featureNames.every((value, index) => value === featureNames[index])
  ) {
    // Skip to the threshold
    console.log('Ok, already have the correlations!');
  } else {*/
  const featuresFormattedForCorrelation = features
    .filter((f) => selectedFeatureIDs.has(f.FeatureID))
    .reduce((acc, curr) => {
      const { FeatureID, Ranking, ...patients } = curr;
      acc[FeatureID] = Object.values(patients).map((v) => +v);
      return acc;
    }, {});

  // Build correlation matrix
  //self.featureNames = Object.keys(featuresFormattedForCorrelation);
  let corrMatrix = buildCorrelationMatrix(
    featuresFormattedForCorrelation,
    featureNames
  );
  //self.correlationMatrix = corrMatrix;
  //}

  let featuresToDrop = applyThreshold(corrMatrix, +corrThreshold, featureNames);

  return featuresToDrop;
}

function buildCorrelationMatrix(features, featureNames) {
  let start = Date.now();

  let corrMatrix = [];

  for (let i = 0; i < featureNames.length; i++) {
    let corrArray = [];
    for (let j = 0; j <= i; j++) {
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
        Math.abs(
          +spearson.correlation.spearman(featuresI, featuresJ).toFixed(4)
        )
      );
    }

    corrMatrix.push(corrArray);
  }
  let end = Date.now();
  console.log(`Building the correlation matrix took ${end - start}ms`);

  return corrMatrix;
}

function applyThreshold(corrMatrix, corrThreshold, featureNames) {
  let featuresIndexDropList = [];

  // Select features to drop
  for (let i = 0; i < corrMatrix.length; i++) {
    for (let j = 0; j < corrMatrix[i].length; j++) {
      if (
        i !== j &&
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

  let featuresToDrop = featuresIndexDropList.map((i) => featureNames[i]);

  return featuresToDrop;
}

function fillArray(value, arr, targetLength) {
  while (arr.length !== targetLength) {
    arr.push(value);
  }
  return arr;
}
