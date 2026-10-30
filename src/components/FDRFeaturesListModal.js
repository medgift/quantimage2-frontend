import React from 'react';
import MyModal from './MyModal';
import { formatFeatureLabels } from '../utils/feature-label';

const FDRFeaturesListModal = ({ isOpen, toggle, selectedFdrData }) => {
  const labels = selectedFdrData?.features
    ? formatFeatureLabels(selectedFdrData.features.map((f) => f.feature))
    : [];

  return (
    <MyModal
      isOpen={isOpen}
      toggle={toggle}
      title={<span>Selected Features (ordered by adjusted pvalues)</span>}
    >
      {selectedFdrData?.features && (
        <ol>
          {selectedFdrData.features.map((f, i) => (
            <li key={f.feature} title={f.feature}>
              {labels[i]}{' '}
              <span className="text-muted small">
                (p = {f.pval_adj.toFixed(4)})
              </span>
            </li>
          ))}
        </ol>
      )}
    </MyModal>
  );
};

export default FDRFeaturesListModal;
