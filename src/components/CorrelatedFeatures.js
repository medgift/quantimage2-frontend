import React, { useCallback, useMemo } from 'react';
import { useEffect, useState } from 'react';
import * as ss from 'simple-statistics';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UncontrolledTooltip } from 'reactstrap';

export default function CorrelatedFeatures({
  charts,
  loading,
  featureIDs,
  leafItems,
  selected,
  setSelected,
  dropCorrelatedFeatures,
  setDropCorrelatedFeatures,
}) {
  const [corrThreshold, setCorrThreshold] = useState(0.5);

  const [selectedBeforeDropping, setSelectedBeforeDropping] = useState([]);
  const [
    featuresValuesBeforeDropping,
    setFeatureValuesBeforeDropping,
  ] = useState([]);

  useEffect(() => {
    //if (selectedBeforeDropping.length === 0 && selected.length > 0)
    //  setSelectedBeforeDropping(selected);
    if (!dropCorrelatedFeatures) setSelectedBeforeDropping(selected);
  }, [selected, dropCorrelatedFeatures]);

  useEffect(() => {
    if (
      featuresValuesBeforeDropping.length === 0 &&
      charts &&
      charts[0] &&
      charts[0].chart &&
      charts[0].chart.data.features &&
      charts[0].chart.data.features.length > 0
    ) {
      let features = getFeatures();
      setFeatureValuesBeforeDropping(features);
    }
  }, [charts]);

  const getFeatures = () => {
    /*if (
      !charts ||
      !charts[0] ||
      !charts[0].chart ||
      !charts[0].chart.data.features
    )
      return [];*/

    // Get list of feature values for each feature name
    const features = charts[0].chart.data.features.reduce((acc, curr) => {
      if (!acc[curr.feature_name]) acc[curr.feature_name] = [];

      acc[curr.feature_name].push(curr.feature_value);

      return acc;
    }, {});

    return features;
  };

  const getNodeIDsToDrop = (features) => {
    let start;
    let end;

    // We need at least 2 samples!!!
    if (
      Object.keys(features).length > 0 &&
      features[Object.keys(features)[0]].length < 2
    ) {
      return [];
    }

    // Build correlation matrix
    start = Date.now();
    let corrMatrix = [];
    for (let i = 0; i < Object.keys(features).length; i++) {
      let corrArray = [];
      for (let j = 0; j < Object.keys(features).length; j++) {
        let featuresI = [...features[Object.keys(features)[i]]];
        let featuresJ = [...features[Object.keys(features)[j]]];

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
    console.log('building the correlation matrix took', end - start);

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

    // Get feature IDs to drop based on the leaf items

    // Make a map of feature ID -> node ID
    let featureIDToNodeID = Object.entries(leafItems).reduce(
      (acc, [key, value]) => {
        acc[value] = key;
        return acc;
      },
      {}
    );

    let featureIDsToDrop = Object.keys(featureIDToNodeID).filter((fID) => {
      for (let featureToDrop of featuresToDrop) {
        if (fID.endsWith(featureToDrop)) return true;
      }
      return false;
    });

    let nodeIDsToDeselect = featureIDsToDrop.map(
      (fID) => featureIDToNodeID[fID]
    );

    console.log(nodeIDsToDeselect);

    // Filter node IDs by these feature names
    return nodeIDsToDeselect;
  };

  const dropFeatures = (drop) => {
    if (drop) {
      let features = getFeatures();
      let nodeIDsToDrop = getNodeIDsToDrop(features);
      deselectFeatures(nodeIDsToDrop);
    } else {
      setSelected(selectedBeforeDropping);
      setSelectedBeforeDropping();
    }
  };

  const adjustThreshold = () => {
    let nodeIDsToDrop = getNodeIDsToDrop(featuresValuesBeforeDropping);
    deselectFeatures(nodeIDsToDrop);
  };

  const deselectFeatures = (nodesToDeselect) => {
    setSelected(
      selectedBeforeDropping.filter((s) => !nodesToDeselect.includes(s))
    );
  };

  /*const featuresToDrop = useMemo(() => {
    if (
      !loading &&
      featureIDs.length > 0 &&
      charts.length > 0 &&
      charts[0].chart &&
      charts[0].chart.data.features.length > 0
    ) {
      let originalFeatureIDs = disableFeatures(featuresToDrop);
      setFeatureIDsBeforeDropping(originalFeatureIDs);
    } else {
      if (featuresIDsBeforeDropping.length > 0)
        setFeatureIDs(featuresIDsBeforeDropping);
    }
  }, []);*/

  // React to "drop correlated features" change
  /*useEffect(() => {
    if (
      !loading &&
      featureIDs.length > 0 &&
      charts.length > 0 &&
      charts[0].chart &&
      charts[0].chart.data.features.length > 0
    ) {
      if (!dropCorrelatedFeatures && featuresIDsBeforeDropping.length > 0) {
        if (featuresIDsBeforeDropping.length > 0)
          setFeatureIDs(featuresIDsBeforeDropping);
      }
    }
  }, [
    dropCorrelatedFeatures,
    corrThreshold,
    charts,
    loading,
    featureIDs,
    setFeatureIDs,
  ]);*/

  return (
    <div className="tools">
      <p className="mt-4">
        <strong>Feature selection</strong>
      </p>
      <div>
        <input
          id="drop-corr"
          type="checkbox"
          value={dropCorrelatedFeatures}
          onChange={(e) => {
            setDropCorrelatedFeatures(e.target.checked);
            dropFeatures(e.target.checked);
          }}
        />{' '}
        <label htmlFor="drop-corr">
          Drop correlated features{' '}
          <FontAwesomeIcon icon="info-circle" id="corr-explanation" />
          <UncontrolledTooltip placement="right" target="corr-explanation">
            Allows to deselect highly correlated features (with redundant
            information).
          </UncontrolledTooltip>
        </label>
      </div>
      <div>
        <label htmlFor="corr-threshold">
          Correlation Threshold{' '}
          <FontAwesomeIcon icon="info-circle" id="thresh-explanation" />
          <UncontrolledTooltip placement="right" target="thresh-explanation">
            With a lower threshold, fewer features will be kept.
            <br />
            With a higher threshold, more features will be kept.
          </UncontrolledTooltip>
        </label>
        <br />
        <input
          id="corr-threshold"
          type="range"
          min={0.1}
          max={0.9}
          step={0.1}
          disabled={!dropCorrelatedFeatures}
          onChange={(e) => {
            setCorrThreshold(+e.target.value);
          }}
          onMouseUp={(e) => {
            if (dropCorrelatedFeatures) adjustThreshold();
          }}
          value={corrThreshold}
          className="slider"
        />
        <span>{corrThreshold}</span>
      </div>
    </div>
  );
}

function fillArray(value, arr, targetLength) {
  while (arr.length !== targetLength) {
    arr.push(value);
  }
  return arr;
}
