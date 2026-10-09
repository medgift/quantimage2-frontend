import React from 'react';
import { Alert } from 'reactstrap';
import { MODEL_TYPES } from '../config/constants';

// Survival FDR fits one Cox model per feature. On a dev machine each fit took
// roughly 0.2-0.35 ms per patient (20-80 ms with 100-300 patients), so below
// this many features the wait is a few seconds and a warning would be noise.
export const SURVIVAL_FDR_WARNING_MIN_FEATURES = 100;

export default function FDRSurvivalWarning({ modelType, selected, leafItems }) {
  if (modelType !== MODEL_TYPES.SURVIVAL || !selected) return null;

  const selectedFeatureCount = selected.filter((s) => leafItems[s]).length;
  if (selectedFeatureCount < SURVIVAL_FDR_WARNING_MIN_FEATURES) return null;

  return (
    <Alert color="warning" className="mb-3" style={{ whiteSpace: 'normal' }}>
      With a survival outcome, FDR fits a Cox model for each of the{' '}
      {selectedFeatureCount} selected features, so it can take a while. Drop
      correlated features first to reduce the number of features and speed it
      up.
    </Alert>
  );
}
