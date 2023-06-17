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

  const updateEditableClinicalFeatures = (labels) => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };

    for (let patientID in labels) {
      if (patientID in editableClinicalFeatures) {
        clinicalFeaturesToUpdate[patientID] = labels[patientID];
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

    if (isValid) {
      let column_names = await parseClinicalFeatureNames(fileInput.current.files[0]);
      console.log("column_names", column_names);
      let contains_patient_id = column_names.includes(PATIENT_ID);
      if (contains_patient_id) {
        for (let column_name of column_names) {
          if (column_name == PATIENT_ID) {
            continue;
          }
          console.log("column_name", column_name);
          editableClinicalFeatureDefinitions[column_name] = {"Type": CLINCAL_FEATURE_TYPES[0], "Encoding": CLINICAL_FEATURE_ENCODING[0]}
        }
        updateEditableClinicalFeatures(clinicalFeatures);
        console.log(clinicalFeatures);
      }
      else {
        isValid = false;
        message =`Clinical Features file does not contain ${PATIENT_ID} column, please edit the file manually and try again - got ${column_names.join(", ")}`;
      }
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
              </tr>
            ))}
          </tbody>
        </Table>
        <div style={{ margin: '20px' }}></div>
        <div style={{ margin: '20px' }}></div>
        <h4>Clinical Feature Values</h4>
        <div style={{ margin: '20px' }}></div>
        <Table className="narrow-table table-fixed">
          <thead>
            <tr>
              <th>PatientID</th>
              {clinicalFeaturesColumns.map((clinicalFeaturesColumn) => (
                <th key={clinicalFeaturesColumn}>{clinicalFeaturesColumn}</th>
              ))}
            </tr>
          </thead>
          <tbody className="data-points">
            {dataPoints.map((dataPoint) => (
              <tr key={`${dataPoint}`}>
                <td>{dataPoint}</td>
                {clinicalFeaturesColumns.map((clinicalFeaturesColumn) => (
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
        <Label for="label-file" style={{fontWeight: 'bold'}}>Upload CSV File</Label>
        <div style={{ textAlign: 'center'}}>
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
      </Collapse>
    </>
  );
}
