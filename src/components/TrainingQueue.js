import React from 'react';
import { Button, Table, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const TrainingQueue = ({ 
  collections, 
  onTrainModel, 
  isTraining, 
  trainingProgress,
  models = [],
  featureExtractionID,
  selectedLabelCategory,
  onNavigateToModels,
  dataSplittingType,
  patients
}) => {
  if (!collections || collections.length === 0) {
    return (
      <div className="text-center p-4">
        <p>No collections available for training.</p>
      </div>
    );
  }

  

  // Check if there's a model with the current outcome AND same train/test patient split
  const hasMatchingModel = models && models.length > 0 && models.some(model => {
    // Must match outcome
    const outcomeMatch = model.label_category === selectedLabelCategory?.name;
    if (!outcomeMatch) return false;
    
    // Must match data splitting type
    const splittingTypeMatch = model.data_splitting_type === dataSplittingType;
    if (!splittingTypeMatch) return false;
    
    // If using train/test split, must match the exact same patient IDs in train and test sets
    if (dataSplittingType === 'traintest' && patients) {
      const currentTrainingIds = patients.training || [];
      const currentTestIds = patients.test || [];
      const modelTrainingIds = model.training_patient_ids || [];
      const modelTestIds = model.test_patient_ids || [];
      
      // Check if the sets are identical (same patients in same groups)
      const trainingMatch = 
        currentTrainingIds.length === modelTrainingIds.length &&
        currentTrainingIds.every(id => modelTrainingIds.includes(id));
      
      const testMatch = 
        currentTestIds.length === modelTestIds.length &&
        currentTestIds.every(id => modelTestIds.includes(id));
      
      return trainingMatch && testMatch;
    }
    
    // For full dataset, only outcome and splitting type matter
    return true;
  });


  if (hasMatchingModel) {
    return (
      <div className="container-fluid px-0">
        <div className="row justify-content-center">
          <div className="col-12">
            <Alert color="info" className="mt-4 d-flex justify-content-between align-items-center">
              <div>
                <FontAwesomeIcon icon="info-circle" className="me-2" />
                 This model is trained. View details in the "Model Evaluation" tab.
              </div>
              <div className="d-flex">
  {onNavigateToModels && (
    <Button
      color="primary"
      size="sm"
      onClick={onNavigateToModels}
      className="mr-3"
    >
      Go to Model Evaluation
    </Button>
  )}
  <Button
    color="primary"
    size="sm"
    onClick={() => onTrainModel(collections[0])}
    disabled={isTraining}
  >
    {isTraining ? 'Retraining...' : 'Train Again'}
  </Button>
</div>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Table striped responsive>
      <thead>
        <tr>
          <th>Collection</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {collections.map((collection, index) => (
          <tr key={collection.id || index}>
            <td>{collection.name || `Collection ${index + 1}`}</td>
            <td>
              <span className="badge badge-secondary">
                Ready for Training
              </span>
            </td>
            <td>
              <Button
                color="primary"
                size="sm"
                onClick={() => onTrainModel(collection)}
                disabled={isTraining}
              >
                {isTraining ? (
                  <>
                    <FontAwesomeIcon icon="spinner" spin className="mr-2" />
                    Training...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon="play" className="mr-2" />
                    Train Model
                  </>
                )}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default TrainingQueue;
