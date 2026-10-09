import React from 'react';
import MyModal from './MyModal';

const FDRFeaturesListModal = ({ isOpen, toggle, selectedFdrData }) => {
  return (
    <MyModal
      isOpen={isOpen}
      toggle={toggle}
      title={<span>Selected Features (ordered by adjusted pvalues)</span>}
    >
      {selectedFdrData?.features && (
        <ol>
          {[...selectedFdrData.features].map((f) => (
            <li key={f.feature}>
              {f.feature}{' '}
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
