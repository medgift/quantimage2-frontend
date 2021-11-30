import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from 'react-keycloak';

import './DataLabels.css';
import {
  CLASSIFICATION_OUTCOMES,
  MODEL_TYPES,
  OUTCOME_CLASSIFICATION,
  OUTCOME_SURVIVAL_EVENT,
  SURVIVAL_OUTCOMES,
} from '../config/constants';

export default function DataLabels({
  albumID,
  selectedLabelCategory,
  setSelectedLabelCategory,
  outcomeColumns,
  validateLabelFile,
  isSavingLabels,
  setIsSavingLabels,
  setLabelCategories,
  dataPoints,
  outcomes,
}) {
  let [keycloak] = useKeycloak();

  let [editableOutcomes, setEditableOutcomes] = useState({});

  let [isManualLabellingOpen, setIsManualLabellingOpen] = useState(true);
  let [isAutoLabellingOpen, setIsAutoLabellingOpen] = useState(false);

  let [isLabelFileValid, setIsLabelFileValid] = useState(null);
  let [labelFileMessage, setLabelFileMessage] = useState(null);
  let fileInput = useRef(null);

  const toggleManualLabelling = () => {
    setIsManualLabellingOpen((open) => !open);
    setIsAutoLabellingOpen(false);
  };

  const toggleAutoLabelling = () => {
    setIsAutoLabellingOpen((open) => !open);
    setIsManualLabellingOpen(false);
  };

  const handleOutcomeInputChange = (e, patientID, outcomeColumn) => {
    let updatedOutcomes = { ...editableOutcomes };

    let outcomeToUpdate = updatedOutcomes[patientID];
    outcomeToUpdate[outcomeColumn] = e.target.value;

    setEditableOutcomes(updatedOutcomes);
  };

  const handleSaveLabelsClick = async (e) => {
    setIsSavingLabels(true);
    await Backend.saveLabels(
      keycloak.token,
      selectedLabelCategory.id,
      editableOutcomes
    );
    setIsSavingLabels(false);

    if (isAutoLabellingOpen) {
      toggleManualLabelling();
      setLabelFileMessage(null);
      setIsLabelFileValid(null);
      fileInput.current.value = '';
    }

    /* TODO - Improve this part, these manual calls are not so elegant */
    let labelCategories = await Backend.labelCategories(
      keycloak.token,
      albumID
    );

    setLabelCategories(labelCategories);

    setSelectedLabelCategory(
      labelCategories.find((c) => c.id === selectedLabelCategory.id)
    );
  };

  const updateEditableOutcomes = (labels) => {
    let outcomesToUpdate = { ...editableOutcomes };

    for (let patientID in labels) {
      if (patientID in editableOutcomes) {
        outcomesToUpdate[patientID] = labels[patientID];
      }
    }

    setEditableOutcomes(outcomesToUpdate);
  };

  const handleFileInputChange = async () => {
    let [isValid, message, labels] = await validateLabelFile(
      fileInput.current.files[0],
      dataPoints
    );

    if (isValid) {
      updateEditableOutcomes(labels);
    }
    setIsLabelFileValid(isValid);
    setLabelFileMessage(message);
  };

  useEffect(() => {
    if (!selectedLabelCategory) return [];

    let formattedOutcomes = {};

    for (let dataPoint of [
      ...dataPoints.sort((p1, p2) =>
        p1.localeCompare(p2, undefined, { numeric: true })
      ),
    ]) {
      let existingLabel = selectedLabelCategory.labels.find(
        (l) => l.patient_id === dataPoint
      );

      if (existingLabel)
        formattedOutcomes[dataPoint] = existingLabel.label_content;
      else
        formattedOutcomes[dataPoint] = Object.assign(
          {},
          {},
          ...outcomeColumns.map((o) => '')
        );

      setEditableOutcomes(formattedOutcomes);
      // return selectedLabelCategory.labels.reduce((acc, curr) => {
      //   acc[curr.patient_id] = curr.label_content;
      //
      //   return acc;
      // }, {});
    }

    setEditableOutcomes(formattedOutcomes);
  }, [selectedLabelCategory, dataPoints, outcomeColumns]);

  return (
    <>
      <p>
        <Button color="primary" onClick={toggleManualLabelling}>
          Manual labelling
        </Button>{' '}
        <Button color="success" onClick={toggleAutoLabelling}>
          Import Labels
        </Button>
      </p>
      <Collapse isOpen={isManualLabellingOpen}>
        <Table className="narrow-table table-fixed">
          <thead>
            <tr>
              <th>PatientID</th>
              {/*<th>ROI</th>*/}
              {outcomeColumns.map((outcomeColumn) => (
                <th key={outcomeColumn}>{outcomeColumn}</th>
              ))}
            </tr>
          </thead>
          <tbody className="data-points">
            {dataPoints.map((dataPoint) => (
              <tr key={`${dataPoint}`}>
                <td>{dataPoint}</td>
                {outcomeColumns.map((outcomeColumn) => (
                  <td key={outcomeColumn} className="data-label">
                    <Input
                      type="text"
                      placeholder={outcomeColumn}
                      value={
                        editableOutcomes[dataPoint] &&
                        editableOutcomes[dataPoint][outcomeColumn]
                          ? editableOutcomes[dataPoint][outcomeColumn]
                          : ''
                      }
                      onChange={(e) => {
                        handleOutcomeInputChange(e, dataPoint, outcomeColumn);
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
          onClick={handleSaveLabelsClick}
          disabled={isSavingLabels}
        >
          {isSavingLabels ? (
            <>
              <FontAwesomeIcon icon="spinner" spin /> Saving Labels
            </>
          ) : (
            'Save Labels'
          )}
        </Button>
      </Collapse>

      <Collapse isOpen={isAutoLabellingOpen}>
        <p>
          Please upload a CSV file with one row per patient (+optionnally a
          header row) containing the following{' '}
          <strong>{outcomeColumns.length + 1} columns</strong>:
        </p>
        <Table className="narrow-table">
          <thead>
            <tr>
              <th>PatientID</th>
              {outcomeColumns.map((outcomeColumn) => (
                <th key={outcomeColumn}>{outcomeColumn}</th>
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
          !isLabelFileValid && (
            <Alert color="danger">
              The selected file is not valid: {labelFileMessage}
            </Alert>
          )}
        {fileInput.current && fileInput.current.files[0] && isLabelFileValid && (
          <>
            <Alert color="success">
              The selected file is valid: {labelFileMessage}
            </Alert>
            <Button
              color="success"
              onClick={handleSaveLabelsClick}
              disabled={isSavingLabels}
            >
              {isSavingLabels ? (
                <>
                  <FontAwesomeIcon icon="spinner" spin /> Saving Labels
                </>
              ) : (
                'Save Labels'
              )}
            </Button>
          </>
        )}
      </Collapse>
    </>
  );
}
