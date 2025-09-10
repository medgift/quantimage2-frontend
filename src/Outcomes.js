import {
  Alert,
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
import {
  CLASSIFICATION_OUTCOMES,
  MODEL_TYPES,
  SURVIVAL_OUTCOMES,
} from './config/constants';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';
import MyModal from './components/MyModal';
import { validateLabelFile } from './utils/feature-utils.js';

const areAllDefaultValues = (outcomes) => {
  if (!outcomes || outcomes.length === 0) return false;

  return outcomes.every((outcome) => {
    // Check if label_content exists
    if (outcome.label_content) {
      // Classification: check Outcome field
      if (outcome.label_content.Outcome) {
        return outcome.label_content.Outcome === 'Undefined';
      }
      // Survival: check both Event and Time fields
      if (outcome.label_content.Event && outcome.label_content.Time) {
        return (
          outcome.label_content.Event === 'Undefined' &&
          outcome.label_content.Time === 'Undefined'
        );
      }
    }
    return false;
  });
};

// Add new function to check for partial updates
const hasSomeDefaultValues = (outcomes) => {
  if (!outcomes || outcomes.length === 0) return false;

  const defaultCount = outcomes.filter((outcome) => {
    if (outcome.label_content) {
      // Classification: check Outcome field
      if (outcome.label_content.Outcome) {
        return outcome.label_content.Outcome === 'Undefined';
      }
      // Survival: check both Event and Time fields
      if (outcome.label_content.Event && outcome.label_content.Time) {
        return (
          outcome.label_content.Event === 'Undefined' &&
          outcome.label_content.Time === 'Undefined'
        );
      }
    }
    return false;
  }).length;

  // Return true if some (but not all) values are default
  return defaultCount > 0 && defaultCount < outcomes.length;
};

export default function Outcomes({
  albumID,
  featureExtractionID,
  isSavingLabels,
  setIsSavingLabels,
  dataPoints,
  outcomes,
  selectedLabelCategory,
  setSelectedLabelCategory,
  labelCategories,
  setLabelCategories,
  setFeaturesChart,
  updateExtractionOrCollection,
}) {
  const { keycloak } = useKeycloak();

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

  // Handle outcome selection
  const handleOutcomeChange = async (e) => {
    let selectedOutcome = labelCategories.find((c) => c.id === +e.target.value);
    await saveCurrentOutcome(selectedOutcome ? selectedOutcome : null);
    setSelectedLabelCategory(selectedOutcome ? selectedOutcome : null);
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

      {/* Alert for all default values */}
      {selectedLabelCategory && outcomes && areAllDefaultValues(outcomes) && (
        <Alert color="danger" className="mb-3">
          <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
          <strong>Outcomes set as Undefined. Please upload a .csv file using the "Import Labels"
             button with {selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION 
            ? 'real outcome values' 
            : 'real event and time values'
          }.</strong>
        </Alert>
      )}

      {/* Alert for partial default values */}
      {selectedLabelCategory && outcomes && hasSomeDefaultValues(outcomes) && (
        <Alert color="danger" className="mb-3">
          <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
          <strong>Some patients still have Undefined values. </strong>  
          Please update all patient {selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION 
            ? 'outcomes' 
            : 'event and time values'
          } or remove incomplete entries before training the model.
        </Alert>
      )}

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
                No Outcome Selected
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
            isSavingLabels={isSavingLabels}
            setIsSavingLabels={setIsSavingLabels}
            selectedLabelCategory={selectedLabelCategory}
            setSelectedLabelCategory={setSelectedLabelCategory}
            setLabelCategories={setLabelCategories}
            outcomes={outcomes}
            setFeaturesChart={setFeaturesChart}
            featureExtractionID={featureExtractionID}
            outcomeColumns={
              selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
                ? CLASSIFICATION_OUTCOMES
                : SURVIVAL_OUTCOMES
            }
            validateLabelFile={(file, dataPoints) =>
              validateLabelFile(
                file,
                dataPoints,
                selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
                  ? CLASSIFICATION_OUTCOMES
                  : SURVIVAL_OUTCOMES
              )
            }
            updateExtractionOrCollection={updateExtractionOrCollection}
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
