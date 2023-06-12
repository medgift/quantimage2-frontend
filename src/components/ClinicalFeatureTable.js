import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './ClinicalFeatureTable.css';
import {
  OUTCOME_CLASSIFICATION,
} from '../config/constants';



export default function ClinicalFeatureTable({
  clinicalFeaturesColumns,
  validateClinicalFeatureFile,
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

  useEffect(() => {
    // Load clinical features the first time the component is rendered
    loadClinicalFeatures();
  }, []); // Empty dependency array ensures the effect runs only once


  const toggleManualLabelling = () => {
    console.log("toggleManualLabelling");
    setisManualClinFeaturesOpen((open) => !open);
    setisAutoClinFeaturesOpen(false);
    loadClinicalFeatures();
  };

  const toggleAutoLabelling = () => {
    setisAutoClinFeaturesOpen((open) => !open);
    setisManualClinFeaturesOpen(false);
  };

  const handleClinFeaturesInputChange = (e, patientID, clinicalFeaturesColumns) => {
    let updatedClinicalFeatures = { ...editableClinicalFeatures };

    let clinicalFeatureToUpdate = updatedClinicalFeatures[patientID];
    clinicalFeatureToUpdate[clinicalFeaturesColumns] = e.target.value;

    setEditableClinicalFeatures(updatedClinicalFeatures);
  };

  const handleSaveClinicalFeaturesClick = async (e) => {
    if (isAutoClinFeaturesOpen) {
      toggleManualLabelling();
      setclinicalFeatureFileMessage(null);
      setisClinicalFeatureFileValid(null);
      fileInput.current.value = '';
    }
    
    await Backend.saveClinicalFeatures(
      keycloak.token,
      editableClinicalFeatures,
    );

  };

  const loadClinicalFeatures = async () => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };
  
    let clinicalFeatures = await Backend.loadClinicalFeatures(keycloak.token, dataPoints)

    for (let patientID in clinicalFeatures) {
      clinicalFeaturesToUpdate[patientID] = clinicalFeatures[patientID];
    }
    
    if (Object.keys(clinicalFeatures).length > 0){
      console.log("updating clinical features", clinicalFeaturesToUpdate)
      setEditableClinicalFeatures(clinicalFeaturesToUpdate);
    }
  }

  const updateEditableClinicalFeatures = (labels) => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };

    for (let patientID in labels) {
      if (patientID in editableClinicalFeatures) {
        console.log(patientID)
        clinicalFeaturesToUpdate[patientID] = labels[patientID];
      }
    }

    setEditableClinicalFeatures(clinicalFeaturesToUpdate);
  };

  const handleFileInputChange = async () => {
    let [isValid, message, labels] = await validateClinicalFeatureFile(
      fileInput.current.files[0],
      dataPoints
    );

    if (isValid) {
      updateEditableClinicalFeatures(labels);
    }
    setisClinicalFeatureFileValid(isValid);
    setclinicalFeatureFileMessage(message);
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
          Manual Clinical Features
        </Button>{' '}
        <Button color="success" onClick={toggleAutoLabelling}>
          Import Clinical Features
        </Button>
      </p>
      <Collapse isOpen={isManualClinFeaturesOpen}>
        <Table className="narrow-table table-fixed">
          <thead>
            <tr>
              <th>PatientID</th>
              {/*<th>ROI</th>*/}
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
                  <td key={clinicalFeaturesColumn} className="data-label">
                    <Input
                      type="text"
                      placeholder={clinicalFeaturesColumn}
                      value={
                        editableClinicalFeatures[dataPoint] &&
                        editableClinicalFeatures[dataPoint][clinicalFeaturesColumn]
                          ? editableClinicalFeatures[dataPoint][clinicalFeaturesColumn]
                          : ''
                      }
                      onChange={(e) => {
                        handleClinFeaturesInputChange(e, dataPoint, clinicalFeaturesColumn);
                      }}
                    />
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
          header row) containing the following{' '}
          <strong>{clinicalFeaturesColumns.length + 1} columns</strong>:
        </p>
        <Table className="narrow-table">
          <thead>
            <tr>
              <th>PatientID</th>
              {clinicalFeaturesColumns.map((clinicalFeaturesColumns) => (
                <th key={clinicalFeaturesColumns}>{clinicalFeaturesColumns}</th>
              ))}
            </tr>
          </thead>
        </Table>
        <Label for="label-file">Upload CSV File</Label>
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
              The selected file is valid: {clinicalFeatureFileMessage}
            </Alert>
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
          </>
        )}
      </Collapse>
    </>
  );
}
