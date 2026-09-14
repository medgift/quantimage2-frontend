import { Alert, Button, UncontrolledTooltip } from 'reactstrap';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import UndoButton from './UndoButton';
import FDRChart from './FDRChart';
import FDRFeaturesListModal from './FDRFeaturesListModal';
import FDRSurvivalWarning from './FDRSurvivalWarning';

export const DEFAULT_MAX_FEATURES_TO_KEEP = 50;
export const DEFAULT_FEATURES_TO_KEEP = 10;

export default function FeatureSelection({
  modelType,
  selected,
  leafItems,
  setNFeatures,
  dropCorrelatedFeatures,
  selectFeaturesWithFDR,
  isFdrFinished,
  fdrError,
  showAdvancedFdr,
  handleShowAdvancedFdr,
  selectedFdrThreshold,
  FDR_THRESHOLDS_LIST,
  fdrIndex,
  fdrResults,
  handleFdrIndexChange,
  selectedFdrData,
  corrThreshold,
  setCorrThreshold,
  isRecomputingChart,
  handleUndo,
  selectedFeaturesHistory,
}) {
  // Adjust N features when dropped features change
  useEffect(() => {
    if (!selected) return;

    const nbSelectedFeatures = selected
      .filter((s) => leafItems[s])
      .map((f) => leafItems[f]).length;

    setNFeatures((n) => {
      if (n > nbSelectedFeatures) return nbSelectedFeatures;
      else return Math.min(nbSelectedFeatures, DEFAULT_FEATURES_TO_KEEP);
    });
  }, [setNFeatures, leafItems, selected]);

  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const toggleFeaturesModal = () => setShowFeaturesModal((open) => !open);

  return (
    <div style={{ flex: 1 }}>
      <div>
        <strong>Feature Selection</strong>
      </div>
      {selectedFeaturesHistory.length > 1 && (
        <UndoButton handleClick={handleUndo} />
      )}
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
        <div style={{ flex: 1 }}>
          <div className="tools">
            <p className="mt-4">
              <strong>
                FDR correction{' '}
                <FontAwesomeIcon icon="info-circle" id="fdr-explanation" />
                <UncontrolledTooltip placement="right" target="fdr-explanation">
                  Allows to select fewer and significant features while limiting
                  false discoveries to 5% by default
                </UncontrolledTooltip>
              </strong>
            </p>
            <FDRSurvivalWarning
              modelType={modelType}
              selected={selected}
              leafItems={leafItems}
            />
            <div>
              <Button
                color="primary"
                onClick={selectFeaturesWithFDR}
                disabled={isRecomputingChart || !modelType}
              >
                {isRecomputingChart && (
                  <>
                    <FontAwesomeIcon icon="sync" spin />{' '}
                  </>
                )}
                Select features with FDR{' '}
              </Button>
              {!modelType && (
                <small className="text-muted d-block mt-1">
                  Select an outcome first
                </small>
              )}
            </div>
            {fdrError && (
              <Alert
                color="danger"
                className="mt-2 mb-0"
                style={{ whiteSpace: 'normal' }}
              >
                FDR selection failed: {fdrError}
              </Alert>
            )}
            {isFdrFinished && (
              <div>
                <input
                  id="show-advanced-fdr"
                  type="checkbox"
                  checked={showAdvancedFdr}
                  onChange={(e) => {
                    handleShowAdvancedFdr(e.target.checked);
                  }}
                />{' '}
                <label htmlFor="show-advanced-fdr">
                  Show advanced results{' '}
                  <FontAwesomeIcon
                    icon="info-circle"
                    id="advanced-fdr-explanation"
                  />
                  <UncontrolledTooltip
                    placement="right"
                    target="advanced-fdr-explanation"
                  >
                    Allows you to explore the number of features retrieved
                    depending on the q-value selected with the slider and the
                    vertical line on the graph. Reminder that the higher the
                    q-value, the higher will be the number of false positives.
                  </UncontrolledTooltip>
                </label>
                {showAdvancedFdr && fdrResults && (
                  <div>
                    <label htmlFor="qvalues">
                      Qvalue selected: {selectedFdrThreshold}
                    </label>
                    <input
                      id="qvalues"
                      type="range"
                      min={0}
                      max={FDR_THRESHOLDS_LIST.length - 1}
                      step={1}
                      value={fdrIndex}
                      onChange={(e) =>
                        handleFdrIndexChange(Number(e.target.value))
                      }
                    />
                    <FDRChart
                      fdrResults={fdrResults}
                      fdrIndex={fdrIndex}
                      FDR_THRESHOLDS_LIST={FDR_THRESHOLDS_LIST}
                    />
                    <Button color="primary" onClick={toggleFeaturesModal}>
                      Show Features and Qvalues
                    </Button>
                    <FDRFeaturesListModal
                      isOpen={showFeaturesModal}
                      toggle={toggleFeaturesModal}
                      selectedFdrData={selectedFdrData}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
