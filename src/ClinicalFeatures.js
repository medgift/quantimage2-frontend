import React from 'react';
import ClinicalFeatureTable from './components/ClinicalFeatureTable';

export default function ClinicalFeatures(props) {
  return (
    <>
      <h3>Clinical Features</h3>
      <ClinicalFeatureTable {...props} />
    </>
  );
}
