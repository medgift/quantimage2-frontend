import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';
import { CLINCAL_FEATURE_TYPES, CLINICAL_FEATURE_ENCODING } from '../config/constants';
import { validateClinicalFeaturesFile, parseClinicalFeatureNames } from '../utils/feature-utils.js';

import './ClinicalFeatureTable.css';

const PATIENT_ID = "PatientID";

export default function ClinicalFeatureTable({
  clinicalFeaturesColumns,
  dataPoints,
  isSavingClinicalFeatures,
}) {
  let { keycloak } = useKeycloak();

  let [editableClinicalFeatures, setEditableClinicalFeatures] = useState({});

  let [isManualClinFeaturesOpen, setisManualClinFeaturesOpen] = useState(true);
  let [isAutoClinFeaturesOpen, setisAutoClinFeaturesOpen] = useState(false);

  let [isClinicalFeatureFileValid, setisClinicalFeatureFileValid] = useState(null);
  let [clinicalFeatureFileMessage, setclinicalFeatureFileMessage] = useState(null);
  let [filterClinicalFeatureMessages, setFilterClinicalFeatureMessages] = useState(null);
  let fileInput = useRef(null);

  const [editableClinicalFeatureDefinitions, setEditableClinicalFeatureDefinitions] = useState({
    // "Age": { "Type": CLINCAL_FEATURE_TYPES[0], "Encoding": "None" },
    // "Gender": { "Type": CLINCAL_FEATURE_TYPES[0], "Encoding": "Categorical" }
  });

  const handleInputChange = (e, feature_name, feature_type) => {
    let editableClinicalFeatureDefinitionsToUpdate = { ...editableClinicalFeatureDefinitions };
    editableClinicalFeatureDefinitionsToUpdate[feature_name][feature_type] = e.target.value;
    setEditableClinicalFeatureDefinitions(editableClinicalFeatureDefinitionsToUpdate)
  };

  useEffect(() => {
    // Load clinical features the first time the component is rendered
    loadClinicalFeatures();
    loadClinicalFeatureDefinitions();
  }, []); // Empty dependency array ensures the effect runs only once


  const toggleManualLabelling = () => {
    console.log("toggleManualLabelling");
    setisManualClinFeaturesOpen((open) => !open);
    setisAutoClinFeaturesOpen(false);
    loadClinicalFeatures();
    loadClinicalFeatureDefinitions();
  };

  const toggleAutoLabelling = () => {
    setisAutoClinFeaturesOpen((open) => !open);
    setisManualClinFeaturesOpen(false);
  };

  const handleSaveClinicalFeaturesClick = async (e) => {
    if (isAutoClinFeaturesOpen) {
      toggleManualLabelling();
      setclinicalFeatureFileMessage(null);
      setisClinicalFeatureFileValid(null);
      fileInput.current.value = '';
    }

    await Backend.saveClinicalFeatureDefinitions(
      keycloak.token,
      editableClinicalFeatureDefinitions,
    )

    await Backend.saveClinicalFeatures(
      keycloak.token,
      editableClinicalFeatures,
    );

    // await Backend.deleteClinicalFeatures();
  };

  const loadClinicalFeatures = async () => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };

    let clinicalFeatures = await Backend.loadClinicalFeatures(keycloak.token, dataPoints)

    console.log("clinicalFeatures", clinicalFeatures);

    for (let patientID in clinicalFeatures) {
      clinicalFeaturesToUpdate[patientID] = clinicalFeatures[patientID];
    }
    console.log("clinicalFeaturesToUpdate", clinicalFeaturesToUpdate);

    if (Object.keys(clinicalFeatures).length > 0) {
      setEditableClinicalFeatures(clinicalFeaturesToUpdate);
    }
  }

  const loadClinicalFeatureDefinitions = async () => {
    let clinicalFeatureDefinitionsToUpdate = { ...editableClinicalFeatureDefinitions };

    let clinicalFeatureDefinitions = await Backend.loadClinicalFeatureDefinitions(keycloak.token)

    for (let feature_name in clinicalFeatureDefinitions) {
      clinicalFeatureDefinitionsToUpdate[feature_name] = clinicalFeatureDefinitions[feature_name];
    }

    if (Object.keys(clinicalFeatureDefinitions).length > 0) {
      setEditableClinicalFeatureDefinitions(clinicalFeatureDefinitionsToUpdate);
    }
  }

  const updateEditableClinicalFeatures = (clinicalFeatures) => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };

    for (let patientID in clinicalFeatures) {
      if (patientID in editableClinicalFeatures) {

        clinicalFeaturesToUpdate[patientID] = clinicalFeatures[patientID];
      }
    }

    setEditableClinicalFeatures(clinicalFeaturesToUpdate);
  };

  const handleFileInputChange = async () => {
    let [isValid, message, clinicalFeatures] = await validateClinicalFeaturesFile(
      fileInput.current.files[0],
      dataPoints,
      clinicalFeaturesColumns,
    );

    // Reset valid messages or filter messages to ensure that it's not confusing if you upload a new file.
    setFilterClinicalFeatureMessages({});
    setclinicalFeatureFileMessage("");
    

    if (isValid) {
      let filterMessages = {};
      let column_names = await parseClinicalFeatureNames(fileInput.current.files[0]);
      let columns_to_filter = await Backend.filterClinicalFeatures(keycloak.token, clinicalFeatures);

      let contains_patient_id = column_names.includes(PATIENT_ID);
      if (contains_patient_id) {
        for (let column_name of column_names) {
          if (column_name === PATIENT_ID || column_name.length === 0) {
            continue;
          }
          if (columns_to_filter["too_little_data"].includes(column_name)) {
            filterMessages[column_name] = "because less than 10% of the patients have data for this feature";
            continue;
          }

          if (columns_to_filter["only_one_value"].includes(column_name)) {
            filterMessages[column_name] = "because only one value is present in the data";
            continue;
          }

          editableClinicalFeatureDefinitions[column_name] = { "Type": CLINCAL_FEATURE_TYPES[0], "Encoding": CLINICAL_FEATURE_ENCODING[0] }
        }
        updateEditableClinicalFeatures(clinicalFeatures);
        console.log(clinicalFeatures);
      }
      else {
        isValid = false;
        message = `Clinical Features file does not contain ${PATIENT_ID} column, please edit the file manually and try again - got ${column_names.join(", ")}`;
      }
      if (isValid) {
        Backend.deleteClinicalFeatureDefinitions(keycloak.token);

        let guessedClinicalFeatureDefinitions = await Backend.guessClinicalFeatureDefinitions(keycloak.token, clinicalFeatures);
        let clinicalFeaturesUniqueValues = await Backend.clinicalFeaturesUniqueValues(keycloak.token, clinicalFeatures);
        
        for (let feature_name in guessedClinicalFeatureDefinitions) {
          if (feature_name in editableClinicalFeatureDefinitions) {
            editableClinicalFeatureDefinitions[feature_name] = guessedClinicalFeatureDefinitions[feature_name];
            
            if (clinicalFeaturesUniqueValues["frequency_of_occurence"][feature_name].length < 10)
              { 
                editableClinicalFeatureDefinitions[feature_name]["Unique Values"] = clinicalFeaturesUniqueValues["frequency_of_occurence"][feature_name].join(" | ");
              }
          }
        }
        console.log("guessedClinicalFeatureDefinitions", guessedClinicalFeatureDefinitions);
      }
      setFilterClinicalFeatureMessages(filterMessages);
      setisClinicalFeatureFileValid(isValid);
      setclinicalFeatureFileMessage(message);
    }
  };

  useEffect(() => {
    let formattedClinicalFeature = {};

    for (let dataPoint of [
      ...dataPoints.sort((p1, p2) =>
        p1.localeCompare(p2, undefined, { numeric: true })
      ),
    ]) {
      formattedClinicalFeature[dataPoint] = Object.assign(
        {},
        {},
        ...clinicalFeaturesColumns.map((o) => '')
      );
      setEditableClinicalFeatures(formattedClinicalFeature);
    }

    setEditableClinicalFeatures(formattedClinicalFeature);
  }, [dataPoints, clinicalFeaturesColumns]);

  return (
    <>
      <p>
        <Button color="primary" onClick={toggleManualLabelling}>
          Clinical Feature Configuration
        </Button>{' '}
        <Button color="success" onClick={toggleAutoLabelling}>
          Import Clinical Features
        </Button>
      </p>
      <Collapse isOpen={isManualClinFeaturesOpen}>
        <div style={{ margin: '20px' }}></div>
        <h4>Clinical Feature Configuration</h4>
        <div style={{ margin: '20px' }}></div>
        <Table className="table-fixed">
          <thead>
            <tr>
              <th>Clinical Feature</th>
              <th>Type</th>
              <th>Encoding</th>
              <th>Unique Values</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(editableClinicalFeatureDefinitions).map(feature_name => (
              <tr key={feature_name}>
                <td>{feature_name}</td>
                <td>
                  <Input
                    type="select"
                    id="type_list"
                    name="type_list"
                    value={editableClinicalFeatureDefinitions[feature_name]["Type"]}
                    onChange={(event) => handleInputChange(event, feature_name, "Type")}
                  >
                    {CLINCAL_FEATURE_TYPES.map(feat_type => <option key={feat_type} value={feat_type}>{feat_type}</option>)};
                  </Input>
                </td>
                <td>
                  <Input
                    type="select"
                    id="encoding_list"
                    name="encoding_list"
                    value={editableClinicalFeatureDefinitions[feature_name]["Encoding"]}
                    onChange={(event) => handleInputChange(event, feature_name, "Encoding")}
                  >
                    {CLINICAL_FEATURE_ENCODING.map(encoding_type => <option key={encoding_type} value={encoding_type}>{encoding_type}</option>)};
                  </Input>
                </td>
                <td>{editableClinicalFeatureDefinitions[feature_name]["Unique Values"]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div style={{ margin: '20px' }}></div>
        <div style={{ margin: '20px' }}></div>
        <h4>Clinical Feature Values</h4>
        <div style={{ margin: '20px' }}></div>
        <Table className="table-fixed">
          <thead>
            <tr>
              <th>PatientID</th>
              {Object.keys(editableClinicalFeatureDefinitions).map((clinicalFeaturesColumn) => (
                <th key={clinicalFeaturesColumn}>{clinicalFeaturesColumn}</th>
              ))}
            </tr>
          </thead>
          <tbody className="data-points">
            {dataPoints.map((dataPoint) => (
              <tr key={`${dataPoint}`}>
                <td>{dataPoint}</td>
                {Object.keys(editableClinicalFeatureDefinitions).map((clinicalFeaturesColumn) => (
                  <td key={clinicalFeaturesColumn} className="data-label">{editableClinicalFeatures[dataPoint] &&
                    editableClinicalFeatures[dataPoint][clinicalFeaturesColumn]
                    ? editableClinicalFeatures[dataPoint][clinicalFeaturesColumn] : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>

        <Button
          color="success"
          onClick={handleSaveClinicalFeaturesClick}
          disabled={isSavingClinicalFeatures}
        >
          {isSavingClinicalFeatures ? (
            <>
              <FontAwesomeIcon icon="spinner" spin /> Saving Labels
            </>
          ) : (
            `Save Clinical Features`
          )}
        </Button>
      </Collapse>

      <Collapse isOpen={isAutoClinFeaturesOpen}>
        <p>
          Please upload a CSV file with one row per patient (+optionnally a
          header row) containing one column per clinical feature of interest.

          The systemm will try to automatically detect the type of each clinical feature and you will configure the encoding afterwards.

          Note: The system will delete existing feature upon a new upload to ensure that data does not become corrupted.
        </p>
        <Label for="label-file" style={{ fontWeight: 'bold' }}>Upload CSV File (Note: If the file is valid - this will delete existing clinical features)</Label>
        <div style={{ textAlign: 'center' }}>
          <Input
            type="file"
            name="file"
            id="label-file"
            innerRef={fileInput}
            onChange={handleFileInputChange}
            style={{ width: 'inherit', display: 'inline' }}
          />
        </div>
        <br />
        {fileInput.current &&
          fileInput.current.files[0] &&
          !isClinicalFeatureFileValid && (
            <Alert color="danger">
              The selected file is not valid: {clinicalFeatureFileMessage}
            </Alert>
          )}
        {fileInput.current && fileInput.current.files[0] && isClinicalFeatureFileValid && (
          <>
            <Alert color="success">
              The selected file is valid: {clinicalFeatureFileMessage} - please go to Clinical Feature Configuiration Tab to configure the encoding of each feature.
            </Alert>
          </>
        )}
        {fileInput.current && fileInput.current.files[0] && isClinicalFeatureFileValid && (Object.keys(filterClinicalFeatureMessages).length > 0) && (
          <>
            {Object.keys(filterClinicalFeatureMessages).map((columnName) => (
              <Alert color="success" key={columnName}>
                {columnName} was removed {filterClinicalFeatureMessages[columnName]}.
              </Alert>
            ))}
          </>
        )}
      </Collapse>
    </>
  );
}
