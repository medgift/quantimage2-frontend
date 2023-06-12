import React, { useState } from 'react';
import Select from 'react-select';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap';
import { Alert } from 'reactstrap';
import { useKeycloak } from '@react-keycloak/web';
import ClinicalFeatureTable from './components/ClinicalFeatureTable';
import { DataLabelsType } from './components/DataLabels';
import { CLINICAL_FEATURES } from './config/constants';
import { validateLabelOrClinicalFeaturesFile } from './utils/feature-utils.js';

import './ClinicalFeatures.css';


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

  const [tableData, setTableData] = useState([
    { id: 1, column1: 'Value 1', column2: 'Value 2', column3: 'Value 3' },
    { id: 2, column1: 'Value 4', column2: 'Value 5', column3: 'Value 6' },
    // Add more data rows as needed
  ]);

  const handleCellChange = (e, id, columnName) => {
    const updatedData = tableData.map(row => {
      if (row.id === id) {
        return { ...row, [columnName]: e.target.innerText };
      }
      return row;
    });
    setTableData(updatedData);
  };

  const handleSelectChange = (selectedOption, id) => {
    const updatedData = tableData.map(row => {
      if (row.id === id) {
        return { ...row, column3: selectedOption.value };
      }
      return row;
    });
    setTableData(updatedData);
  };

  const options = [
    { value: 'One-hot encoding', label: 'One-hot encoding' },
    { value: 'Number', label: 'Number' },
    { value: 'Category', label: 'Category' },
    { value: 'Ordered Category', label: 'Ordered Category' },
  ];

  return (
    <>
      <h3>Clinical Features</h3>
      <div className="container">
        <table>
          <thead className="table-cell">
            <tr>
              <th>Feature Name</th>
              <th>Data Type</th>
              <th>Encoding</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map(row => (
              <tr key={row.id}>
                <td
                  contentEditable

                  suppressContentEditableWarning
                  onBlur={e => handleCellChange(e, row.id, 'column1')}
                  className="table-cell"
                >
                  {row.column1}
                </td>
                <td
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => handleCellChange(e, row.id, 'column2')}
                  className="table-cell"
                >
                  {row.column2}
                </td>
                <td>
                  <Select
                    options={options}
                    value={{ value: row.column3, label: row.column3 }}
                    onChange={selectedOption => handleSelectChange(selectedOption, row.id)}
                    className="select_button"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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