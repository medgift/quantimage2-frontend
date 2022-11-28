import { UncontrolledTooltip } from 'reactstrap';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MODEL_TYPES } from '../config/constants';

export const DEFAULT_MAX_FEATURES_TO_KEEP = 50;
export const DEFAULT_FEATURES_TO_KEEP = 10;

export default function FeatureSelection({
  modelType,
  dropCorrelatedFeatures,
  setDropCorrelatedFeatures,
  rankFeatures,
  setRankFeatures,
  keepNFeatures,
  setKeepNFeatures,
  maxNFeatures,
  leafItems,
  selectedBeforeFiltering,
  filterFeatures,
  nFeatures,
  setNFeatures,
  corrThreshold,
  setCorrThreshold,
  droppedFeatureIDsCorrelation,
  unlabelledDataPoints,
}) {
  // Define default n° of features to keep
  useEffect(() => {
    if (selectedBeforeFiltering) {
      console.log(
        'min features to keep',
        Math.min(maxNFeatures, selectedBeforeFiltering.length - 1)
      );

      setNFeatures((n) =>
        Math.min(n, maxNFeatures, selectedBeforeFiltering.length - 1)
      );
    }
  }, [maxNFeatures, setNFeatures, selectedBeforeFiltering]);

  // Adjust N features when dropped features change
  useEffect(() => {
    if (!selectedBeforeFiltering) return;

    const nbSelectedFeatures = selectedBeforeFiltering
      .filter((s) => leafItems[s])
      .map((f) => leafItems[f]).length;

    const remainingFeatures =
      nbSelectedFeatures - droppedFeatureIDsCorrelation.length;

    setNFeatures((n) => {
      if (droppedFeatureIDsCorrelation.length > 0 && n > remainingFeatures)
        return remainingFeatures;
      else return n;
    });
  }, [
    setNFeatures,
    leafItems,
    droppedFeatureIDsCorrelation,
    selectedBeforeFiltering,
  ]);

  // Adjust correlation threshold
  const adjustThreshold = (e) => {
    filterFeatures(
      dropCorrelatedFeatures,
      keepNFeatures,
      +e.target.value,
      nFeatures
    );
  };

  // Adjust number of features to keep
  const adjustNFeatures = (e) => {
    filterFeatures(
      dropCorrelatedFeatures,
      keepNFeatures,
      corrThreshold,
      +e.target.value
    );
  };

  return (
    <div style={{ flex: 1 }}>
      <div>
        <strong>Feature Selection</strong>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <div className="tools">
            <p className="mt-4">
              <strong>Correlation</strong>
            </p>
            <div>
              <input
                id="drop-corr"
                type="checkbox"
                value={dropCorrelatedFeatures}
                onChange={(e) => {
                  setDropCorrelatedFeatures(e.target.checked);
                  filterFeatures(
                    e.target.checked,
                    keepNFeatures,
                    corrThreshold,
                    nFeatures
                  );
                }}
              />{' '}
              <label htmlFor="drop-corr">
                Drop correlated features{' '}
                <FontAwesomeIcon icon="info-circle" id="corr-explanation" />
                <UncontrolledTooltip
                  placement="right"
                  target="corr-explanation"
                >
                  Allows to deselect highly correlated features (with redundant
                  information).
                </UncontrolledTooltip>
              </label>
            </div>
            {dropCorrelatedFeatures && (
              <div>
                <label htmlFor="corr-threshold">
                  Correlation Threshold{' '}
                  <FontAwesomeIcon icon="info-circle" id="thresh-explanation" />
                  <UncontrolledTooltip
                    placement="right"
                    target="thresh-explanation"
                  >
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
                  value={corrThreshold}
                  disabled={!dropCorrelatedFeatures}
                  onChange={(e) => setCorrThreshold(e.target.value)}
                  onMouseUp={adjustThreshold}
                  onKeyUp={adjustThreshold}
                  className="slider"
                />
                <span>{corrThreshold}</span>
              </div>
            )}
          </div>
        </div>
        {modelType && unlabelledDataPoints === 0 && (
          <div style={{ flex: 1 }}>
            <div className="tools">
              <p className="mt-4">
                <strong>Feature ranking</strong>
              </p>
              <div>
                <input
                  id="rank-feats"
                  type="checkbox"
                  checked={rankFeatures}
                  onChange={(e) => {
                    setRankFeatures(e.target.checked);
                  }}
                />{' '}
                <label htmlFor="rank-feats">
                  Rank by F-value{' '}
                  <FontAwesomeIcon
                    icon="info-circle"
                    id="ranking-explanation"
                  />
                  <UncontrolledTooltip
                    placement="right"
                    target="ranking-explanation"
                  >
                    Sort the features (lines of the chart) so that more
                    predictive features (when taken individually) will appear at
                    the top and less predictive features will appear at the
                    bottom.
                    {modelType === MODEL_TYPES.SURVIVAL &&
                      'With Survival models, the features are ranked by the Event column.'}
                  </UncontrolledTooltip>
                </label>
                {rankFeatures && (
                  <div>
                    <input
                      id="keep-n-feats"
                      type="checkbox"
                      checked={keepNFeatures}
                      onChange={(e) => {
                        setKeepNFeatures(e.target.checked);
                        filterFeatures(
                          dropCorrelatedFeatures,
                          e.target.checked,
                          corrThreshold,
                          nFeatures
                        );
                      }}
                      disabled={!rankFeatures}
                    />{' '}
                    <label htmlFor="keep-n-feats">
                      Keep N Best-Ranked Features
                    </label>
                    <br />
                    <input
                      id="n-feats-to-keep"
                      type="range"
                      min={1}
                      max={Math.min(
                        droppedFeatureIDsCorrelation.length > 0
                          ? selectedBeforeFiltering
                              .filter((s) => leafItems[s])
                              .map((f) => leafItems[f]).length -
                              droppedFeatureIDsCorrelation.length
                          : selectedBeforeFiltering
                              .filter((s) => leafItems[s])
                              .map((f) => leafItems[f]).length,
                        maxNFeatures
                      )}
                      step={1}
                      disabled={!keepNFeatures}
                      onChange={(e) => {
                        setNFeatures(+e.target.value);
                      }}
                      onMouseUp={adjustNFeatures}
                      onKeyUp={adjustNFeatures}
                      value={nFeatures}
                      className="slider"
                    />
                    <span>{nFeatures}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
