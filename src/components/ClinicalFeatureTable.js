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

  let [editableClinicalFeatures, seteditableClinicalFeatures] = useState({});

  let [isManualClinFeaturesOpen, setisManualClinFeaturesOpen] = useState(true);
  let [isAutoClinFeaturesOpen, setisAutoClinFeaturesOpen] = useState(false);

  let [posClinicalFeatures, setposClinicalFeatures] = useState('');

  let [isClinicalFeatureFileValid, setisClinicalFeatureFileValid] = useState(null);
  let [clinicalFeatureFileMessage, setclinicalFeatureFileMessage] = useState(null);
  let fileInput = useRef(null);

  const toggleManualLabelling = () => {
    setisManualClinFeaturesOpen((open) => !open);
    setisAutoClinFeaturesOpen(false);
  };

  const toggleAutoLabelling = () => {
    setisAutoClinFeaturesOpen((open) => !open);
    setisManualClinFeaturesOpen(false);
  };

  const handleClinFeaturesInputChange = (e, patientID, clinicalFeaturesColumns) => {
    let updatedClinicalFeatures = { ...editableClinicalFeatures };

    let clinicalFeatureToUpdate = updatedClinicalFeatures[patientID];
    clinicalFeatureToUpdate[clinicalFeaturesColumns] = e.target.value;

    seteditableClinicalFeatures(updatedClinicalFeatures);
  };

  const handleSaveClinicalFeaturesClick = async (e) => {
    //pass
  };

  const updateeditableClinicalFeatures = (labels) => {
    let clinicalFeaturesToUpdate = { ...editableClinicalFeatures };

    for (let patientID in labels) {
      if (patientID in editableClinicalFeatures) {
        clinicalFeaturesToUpdate[patientID] = labels[patientID];
      }
    }

    seteditableClinicalFeatures(clinicalFeaturesToUpdate);
  };

  const handleFileInputChange = async () => {
    let [isValid, message, labels] = await validateClinicalFeatureFile(
      fileInput.current.files[0],
      dataPoints
    );

    if (isValid) {
      updateeditableClinicalFeatures(labels);
    }
    setisClinicalFeatureFileValid(isValid);
    setclinicalFeatureFileMessage(message);
  };

  const classes = useMemo(() => {
    if (!clinicalFeaturesColumns.includes(OUTCOME_CLASSIFICATION)) return [];

    if (
      Object.values(editableClinicalFeatures).length > 0 &&
      !Object.keys(Object.values(editableClinicalFeatures)[0]).includes(
        OUTCOME_CLASSIFICATION
      )
    )
      return [];

    return [
      ...new Set(
        Object.values(editableClinicalFeatures)
          .map((o) => o[OUTCOME_CLASSIFICATION])
          .filter((o) => o)
      ),
    ];
  }, [clinicalFeaturesColumns, editableClinicalFeatures]);

  const hasTextualLabels = (classes) => {
    return classes.some((c) => isNaN(c));
  };

  useEffect(() => {
    let formattedOutcomes = {};

    for (let dataPoint of [
      ...dataPoints.sort((p1, p2) =>
        p1.localeCompare(p2, undefined, { numeric: true })
      ),
    ]) {
      formattedOutcomes[dataPoint] = Object.assign(
        {},
        {},
        ...clinicalFeaturesColumns.map((o) => '')
      );

      seteditableClinicalFeatures(formattedOutcomes);
    }

    seteditableClinicalFeatures(formattedOutcomes);
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
              {clinicalFeaturesColumns.map((clinicalFeaturesColumns) => (
                <th key={clinicalFeaturesColumns}>{clinicalFeaturesColumns}</th>
              ))}
            </tr>
          </thead>
          <tbody className="data-points">
            {dataPoints.map((dataPoint) => (
              <tr key={`${dataPoint}`}>
                <td>{dataPoint}</td>
                {clinicalFeaturesColumns.map((clinicalFeaturesColumns) => (
                  <td key={clinicalFeaturesColumns} className="data-label">
                    <Input
                      type="text"
                      placeholder={clinicalFeaturesColumns}
                      value={
                        editableClinicalFeatures[dataPoint] &&
                        editableClinicalFeatures[dataPoint][clinicalFeaturesColumns]
                          ? editableClinicalFeatures[dataPoint][clinicalFeaturesColumns]
                          : ''
                      }
                      onChange={(e) => {
                        handleClinFeaturesInputChange(e, dataPoint, clinicalFeaturesColumns);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>

        {clinicalFeaturesColumns.includes(OUTCOME_CLASSIFICATION) &&
          classes.length > 0 &&
          hasTextualLabels(classes) && (
            <div className="mb-2">
              <h3>
                Textual labels detected - Please define the positive label
              </h3>
              <p>Positive Label : {posClinicalFeatures}</p>
              <Input
                type="select"
                value={posClinicalFeatures}
                onChange={(e) => setposClinicalFeatures(e.target.value)}
              >
                {classes.map((c) => {
                  console.log('Class', c);
                  return <option key={c}>{c}</option>;
                })}
              </Input>
            </div>
          )}

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
