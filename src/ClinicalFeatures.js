import React from 'react';
import ClinicalFeatureTable from './components/ClinicalFeatureTable';
import { CLINICAL_FEATURES } from './config/constants';
import { validateLabelOrClinicalFeaturesFile } from './utils/feature-utils.js';


export default function ClinicalFeatures({
  albumID,
  featureExtractionID,
  isSavingClinicalFeatures,
  setisSavingClinicalFeatures,
  dataPoints,
  outcomes,
  selectedLabelCategory,
  setSelectedLabelCategory,
  labelCategories,
  setLabelCategories,
  setFeaturesChart,
  updateExtractionOrCollection,
  setNbTrainingPatients,
}) {

  return (
    <>
      <h3>Clinical Features</h3>
      <p></p>
      <ClinicalFeatureTable
        clinicalFeaturesColumns={CLINICAL_FEATURES}
        validateClinicalFeatureFile={(file, dataPoints) =>
          validateLabelOrClinicalFeaturesFile(
            file,
            dataPoints,
            CLINICAL_FEATURES,
          )
        }
        isSavingClinicalFeatures={isSavingClinicalFeatures}
        dataPoints={dataPoints}
      />
    </>
  );
}