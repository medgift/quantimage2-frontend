import { Alert, Button, Collapse, Input, Label, Table } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';
import {
  CLINICAL_FEATURE_FIELDS,
  CLINICAL_FEATURE_TYPES,
  CLINICAL_FEATURE_ENCODING,
  CLINICAL_FEATURE_MISSING_VALUES,
} from '../config/constants';
import {
  validateClinicalFeaturesFile,
  parseClinicalFeatureNames,
  SelectColumnFilter,
} from '../utils/feature-utils.js';
import { FeatureTable } from '../components/FeatureTable';

import _ from 'lodash';

import './ClinicalFeatureTable.css';
import '../Features.css';

const PATIENT_ID = 'PatientID';

export default function ClinicalFeatureTable({
  dataPoints,
  albumID,
  clinicalFeaturesDefinitions,
  setClinicalFeaturesDefinitions,
  clinicalFeaturesValues,
  setClinicalFeaturesValues,
  clinicalFeaturesUniqueValues,
}) {
  let { keycloak } = useKeycloak();

  const [isSavingClinicalFeatures, setIsSavingClinicalFeatures] =
    useState(false);

  let [
    isClinicalFeaturesConfigurationOpen,
    setIsClinicalFeaturesConfigurationOpen,
  ] = useState(true);
  let [isImportClinicalFeaturesOpen, setIsImportClinicalFeaturesOpen] =
    useState(false);

  let [isClinicalFeatureFileValid, setIsClinicalFeatureFileValid] =
    useState(null);
  let [clinicalFeatureFileMessage, setClinicalFeatureFileMessage] =
    useState(null);
  let [filterClinicalFeatureMessages, setFilterClinicalFeatureMessages] =
    useState(null);
  let fileInput = useRef(null);

  // Format unique values for the definitions table
  const formattedUniqueValues = useMemo(() => {
    if (!clinicalFeaturesUniqueValues) return {};

    return Object.entries(clinicalFeaturesUniqueValues).reduce(
      (acc, [featureID, values]) => {
        acc[featureID] = values.join(' | ');

        return acc;
      },
      {}
    );
  }, [clinicalFeaturesUniqueValues]);

  const reactTableColumnsDefinitions = useMemo(() => {
    if (!clinicalFeaturesDefinitions || !clinicalFeaturesValues) return [];

    let featureColumns = Object.keys(clinicalFeaturesDefinitions).map(
      (featureName) => ({
        Header: featureName,
        accessor: featureName,
        disableFilters: true,
      })
    );

    return [
      {
        Header: 'Metadata',
        columns: [PATIENT_ID].map((field) => ({
          Header: field,
          accessor: field,
          Filter: SelectColumnFilter,
          filter: 'equals',
        })),
      },
      {
        Header: 'Features',
        columns: featureColumns,
      },
    ];
  }, [clinicalFeaturesDefinitions, clinicalFeaturesValues]);

  const formattedClinicalFeatureValues = useMemo(() => {
    if (!clinicalFeaturesValues) return [];

    return Object.entries(clinicalFeaturesValues).map(
      ([patientID, values]) => ({
        [PATIENT_ID]: patientID,
        ...values,
      })
    );
  }, [clinicalFeaturesValues]);

  const handleInputChange = (e, feature_name, feature_field) => {
    let clinicalFeatureDefinitionsToUpdate = {
      ...clinicalFeaturesDefinitions,
    };

    clinicalFeatureDefinitionsToUpdate[feature_name][feature_field] =
      e.target.value;

    // If feature type is changed, reset feature encoding & missing values as well
    if (feature_field === CLINICAL_FEATURE_FIELDS.TYPE) {
      clinicalFeatureDefinitionsToUpdate[feature_name][
        CLINICAL_FEATURE_FIELDS.ENCODING
      ] = getPossibleEncodings(e.target.value)[0];
      clinicalFeatureDefinitionsToUpdate[feature_name][
        CLINICAL_FEATURE_FIELDS.MISSING_VALUES
      ] = getPossibleMissingValues(e.target.value)[0];
    }

    setClinicalFeaturesDefinitions(clinicalFeatureDefinitionsToUpdate);
  };

  useEffect(() => {
    // If we have loaded the clinical features configuration and none exists, go to the import tab
    if (clinicalFeaturesDefinitions !== null) {
      if (Object.values(clinicalFeaturesDefinitions).length === 0) {
        if (!isImportClinicalFeaturesOpen) toggleFeaturesImportTab();
      }
    }
  }, [clinicalFeaturesDefinitions, isImportClinicalFeaturesOpen]);

  const toggleFeaturesConfigurationTab = () => {
    setIsClinicalFeaturesConfigurationOpen((open) => !open);
    setIsImportClinicalFeaturesOpen(false);
  };

  const toggleFeaturesImportTab = () => {
    setIsImportClinicalFeaturesOpen((open) => !open);
    setIsClinicalFeaturesConfigurationOpen(false);
  };

  const saveClinicalFeatures = async (definitions, values) => {
    await Backend.saveClinicalFeatureDefinitions(
      keycloak.token,
      definitions,
      albumID
    );

    if (values) {
      await Backend.saveClinicalFeatures(keycloak.token, values, albumID);
    }
  };

  const handleSaveClinicalFeaturesDefinitionsClick = async (e) => {
    setIsSavingClinicalFeatures(true);

    if (isImportClinicalFeaturesOpen) {
      toggleFeaturesConfigurationTab();
      setClinicalFeatureFileMessage(null);
      setIsClinicalFeatureFileValid(null);
      fileInput.current.value = '';
    }

    await saveClinicalFeatures(clinicalFeaturesDefinitions, null);

    // set the selected features in the visualization tab
    let clinicalFeatureName = {};
    for (let feature_name in clinicalFeaturesDefinitions) {
      clinicalFeatureName[feature_name] = {
        shortName: feature_name,
        id: feature_name,
        description: feature_name,
      };
    }
    setIsSavingClinicalFeatures(false);
  };

  const handleFileInputChange = async () => {
    let [isValid, message, clinicalFeatures] =
      await validateClinicalFeaturesFile(
        fileInput.current.files[0],
        dataPoints
      );

    // Reset valid messages or filter messages to ensure that it's not confusing if you upload a new file.
    setFilterClinicalFeatureMessages({});
    setClinicalFeatureFileMessage('');

    let clinicalFeaturesDefinitionsToSave = {};
    let clinicalFeaturesValuesToSave = {};

    if (isValid) {
      let filterMessages = {};
      let columnNames = await parseClinicalFeatureNames(
        fileInput.current.files[0]
      );
      let columnsToFilter = await Backend.filterClinicalFeatures(
        keycloak.token,
        clinicalFeatures
      );

      let allColumnsToFilter = _.uniq(Object.values(columnsToFilter).flat());

      // Filter out fields from clinical values
      clinicalFeaturesValuesToSave = Object.entries(clinicalFeatures).reduce(
        (acc, [patientID, values]) => {
          acc[patientID] = _.omit(values, allColumnsToFilter);

          return acc;
        },
        {}
      );

      let containsPatientID = columnNames.includes(PATIENT_ID);
      if (containsPatientID) {
        for (let columnName of columnNames) {
          if (columnName === PATIENT_ID || columnName.length === 0) {
            continue;
          }

          if (columnsToFilter['date_columns'].includes(columnName)) {
            filterMessages[columnName] =
              'as we do not support any date columns yet';
            continue;
          }

          if (columnsToFilter['too_little_data'].includes(columnName)) {
            filterMessages[columnName] =
              'because less than 10% of the patients have data for this feature';
            continue;
          }

          if (columnsToFilter['only_one_value'].includes(columnName)) {
            filterMessages[columnName] =
              'because only one value is present in the data';
            continue;
          }

          clinicalFeaturesDefinitionsToSave[columnName] = {
            [CLINICAL_FEATURE_FIELDS.TYPE]: Object.values(
              CLINICAL_FEATURE_TYPES
            )[0],
            [CLINICAL_FEATURE_FIELDS.ENCODING]: getPossibleEncodings(
              Object.values(CLINICAL_FEATURE_TYPES)[0]
            )[0],
            [CLINICAL_FEATURE_FIELDS.MISSING_VALUES]:
              CLINICAL_FEATURE_MISSING_VALUES.MODE,
          };
        }

        // Delete existing clinical feature definitions
        await Backend.deleteClinicalFeatureDefinitions(keycloak.token, albumID);

        let guessedClinicalFeatureDefinitions =
          await Backend.guessClinicalFeatureDefinitions(
            keycloak.token,
            clinicalFeatures
          );

        for (let featureName in guessedClinicalFeatureDefinitions) {
          if (featureName in clinicalFeaturesDefinitionsToSave) {
            clinicalFeaturesDefinitionsToSave[featureName] =
              guessedClinicalFeatureDefinitions[featureName];
          }
        }

        setClinicalFeaturesValues(clinicalFeaturesValuesToSave);
        setClinicalFeaturesDefinitions(clinicalFeaturesDefinitionsToSave);
        await saveClinicalFeatures(
          clinicalFeaturesDefinitionsToSave,
          clinicalFeaturesValuesToSave
        );
      } else {
        isValid = false;
        message = `Clinical Features file does not contain ${PATIENT_ID} column, please edit the file manually and try again - got ${columnNames.join(
          ', '
        )}`;
      }

      setFilterClinicalFeatureMessages(filterMessages);
      setIsClinicalFeatureFileValid(isValid);
      setClinicalFeatureFileMessage(message);
    }
  };

  const getPossibleEncodings = (featureType) => {
    if (featureType === CLINICAL_FEATURE_TYPES.CATEGORICAL) {
      return [
        CLINICAL_FEATURE_ENCODING.ONE_HOT_ENCODING,
        CLINICAL_FEATURE_ENCODING.ORDERED_CATEGORIES,
      ];
    } else {
      return [
        CLINICAL_FEATURE_ENCODING.NONE,
        CLINICAL_FEATURE_ENCODING.NORMALIZATION,
      ];
    }
  };

  const getPossibleMissingValues = (featureType) => {
    if (featureType === CLINICAL_FEATURE_TYPES.CATEGORICAL) {
      return [
        CLINICAL_FEATURE_MISSING_VALUES.MODE,
        CLINICAL_FEATURE_MISSING_VALUES.DROP,
        CLINICAL_FEATURE_MISSING_VALUES.NONE,
      ];
    } else {
      return [
        CLINICAL_FEATURE_MISSING_VALUES.MEDIAN,
        CLINICAL_FEATURE_MISSING_VALUES.MEAN,
        CLINICAL_FEATURE_MISSING_VALUES.DROP,
        CLINICAL_FEATURE_MISSING_VALUES.NONE,
      ];
    }
  };

  if (clinicalFeaturesDefinitions === null || clinicalFeaturesValues === null) {
    return (
      <>
        <FontAwesomeIcon icon="sync" spin={true} /> Loading...
      </>
    );
  }

  return (
    <>
      <p>
        <Button color="primary" onClick={toggleFeaturesConfigurationTab}>
          Clinical Feature Configuration
        </Button>{' '}
        <Button color="success" onClick={toggleFeaturesImportTab}>
          Import Clinical Features
        </Button>
      </p>
      <Collapse isOpen={isClinicalFeaturesConfigurationOpen}>
        <h4>Clinical Feature Configuration</h4>
        <Table className="table-fixed">
          <thead>
            <tr>
              <th>Clinical Feature</th>
              <th>Type</th>
              <th>Encoding</th>
              <th>Values</th>
              <th>Missing Values</th>
            </tr>
          </thead>
          <tbody>
            {clinicalFeaturesDefinitions &&
              Object.keys(clinicalFeaturesDefinitions).map((featureName) => (
                <tr key={featureName}>
                  <td>{featureName}</td>
                  <td>
                    <Input
                      type="select"
                      id="type_list"
                      name="type_list"
                      value={
                        clinicalFeaturesDefinitions[featureName][
                          CLINICAL_FEATURE_FIELDS.TYPE
                        ]
                      }
                      onChange={(event) =>
                        handleInputChange(
                          event,
                          featureName,
                          CLINICAL_FEATURE_FIELDS.TYPE
                        )
                      }
                    >
                      {Object.values(CLINICAL_FEATURE_TYPES).map(
                        (featureType) => (
                          <option key={featureType} value={featureType}>
                            {featureType}
                          </option>
                        )
                      )}
                      ;
                    </Input>
                  </td>
                  <td>
                    <Input
                      type="select"
                      id="encoding_list"
                      name="encoding_list"
                      value={
                        clinicalFeaturesDefinitions[featureName][
                          CLINICAL_FEATURE_FIELDS.ENCODING
                        ]
                      }
                      onChange={(event) =>
                        handleInputChange(
                          event,
                          featureName,
                          CLINICAL_FEATURE_FIELDS.ENCODING
                        )
                      }
                    >
                      {getPossibleEncodings(
                        clinicalFeaturesDefinitions[featureName][
                          CLINICAL_FEATURE_FIELDS.TYPE
                        ]
                      ).map((encodingType) => (
                        <option key={encodingType} value={encodingType}>
                          {encodingType}
                        </option>
                      ))}
                    </Input>
                  </td>
                  <td>{formattedUniqueValues[featureName]}</td>
                  <td>
                    <Input
                      type="select"
                      id="missing_value_list"
                      name="missing_value_list"
                      value={
                        clinicalFeaturesDefinitions[featureName][
                          CLINICAL_FEATURE_FIELDS.MISSING_VALUES
                        ]
                      }
                      onChange={(event) =>
                        handleInputChange(
                          event,
                          featureName,
                          CLINICAL_FEATURE_FIELDS.MISSING_VALUES
                        )
                      }
                    >
                      {getPossibleMissingValues(
                        clinicalFeaturesDefinitions[featureName][
                          CLINICAL_FEATURE_FIELDS.TYPE
                        ]
                      ).map((missingValueType) => (
                        <option key={missingValueType} value={missingValueType}>
                          {missingValueType}
                        </option>
                      ))}
                      ;
                    </Input>
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
        <Button
          color="success"
          onClick={handleSaveClinicalFeaturesDefinitionsClick}
          disabled={isSavingClinicalFeatures}
        >
          {isSavingClinicalFeatures ? (
            <>
              <FontAwesomeIcon icon="spinner" spin /> Saving Clinical Feature
              Configuration
            </>
          ) : (
            `Save Clinical Feature Configuration`
          )}
        </Button>
        <h4 className="mt-2">Clinical Feature Values</h4>
        <div className="features-table">
          <FeatureTable
            data={formattedClinicalFeatureValues}
            columns={reactTableColumnsDefinitions}
          />
        </div>
      </Collapse>

      <Collapse isOpen={isImportClinicalFeaturesOpen}>
        <p>
          Please upload a CSV file with one row per patient (+optionnally a
          header row) containing one column per clinical feature of interest.
          The system will try to automatically detect the type of each clinical
          feature and you will configure the encoding afterwards. Note: The
          system will delete existing features upon a new upload to ensure that
          data does not become corrupted.
        </p>
        <Label for="label-file" style={{ fontWeight: 'bold' }}>
          Upload CSV File{' '}
          <Alert color="warning">
            NOTE: If the file is valid - this will delete existing clinical
            features
          </Alert>
        </Label>
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
          isClinicalFeatureFileValid === false && (
            <Alert color="danger">
              The selected file is not valid: {clinicalFeatureFileMessage}
            </Alert>
          )}
        {fileInput.current &&
          fileInput.current.files[0] &&
          isClinicalFeatureFileValid && (
            <>
              <Alert color="success">
                The selected file is valid: {clinicalFeatureFileMessage} -
                Please go to Clinical Feature Configuration Tab to configure the
                encoding of each feature.
              </Alert>
            </>
          )}
        {fileInput.current &&
          fileInput.current.files[0] &&
          isClinicalFeatureFileValid &&
          Object.keys(filterClinicalFeatureMessages).length > 0 && (
            <>
              {Object.keys(filterClinicalFeatureMessages).map((columnName) => (
                <Alert color="success" key={columnName}>
                  {columnName} was removed{' '}
                  {filterClinicalFeatureMessages[columnName]}.
                </Alert>
              ))}
            </>
          )}
      </Collapse>
    </>
  );
}
