import {
  Button,
  Form,
  FormGroup,
  FormText,
  Input,
  InputGroup,
  InputGroupAddon,
  Label,
} from 'reactstrap';
import DataLabels from './components/DataLabels';
import React, { useEffect, useState } from 'react';
import { MODEL_TYPES } from './Features';
import * as detectNewline from 'detect-newline';
import * as csvString from 'csv-string';
import * as parse from 'csv-parse/lib/sync';
import Backend from './services/backend';
import { useKeycloak } from 'react-keycloak';
import MyModal from './components/MyModal';

export const CLASSIFICATION_OUTCOMES = ['Outcome'];
export const SURVIVAL_OUTCOMES = ['Time', 'Event'];

export default function Outcomes({
  albumID,
  dataPoints,
  isTraining,
  isSavingLabels,
  setIsSavingLabels,
  activeLabelCategory,
  activeLabelCategoryID,
  setActiveLabelCategoryID,
  labelCategories,
  setLabelCategories,
  setLasagnaData,
  featureExtractionID,
  updateCurrentLabels,
  formattedDataLabels,
}) {
  const [keycloak] = useKeycloak();

  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [newOutcomeName, setNewOutcomeName] = useState('');
  const [newOutcomeType, setNewOutcomeType] = useState(
    MODEL_TYPES.CLASSIFICATION
  );

  const [selectedOutcome, setSelectedOutcome] = useState(null);

  useEffect(() => {
    if (labelCategories && activeLabelCategory)
      setSelectedOutcome(activeLabelCategory);
  }, [labelCategories, activeLabelCategory]);

  // Handle outcome type change
  const handleOutcomeTypeChange = (e) => {
    setNewOutcomeType(e.target.value);
  };

  // Handle outcome name change
  const handleOutcomeNameChange = (e) => {
    setNewOutcomeName(e.target.value);
  };

  // Handle outcome creation
  const handleCreateOutcomeClick = (e) => {
    toggleOutcomeModal();
  };

  // Handle outcome seleciton
  const handleOutcomeChange = (e) => {
    setSelectedOutcome(labelCategories.find((c) => c.id === +e.target.value));
  };

  // Toggle outcome creation modal
  const toggleOutcomeModal = () => {
    setOutcomeModalOpen((o) => {
      setNewOutcomeType(MODEL_TYPES.CLASSIFICATION);
      setNewOutcomeName('');
      return !o;
    });
  };

  // Handle create outcome form submission
  const handleCreateOutcomeSubmit = async (e) => {
    e.preventDefault();

    let newLabelCategory = await Backend.saveLabelCategory(
      keycloak.token,
      albumID,
      newOutcomeType,
      newOutcomeName
    );

    setLabelCategories((c) => [...c, newLabelCategory]);
    toggleOutcomeModal();
  };

  // Handle setting current outcome
  const handleSetCurrentClick = async (e) => {
    if (selectedOutcome) {
      await Backend.saveCurrentOutcome(
        keycloak.token,
        albumID,
        selectedOutcome.id
      );
      setActiveLabelCategoryID(selectedOutcome.id);
    }
  };

  if (labelCategories === null) return <div>Loading...</div>;

  const classificationCategories = labelCategories.filter(
    (c) => c.label_type === MODEL_TYPES.CLASSIFICATION
  );
  const survivalCategories = labelCategories.filter(
    (c) => c.label_type === MODEL_TYPES.SURVIVAL
  );

  return (
    <>
      <h3>Patient Outcomes</h3>
      {labelCategories.length === 0 && (
        <p>
          No outcomes have been created yet, click on the button below to get
          started.
        </p>
      )}
      <Button color="primary" onClick={handleCreateOutcomeClick}>
        Create New Outcome
      </Button>
      {labelCategories.length > 0 && (
        <FormGroup>
          <Label for="outcomeList">Select an Outcome</Label>
          <InputGroup>
            <Input
              type="select"
              id="outcomeList"
              name="outcomeList"
              value={selectedOutcome ? selectedOutcome.id : ''}
              onChange={handleOutcomeChange}
            >
              <option key="EMPTY" value="">
                --Select an outcome from the list--
              </option>
              {classificationCategories.length > 0 && (
                <optgroup label={MODEL_TYPES.CLASSIFICATION}>
                  {classificationCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {survivalCategories.length > 0 && (
                <optgroup label={MODEL_TYPES.SURVIVAL}>
                  {survivalCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Input>
            <InputGroupAddon addonType="append">
              <Button color="success" onClick={handleSetCurrentClick}>
                Set as Current
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </FormGroup>
      )}
      {activeLabelCategory && (
        <>
          <DataLabels
            albumID={albumID}
            dataPoints={dataPoints}
            isTraining={isTraining}
            isSavingLabels={isSavingLabels}
            setIsSavingLabels={setIsSavingLabels}
            dataLabels={formattedDataLabels}
            updateCurrentLabels={updateCurrentLabels}
            labelType={activeLabelCategory.label_type}
            activeLabelCategoryID={activeLabelCategoryID}
            setLabelCategories={setLabelCategories}
            setLasagnaData={setLasagnaData}
            featureExtractionID={featureExtractionID}
            outcomeColumns={
              activeLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
                ? CLASSIFICATION_OUTCOMES
                : SURVIVAL_OUTCOMES
            }
            validateLabelFile={(file, dataPoints, updateCurrentLabels) =>
              validateLabelFile(
                file,
                dataPoints,
                updateCurrentLabels,
                activeLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
                  ? CLASSIFICATION_OUTCOMES
                  : SURVIVAL_OUTCOMES
              )
            }
          />
        </>
      )}
      <MyModal
        isOpen={outcomeModalOpen}
        toggle={toggleOutcomeModal}
        title="Create a new outcome"
      >
        <Form onSubmit={handleCreateOutcomeSubmit}>
          <FormGroup>
            <Label for="newOutcomeName">New Outcome Name</Label>
            <Input
              type="text"
              id="newOutcomeName"
              placeholder="Outcome Name"
              required
              value={newOutcomeName}
              onChange={handleOutcomeNameChange}
            />
          </FormGroup>
          <FormGroup>
            <Label for="newOutcomeType">New Outcome Type</Label>
            <Input
              type="select"
              id="outcome-type"
              name="outcome-type"
              value={newOutcomeType}
              onChange={handleOutcomeTypeChange}
            >
              {Object.keys(MODEL_TYPES).map((key) => (
                <option key={key} value={MODEL_TYPES[key]}>
                  {MODEL_TYPES[key]}
                </option>
              ))}
            </Input>
            <FormText color="muted">
              Select whether this outcome will be used for classification or
              survival tasks.
            </FormText>
          </FormGroup>
          <Button color="primary" type="submit">
            Create New Outcome
          </Button>
        </Form>
      </MyModal>
    </>
  );
}

function validateFileType(file) {
  /* Validate metadata - file type */
  if (
    ![
      'text/csv',
      'text/comma-separated-values',
      'text/tab-separated-values',
      'application/csv',
      'application/x-csv',
    ].includes(file.type)
  ) {
    if (
      file.type === 'application/vnd.ms-excel' &&
      file.name.endsWith('.csv')
    ) {
      // Ok, Windows sends strange MIME type
      return true;
    } else {
      return false;
    }
  }

  return true;
}

async function validateLabelFile(
  file,
  dataPoints,
  updateCurrentLabels,
  headerFieldNames
) {
  console.log(file);
  let valid = false;
  let error = null;

  /* Validate file type */
  let fileTypeIsValid = validateFileType(file);

  if (!fileTypeIsValid) {
    error = 'The file is not a CSV file!';
    return [valid, error];
  }

  /* Validate file content */
  const content = await file.text();

  let nbMatches = 0;

  try {
    /* Add PatientID to the header field names (should always exist) */
    let fullHeaderFieldNames = ['PatientID', ...headerFieldNames];
    console.log('full header field names', fullHeaderFieldNames);

    let lineEnding = detectNewline(content);

    let firstLine = content.split(lineEnding)[0];

    let separator = csvString.detect(firstLine);

    let headerFields = firstLine.split(separator);

    let hasHeader =
      headerFields.length === fullHeaderFieldNames.length &&
      fullHeaderFieldNames.every((fieldName) =>
        headerFields.includes(fieldName)
      );

    let columns = hasHeader ? true : fullHeaderFieldNames;

    const records = parse(content, {
      columns: columns,
      skip_empty_lines: true,
    });

    // Match rows to data points
    console.log(dataPoints);

    let labels = {};

    for (let patientID of dataPoints) {
      let matchingRecord = records.find(
        (record) => record.PatientID === patientID
      );

      if (matchingRecord) {
        nbMatches++;

        // Fill labelCategories
        const { PatientID, ...recordContent } = matchingRecord;
        labels[PatientID] = recordContent;
      }
    }

    if (nbMatches === 0) {
      error = `The CSV file matched none of the patients!`;
      return [valid, error];
    } else {
      updateCurrentLabels(labels);
    }
  } catch (e) {
    error = 'The CSV file could not be parsed, check its format!';
    return [valid, error];
  }

  valid = true;
  return [valid, `The CSV matched ${nbMatches}/${dataPoints.length} patients.`];
}
