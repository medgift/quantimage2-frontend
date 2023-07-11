import React from 'react';
import ClinicalFeatureTable from './components/ClinicalFeatureTable';
import { CLINICAL_FEATURES } from './config/constants';

export default function ClinicalFeatures({ dataPoints, albumID, setClinicalFeatureNames }) {
  return (
    <>
      <h3>Clinical Features</h3>
      <p></p>
      <ClinicalFeatureTable
        clinicalFeaturesColumns={CLINICAL_FEATURES}
        dataPoints={dataPoints}
        albumID={albumID}
        setClinicalFeatureNames={setClinicalFeatureNames}
      />
    </>
  );
}
