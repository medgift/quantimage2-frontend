import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from 'react-keycloak';

import './DataLabels.css';

export default function DataLabels({
  albumID,
  dataPoints,
  dataLabels,
  updateCurrentLabels,
  selectedLabelCategory,
  setSelectedLabelCategory,
  outcomeColumns,
  validateLabelFile,
  isSavingLabels,
  setIsSavingLabels,
  setLabelCategories,
  setOutcomes,
  setFeaturesChart,
  featureExtractionID,
}) {
  let [keycloak] = useKeycloak();

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

  const handleLabelInputChange = (e, patientID, outcomeColumn) => {
    let updatedLabels = { ...dataLabels };

    updatedLabels[patientID][outcomeColumn] = e.target.value;

    updateCurrentLabels(updatedLabels);
  };

  const handleSaveLabelsClick = async (e) => {
    setIsSavingLabels(true);
    await Backend.saveLabels(
      keycloak.token,
      selectedLabelCategory.id,
      dataLabels
    );
    setIsSavingLabels(false);
    toggleAutoLabelling();
    toggleManualLabelling();

    /* TODO - Improve this part, these manual calls are not so elegant */
    let labelCategories = await Backend.labelCategories(
      keycloak.token,
      albumID
    );

    setLabelCategories(labelCategories);

    setSelectedLabelCategory(
      labelCategories.find((c) => c.id === selectedLabelCategory.id)
    );

    const {
      outcomes,
      features_chart: featuresChart,
    } = await Backend.extractionFeatureDetails(
      keycloak.token,
      featureExtractionID
    );

    setOutcomes(outcomes);
    setFeaturesChart(featuresChart);
  };

  const handleFileInputChange = async () => {
    let [isValid, message] = await validateLabelFile(
      fileInput.current.files[0],
      dataPoints,
      updateCurrentLabels
    );
    setIsLabelFileValid(isValid);
    setLabelFileMessage(message);
  };

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
                        dataLabels[dataPoint] &&
                        dataLabels[dataPoint][outcomeColumn]
                          ? dataLabels[dataPoint][outcomeColumn]
                          : ''
                      }
                      onChange={(e) => {
                        handleLabelInputChange(e, dataPoint, outcomeColumn);
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
