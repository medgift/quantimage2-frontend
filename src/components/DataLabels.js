import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from 'react-keycloak';

export default function DataLabels({
  albumID,
  dataPoints,
  dataLabels,
  labelType,
  setDataLabels,
  outcomeColumns,
  validateLabelFile,
}) {
  let [keycloak] = useKeycloak();

  let [isManualLabellingOpen, setIsManualLabellingOpen] = useState(false);
  let [isAutoLabellingOpen, setIsAutoLabellingOpen] = useState(false);

  let [isLabelFileValid, setIsLabelFileValid] = useState(null);
  let [labelFileError, setLabelFileError] = useState(null);

  const [isSaving, setIsSaving] = useState(false);

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

    setDataLabels(updatedLabels);
  };

  const handleSaveLabelsClick = async (e) => {
    setIsSaving(true);
    await Backend.saveLabels(keycloak.token, albumID, labelType, dataLabels);
    setIsSaving(false);
  };

  const handleFileInputChange = async () => {
    let [isValid, error] = await validateLabelFile(
      fileInput.current.files[0],
      dataPoints,
      setDataLabels
    );
    setIsLabelFileValid(isValid);
    setLabelFileError(error);
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
        <Table className="narrow-table">
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
              // <tr key={`${dataPoint[0]}-${dataPoint[1]}`}>
              //   <td>{dataPoint[0]}</td>
              //   <td>{dataPoint[1]}</td>
              //   <td className="data-label">
              //     <Input
              //       type="text"
              //       placeholder="LABEL"
              //       value={
              //         dataLabels[dataPoint[0]] &&
              //         dataLabels[dataPoint[0]][dataPoint[1]]
              //           ? dataLabels[dataPoint[0]][dataPoint[1]]
              //           : ''
              //       }
              //       onChange={e => {
              //         handleLabelInputChange(e, dataPoint[0], dataPoint[1]);
              //       }}
              //     />
              //   </td>
              // </tr>
            ))}
          </tbody>
        </Table>

        <Button
          color="success"
          onClick={handleSaveLabelsClick}
          disabled={isSaving}
        >
          {isSaving ? (
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
          Please upload a CSV file with{' '}
          <strong>{dataPoints.length} rows</strong> (+optionnally a header row)
          containing the following{' '}
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
        <Input
          type="file"
          name="file"
          id="label-file"
          innerRef={fileInput}
          style={{ textAlign: 'center' }}
          onChange={handleFileInputChange}
        />
        <br />
        {fileInput.current &&
          fileInput.current.files[0] &&
          !isLabelFileValid && (
            <Alert color="danger">
              The selected file is not valid: {labelFileError}
            </Alert>
          )}
        {fileInput.current && fileInput.current.files[0] && isLabelFileValid && (
          <>
            <Alert color="success">The selected file is valid!</Alert>
            <Button color="success" onClick={handleSaveLabelsClick}>
              Save Labels
            </Button>
          </>
        )}
      </Collapse>
    </>
  );
}
