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
  selectedLabelCategory
}) => {
  if (!collections || collections.length === 0) {
    return (
      <div className="text-center p-4">
        <p>No collections available for training.</p>
      </div>
    );
  }

  // Check if there are already trained models for the current configuration
  // Debug logging
  console.log('TrainingQueue Debug:', {
    models: models,
    modelsLength: models?.length,
    featureExtractionID,
    selectedLabelCategoryId: selectedLabelCategory?.id,
    modelStructure: models?.[0] ? Object.keys(models[0]) : 'No models'
  });

  // Since models passed to Train component are already filtered by Features.js 
  // for the current feature extraction and collection, we just need to check if any exist
  const hasTrainedModels = models && models.length > 0;

  console.log('HasTrainedModels:', hasTrainedModels);

  if (hasTrainedModels) {
    return (
      <div className="container-fluid px-0">
        <div className="row justify-content-center">
          <div className="col-12">
            <Alert color="info" className="mt-4">
              <FontAwesomeIcon icon="info-circle" className="me-2" />
              This model has already been trained. View details in the "All Models" tab.
            </Alert>
            <div className="d-flex justify-content-center mb-4">
              <Button
                color="primary"
                size="md"
                onClick={() => onTrainModel(collections[0])}
                disabled={isTraining}
              >
                <FontAwesomeIcon icon="redo" className="me-2" />
                {isTraining ? 'Retraining...' : ' Train Again'}
              </Button>
            </div>
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
