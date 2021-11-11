import React, { useCallback } from 'react';
import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UncontrolledTooltip } from 'reactstrap';

// Instantiate web worker
let correlatedFeaturesWorker;
if (window.Worker) {
  correlatedFeaturesWorker = new Worker('/workers/drop-correlated-features.js');
}

export default function CorrelatedFeatures({
  featuresChart,
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

  const getFeatures = useCallback(() => {
    // Get list of feature values for each feature name
    const features = featuresChart.reduce((acc, curr) => {
      if (!acc[curr.feature_name]) acc[curr.feature_name] = [];

      acc[curr.feature_name].push(curr.feature_value);

      return acc;
    }, {});

    return features;
  }, [featuresChart]);

  useEffect(() => {
    //if (selectedBeforeDropping.length === 0 && selected.length > 0)
    //  setSelectedBeforeDropping(selected);
    if (!dropCorrelatedFeatures) setSelectedBeforeDropping(selected);
  }, [selected, dropCorrelatedFeatures]);

  useEffect(() => {
    if (
      featuresValuesBeforeDropping.length === 0 &&
      featuresChart &&
      featuresChart.length > 0
    ) {
      let features = getFeatures();
      setFeatureValuesBeforeDropping(features);
    }
  }, [featuresChart, featuresValuesBeforeDropping.length, getFeatures]);

  const dropFeatures = (drop) => {
    if (drop) {
      let features = getFeatures();
      correlatedFeaturesWorker.postMessage({
        features: features,
        corrThreshold: corrThreshold,
      });
    } else {
      setSelected(selectedBeforeDropping);
      setSelectedBeforeDropping();
    }
  };

  const adjustThreshold = () => {
    correlatedFeaturesWorker.postMessage({
      features: featuresValuesBeforeDropping,
      corrThreshold: corrThreshold,
    });
  };

  const deselectFeatures = useCallback(
    (nodesToDeselect) => {
      setSelected(
        selectedBeforeDropping.filter((s) => !nodesToDeselect.includes(s))
      );
    },
    [selectedBeforeDropping]
  );

  // Bind web worker
  useEffect(() => {
    correlatedFeaturesWorker.onmessage = (m) => {
      console.log('MESSAGE FROM THE WORKER', m.data);

      // Features to drop are returned by the worker
      let featuresToDrop = m.data;

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

      deselectFeatures(nodeIDsToDeselect);
    };
  }, [correlatedFeaturesWorker, leafItems, deselectFeatures]);

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
