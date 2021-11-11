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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DataLabels from './components/DataLabels';
import React, { useState } from 'react';
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
  selectedLabelCategory,
  setSelectedLabelCategory,
  labelCategories,
  setLabelCategories,
  setOutcomes,
  setFeaturesChart,
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
  const [isEditingOutcome, setIsEditingOutcome] = useState(false);

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
  const handleOutcomeChange = async (e) => {
    let selectedOutcome = labelCategories.find((c) => c.id === +e.target.value);
    await saveCurrentOutcome(selectedOutcome ? selectedOutcome : null);
    setSelectedLabelCategory(selectedOutcome);
  };

  // Toggle outcome creation modal
  const toggleOutcomeModal = () => {
    setOutcomeModalOpen((o) => {
      setNewOutcomeType(MODEL_TYPES.CLASSIFICATION);
      setNewOutcomeName('');
      setIsEditingOutcome(false);
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

    // Select the new label category as the active one
    await saveCurrentOutcome(newLabelCategory);

    toggleOutcomeModal();
  };

  const handleEditOutcomeSubmit = async (e) => {
    e.preventDefault();

    let updatedLabelCategory = await Backend.editLabelCategory(
      keycloak.token,
      selectedLabelCategory.id,
      newOutcomeName
    );

    // Update category name in the list of label categories
    let categoryToUpdateIndex = labelCategories.findIndex(
      (c) => c.id === updatedLabelCategory.id
    );
    let categories = [...labelCategories];
    categories[categoryToUpdateIndex] = updatedLabelCategory;
    setLabelCategories(categories);

    setSelectedLabelCategory(updatedLabelCategory);

    toggleOutcomeModal();
  };

  // Handle editing current outcome
  const handleEditOutcomeClick = async () => {
    toggleOutcomeModal();
    setIsEditingOutcome(true);
    setNewOutcomeName(selectedLabelCategory.name);
    setNewOutcomeType(selectedLabelCategory.label_type);
  };

  // Handle deleting an outcome
  const handleDeleteOutcomeClick = async () => {
    let categoryToDelete = selectedLabelCategory;

    await Backend.deleteLabelCategory(keycloak.token, categoryToDelete.id);

    let categoryToRemoveIndex = labelCategories.findIndex(
      (c) => c.id === categoryToDelete.id
    );
    let categories = [...labelCategories];
    categories.splice(categoryToRemoveIndex, 1);
    setLabelCategories(categories);

    setSelectedLabelCategory(null);
  };

  if (labelCategories === null) return <div>Loading...</div>;

  const saveCurrentOutcome = async (outcome) => {
    await Backend.saveCurrentOutcome(
      keycloak.token,
      albumID,
      outcome ? outcome.id : null
    );
    setSelectedLabelCategory(outcome);

    /* TODO - Improve this part, these manual calls are not so elegant */
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
          <Label for="outcomeList">Select the current Outcome</Label>
          <InputGroup>
            <Input
              type="select"
              id="outcomeList"
              name="outcomeList"
              value={selectedLabelCategory ? selectedLabelCategory.id : ''}
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
            {selectedLabelCategory && (
              <>
                <InputGroupAddon addonType="append">
                  <Button color="success" onClick={handleEditOutcomeClick}>
                    <FontAwesomeIcon icon="pencil-alt" title="Edit Outcome" />
                  </Button>
                </InputGroupAddon>
                <InputGroupAddon addonType="append">
                  <Button color="danger" onClick={handleDeleteOutcomeClick}>
                    <FontAwesomeIcon icon="trash-alt" title="Delete Outcome" />
                  </Button>
                </InputGroupAddon>
              </>
            )}
          </InputGroup>
        </FormGroup>
      )}
      {selectedLabelCategory && (
        <>
          <DataLabels
            albumID={albumID}
            dataPoints={dataPoints}
            isTraining={isTraining}
            isSavingLabels={isSavingLabels}
            setIsSavingLabels={setIsSavingLabels}
            dataLabels={formattedDataLabels}
            updateCurrentLabels={updateCurrentLabels}
            selectedLabelCategory={selectedLabelCategory}
            setSelectedLabelCategory={setSelectedLabelCategory}
            setLabelCategories={setLabelCategories}
            setOutcomes={setOutcomes}
            setFeaturesChart={setFeaturesChart}
            featureExtractionID={featureExtractionID}
            outcomeColumns={
              selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
                ? CLASSIFICATION_OUTCOMES
                : SURVIVAL_OUTCOMES
            }
            validateLabelFile={(file, dataPoints, updateCurrentLabels) =>
              validateLabelFile(
                file,
                dataPoints,
                updateCurrentLabels,
                selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
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
        title={isEditingOutcome ? 'Edit outcome' : 'Create a new outcome'}
      >
        <Form
          onSubmit={
            isEditingOutcome
              ? handleEditOutcomeSubmit
              : handleCreateOutcomeSubmit
          }
        >
          <FormGroup>
            <Label for="newOutcomeName">Outcome Name</Label>
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
            <Label for="newOutcomeType">Outcome Type</Label>
            <Input
              type="select"
              id="outcome-type"
              name="outcome-type"
              value={newOutcomeType}
              onChange={handleOutcomeTypeChange}
              disabled={isEditingOutcome}
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
            {isEditingOutcome ? 'Save Outcome' : 'Create New Outcome'}
          </Button>
        </Form>
      </MyModal>
    </>
  );
}

function OutcomeCreateEditModal(isEdit) {}

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
