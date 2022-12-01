import { Button, UncontrolledTooltip } from 'reactstrap';
import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MODEL_TYPES } from '../config/constants';

export const DEFAULT_MAX_FEATURES_TO_KEEP = 50;
export const DEFAULT_FEATURES_TO_KEEP = 10;

export default function FeatureSelection({
  modelType,
  rankFeatures,
  setRankFeatures,
  maxNFeatures,
  selected,
  leafItems,
  nFeatures,
  setNFeatures,
  keepNFeatures,
  dropCorrelatedFeatures,
  corrThreshold,
  setCorrThreshold,
  unlabelledPatients,
  isRecomputingChart,
}) {
  // Adjust N features when dropped features change
  useEffect(() => {
    if (!selected) return;

    const nbSelectedFeatures = selected
      .filter((s) => leafItems[s])
      .map((f) => leafItems[f]).length;

    setNFeatures((n) => {
      if (n > nbSelectedFeatures) return nbSelectedFeatures;
      else return n;
    });
  }, [setNFeatures, leafItems, selected]);

  return (
    <div style={{ flex: 1 }}>
      <div>
        <strong>Feature Selection</strong>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <div className="tools">
            <p className="mt-4">
              <strong>
                Correlation{' '}
                <FontAwesomeIcon icon="info-circle" id="corr-explanation" />
                <UncontrolledTooltip
                  placement="right"
                  target="corr-explanation"
                >
                  Allows to deselect highly correlated features (with redundant
                  information).
                </UncontrolledTooltip>
              </strong>
            </p>
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
                onChange={(e) => setCorrThreshold(e.target.value)}
                className="slider"
              />
              <span>{corrThreshold}</span>
              <div>
                <Button
                  color="primary"
                  onClick={() => {
                    console.log('Drop now', corrThreshold);
                    dropCorrelatedFeatures();
                  }}
                  disabled={isRecomputingChart}
                >
                  {isRecomputingChart && (
                    <>
                      <FontAwesomeIcon icon="sync" spin />{' '}
                    </>
                  )}
                  Drop correlated features{' '}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {modelType && (
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
                    <label htmlFor="keep-n-feats">
                      Number of features to keep
                    </label>
                    <br />
                    <input
                      id="n-feats-to-keep"
                      type="range"
                      min={1}
                      max={Math.min(
                        selected
                          .filter((s) => leafItems[s])
                          .map((f) => leafItems[f]).length,
                        maxNFeatures
                      )}
                      onChange={(e) => setNFeatures(+e.target.value)}
                      step={1}
                      value={nFeatures}
                      className="slider"
                    />
                    <span>{nFeatures}</span>
                    <div>
                      <Button
                        color="primary"
                        onClick={keepNFeatures}
                        disabled={isRecomputingChart}
                      >
                        Keep {nFeatures} Best-Ranked Features
                      </Button>
                    </div>
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
