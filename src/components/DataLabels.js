import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';

import './DataLabels.css';
import {
  OUTCOME_CLASSIFICATION,
  PATIENT_FIELDS,
  TRAIN_TEST_SPLIT_TYPES,
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
  updateExtractionOrCollection,
}) {
  let { keycloak } = useKeycloak();

  let [editableOutcomes, setEditableOutcomes] = useState({});

  let [isManualLabellingOpen, setIsManualLabellingOpen] = useState(true);
  let [isAutoLabellingOpen, setIsAutoLabellingOpen] = useState(false);

  let [posLabel, setPosLabel] = useState('');

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

    // Reset train/test patients on outcome change
    await updateExtractionOrCollection({
      train_test_split_type: TRAIN_TEST_SPLIT_TYPES.AUTO,
      [PATIENT_FIELDS.TRAINING]: null,
      [PATIENT_FIELDS.TEST]: null,
    });

    console.log("pos label variable");
    console.log(posLabel);
    await Backend.saveLabels(
      keycloak.token,
      selectedLabelCategory.id,
      editableOutcomes,
      posLabel !== '' ? posLabel : null
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

  const classes = useMemo(() => {
    if (!outcomeColumns.includes(OUTCOME_CLASSIFICATION)) return [];

    if (
      Object.values(editableOutcomes).length > 0 &&
      !Object.keys(Object.values(editableOutcomes)[0]).includes(
        OUTCOME_CLASSIFICATION
      )
    )
      return [];

    return [
      ...new Set(
        Object.values(editableOutcomes)
          .map((o) => o[OUTCOME_CLASSIFICATION])
          .filter((o) => o)
      ),
    ];
  }, [outcomeColumns, editableOutcomes]);

  const hasTextualLabels = (classes) => {
    return classes.some((c) => isNaN(c));
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

  // Reset positive label on category change
  useEffect(() => {
    if (selectedLabelCategory.pos_label)
      setPosLabel(selectedLabelCategory.pos_label);
  }, [selectedLabelCategory]);

  // Reset positive label on classes change
  useEffect(() => {
    if (
      classes.length > 0 &&
      hasTextualLabels(classes) &&
      !classes.includes(posLabel)
    )
      setPosLabel(classes[0]);
  }, [posLabel, classes]);

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

        {outcomeColumns.includes(OUTCOME_CLASSIFICATION) &&
          classes.length > 0 &&
          hasTextualLabels(classes) && (
            <div className="mb-2">
              <h3>
                Textual labels detected - Please define the positive label
              </h3>
              <p>Positive Label : {posLabel}</p>
              <Input
                type="select"
                value={posLabel}
                onChange={(e) => setPosLabel(e.target.value)}
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
