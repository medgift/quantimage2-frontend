import React, { useState } from 'react';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import { Alert } from 'reactstrap';
import { useKeycloak } from '@react-keycloak/web';
import DataLabels from './components/DataLabels';
import { DataLabelsType } from './components/DataLabels';
import { CLINICAL_FEATURES } from './config/constants';
import { validateLabelOrClinicalFeaturesFile } from './utils/feature-utils.js';


export default function ClinicalFeatures({
  albumID,
  featureExtractionID,
  isSavingLabels,
  setIsSavingLabels,
  dataPoints,
  outcomes,
  selectedLabelCategory,
  setSelectedLabelCategory,
  labelCategories,
  setLabelCategories,
  setFeaturesChart,
  updateExtractionOrCollection,
  setNbTrainingPatients,
})
 {
  const { keycloak } = useKeycloak();

  const [file, setFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);

    // Read the file content
    const reader = new FileReader();
    reader.onload = handleFileRead;
    reader.readAsText(selectedFile);
  };

  const handleFileRead = (event) => {
    const content = event.target.result;

    // Perform validation checks on the file content
    const isValid = validateFileContent(content);
  };

  const validateFileContent = (content) => {
    const lines = content.split('\n');
    
    const [header, ...data] = lines;
    const headers = header.split(','); // This will have a problem when there are spaces such as age, gender - split by , gives a space in the second element - which makes the indexOf fail

    const ageIndex = headers.indexOf('age');
    const sexIndex = headers.indexOf('gender');
    
    // Check if the CSV has at least two columns (age and sex)
    if (headers.length != 2) {
      setErrorMessage(`A different number of columns was found - found ${header.length}}`);
    }

    // Check if the age and gender columns exist in the header
    if (ageIndex === -1 || sexIndex === -1) {
      setErrorMessage(`The age and gender columns were not found in the header - got ${header}`)
    }
    
    // Check each row of data
    for (let i = 0; i < data.length; i++) {
      const rowData = data[i].split(',');
      if (rowData.length === 1 && rowData[0] === '') {
        continue;
      }

      console.log(rowData);
      // Check if the row has the correct number of columns
      if (rowData.length !== headers.length) {
        setErrorMessage(`A different number of columns was found - found ${rowData.length} at line ${i + 1}`)
      }
      
      const ageValue = parseInt(rowData[ageIndex]);
      const sexValue = rowData[sexIndex].trim().toUpperCase();
      
      // Check if the age value is between 0 and 100
      if (isNaN(ageValue) || ageValue < 0 || ageValue > 100) {
        setErrorMessage(`Invalid age value found - found ${ageValue} at line ${i + 1}`)
      }
      
      // Check if the sex value is either "M" or "F"
      if (sexValue !== 'M' && sexValue !== 'F') {
        setErrorMessage(`Invalid gender value found - found ${sexValue} at line ${i + 1}`)
      }
    }
  }

  return (
    <>
      <h3>Clinical Features</h3>
      <div>
        <input
          id="file-upload"
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {errorMessage && <Alert color="danger">{errorMessage}</Alert>}
      </div>
      <DataLabels
            albumID={albumID}
            dataPoints={dataPoints}
            isSavingLabels={isSavingLabels}
            setIsSavingLabels={setIsSavingLabels}
            selectedLabelCategory={selectedLabelCategory}
            setSelectedLabelCategory={setSelectedLabelCategory}
            setLabelCategories={setLabelCategories}
            outcomes={outcomes}
            setFeaturesChart={setFeaturesChart}
            featureExtractionID={featureExtractionID}
            outcomeColumns={CLINICAL_FEATURES}
            validateLabelFile={(file, dataPoints) =>
              validateLabelOrClinicalFeaturesFile(
                file,
                dataPoints,
                CLINICAL_FEATURES,
              )
            }
            updateExtractionOrCollection={updateExtractionOrCollection}
            setNbTrainingPatients={setNbTrainingPatients}
            dataname={"Clinical Features"}
            datalabelstype={DataLabelsType.CLINICAL_FEATURES}
       />
    </>
  );
}