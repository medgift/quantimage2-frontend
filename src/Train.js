import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Button, ListGroup, ListGroupItem } from 'reactstrap';

import './Train.css';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';

import Kheops from './services/kheops';
import { trainModel } from './utils/feature-utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import MyModal from './components/MyModal';
import {
  MODEL_TYPES,
  DATA_SPLITTING_TYPES,
  TRAINING_PHASES,
  CLASSIFICATION_COLUMNS,
  SURVIVAL_COLUMNS,
} from './config/constants';
import ModelsTable from './components/ModelsTable';
import SocketContext from './context/SocketContext';

export const PATIENT_ID_FIELD = 'PatientID';
export const ROI_FIELD = 'ROI';
export const MODALITY_FIELD = 'Modality';
export const NON_FEATURE_FIELDS = [PATIENT_ID_FIELD, MODALITY_FIELD, ROI_FIELD];

const CLASSIFICATION_ALGORITHMS = {
  LOGISTIC_REGRESSION: 'logistic_regression',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm',
};

const SURVIVAL_ALGORITHMS = {
  COX_MODEL: 'cox',
  COX_MODEL_ELASTIC: 'cox_elastic',
  IPC: 'ipc',
};

export default function Train({
  album,
  albumExtraction,
  collectionInfos,
  metadataColumns,
  featureExtractionID,
  dataPoints,
  unlabelledDataPoints,
  outcomes,
  selectedLabelCategory,
  labelCategories,
  models,
  setModels,
  dataSplittingType,
  trainTestSplitType,
  trainingPatients,
  testPatients,
}) {
  let { keycloak } = useKeycloak();

  let [currentAlgorithm, setCurrentAlgorithm] = useState(null);
  let [algorithmDetailsOpen, setAlgorithmDetailsOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);
  let [currentTrainingID, setCurrentTrainingID] = useState(null);
  let [nSteps, setNSteps] = useState(0);
  let [currentPhase, setCurrentPhase] = useState(TRAINING_PHASES.TRAINING);
  let [currentStep, setCurrentStep] = useState(0);

  let [trainingError, setTrainingError] = useState(null);

  let [showNewModel, setShowNewModel] = useState(false);

  let socket = useContext(SocketContext);

  // Model table header
  const columnsClassification = React.useMemo(() => CLASSIFICATION_COLUMNS, []);
  const columnsSurvival = React.useMemo(() => SURVIVAL_COLUMNS, []);

  const reinitTraining = () => {
    setIsTraining(false);
    setCurrentTrainingID(null);
    setNSteps(0);
    setCurrentPhase(TRAINING_PHASES.TRAINING);
    setCurrentStep(0);
  };

  const handleTrainingStatus = useCallback(
    (trainingStatus) => {
      const trainingID = trainingStatus['training-id'];
      console.log(`STATUS for Training ${trainingID} !!!`, trainingStatus);

      if (trainingID === currentTrainingID) {
        if (trainingStatus.complete) {
          reinitTraining();
          setModels([trainingStatus.model, ...models]);
          setShowNewModel(false);
        } else {
          if (trainingStatus.phase === TRAINING_PHASES.TESTING) {
            setCurrentPhase(TRAINING_PHASES.TESTING);
            setNSteps(trainingStatus.total);
            setCurrentStep(trainingStatus.current);
          } else {
            setCurrentStep((s) => s + 1);
          }
        }
      }
    },
    [models, setModels, currentTrainingID]
  );

  // Subscribe to Socket messages
  useEffect(() => {
    if (!currentTrainingID) return;

    socket.on('training-status', handleTrainingStatus);

    return () => {
      socket.off('training-status', handleTrainingStatus);
    };
  }, [socket, handleTrainingStatus, currentTrainingID]);

  const toggleAlgorithmDetails = (algorithm) => {
    setAlgorithmDetailsOpen((o) => !o);
    if (!algorithm) setCurrentAlgorithm(null);
    else setCurrentAlgorithm(algorithm);
  };

  const transformLabelsToTabular = (outcomes) => {
    let tabularLabels = [];

    for (let outcome of outcomes) {
      let tabularLabel = [
        outcome.patient_id,
        ...Object.values(outcome.label_content),
      ];

      tabularLabels.push(tabularLabel);
    }

    return tabularLabels;
  };

  // Handle model train click
  const handleTrainModelClick = async () => {
    setIsTraining(true);
    setTrainingError(null);

    try {
      let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

      // Turn labels into a tabular format for Melampus [ [PatientID,Outcome], ... ]
      // or [ [PatientID,Time,Event], ... ]
      let labels = transformLabelsToTabular(outcomes);

      let { trainingID, nSteps } = await trainModel(
        featureExtractionID,
        collectionInfos ? collectionInfos.collection.id : null,
        selectedLabelCategory.id,
        albumStudies,
        album,
        labels,
        dataSplittingType,
        trainTestSplitType,
        trainingPatients ? trainingPatients : dataPoints,
        testPatients,
        metadataColumns[MODALITY_FIELD],
        metadataColumns[ROI_FIELD],
        keycloak.token
      );

      setCurrentTrainingID(trainingID);
      setNSteps(nSteps);
    } catch (e) {
      reinitTraining();
      setTrainingError(e.message);
    }
  };

  const handleDeleteModelClick = async (id) => {
    await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter((model) => model.id !== id));
  };

  const handleShowNewModelClick = () => {
    setShowNewModel(true);
  };

  const handleBackToModelsClick = () => {
    setShowNewModel(false);
  };

  if (!album) return <span>Loading...</span>;

  //let album = albums.find((a) => a.album_id === albumID);

  let trainingButton = () => {
    let buttonText = isTraining
      ? currentPhase === TRAINING_PHASES.TRAINING
        ? 'Training Model'
        : 'Testing Model'
      : dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET
      ? 'Train Model'
      : 'Train & Test Model';

    if (nSteps > 0 && currentStep > 0) {
      buttonText += ` (${Math.floor((currentStep / nSteps) * 100)}%)`;
    }

    if (isTraining) buttonText += '...';

    return (
      <Button
        color="info"
        onClick={handleTrainModelClick}
        disabled={isTraining}
      >
        <>
          {isTraining && (
            <>
              <FontAwesomeIcon icon="spinner" spin />{' '}
            </>
          )}
          <span>{buttonText}</span>
        </>
      </Button>
    );
  };

  let newModelForm = () => (
    <div>
      <h2>
        Train a new <strong>{selectedLabelCategory.label_type}</strong> model on
        album "{album.name}"
        {collectionInfos ? (
          <span>
            , collection <strong>"{collectionInfos.collection.name}"</strong>
          </span>
        ) : null}{' '}
        using current outcome <strong>"{selectedLabelCategory.name}"</strong>
      </h2>
      <h4>Model Parameters</h4>
      {selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION && (
        <>
          <h5>Classification Algorithms</h5>
          <div>The following classification algorithms will be explored</div>
          <ListGroup horizontal={true} className="justify-content-center">
            <ListGroupItem>
              <a
                href="https://en.wikipedia.org/wiki/Logistic_regression"
                target="_blank"
                rel="noreferrer"
              >
                Logistic Regression
              </a>
              <br />
              <div>
                <Button
                  color="link"
                  onClick={() =>
                    toggleAlgorithmDetails(
                      CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION
                    )
                  }
                >
                  <small>+ Parameters</small>
                </Button>
              </div>
            </ListGroupItem>
            <ListGroupItem>
              <a
                href="https://en.wikipedia.org/wiki/Support-vector_machine"
                target="_blank"
                rel="noreferrer"
              >
                Support-Vector Machines
              </a>
              <br />
              <div>
                <Button
                  color="link"
                  onClick={() =>
                    toggleAlgorithmDetails(CLASSIFICATION_ALGORITHMS.SVM)
                  }
                >
                  <small>+ Parameters</small>
                </Button>
              </div>
            </ListGroupItem>
            <ListGroupItem>
              <a
                href="https://en.wikipedia.org/wiki/Random_forest"
                target="_blank"
                rel="noreferrer"
              >
                Random Forest
              </a>
              <br />
              <div>
                <Button
                  color="link"
                  onClick={() =>
                    toggleAlgorithmDetails(
                      CLASSIFICATION_ALGORITHMS.RANDOM_FOREST
                    )
                  }
                >
                  <small>+ Parameters</small>
                </Button>
              </div>
            </ListGroupItem>
          </ListGroup>
        </>
      )}
      {selectedLabelCategory.label_type === MODEL_TYPES.SURVIVAL && (
        <>
          <h5>Survival Analysis Algorithms</h5>
          <div>The following survival analysis algorithms will be explored</div>
          <ListGroup horizontal={true} className="justify-content-center">
            <ListGroupItem>
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.CoxPHSurvivalAnalysis.html"
                target="_blank"
                rel="noreferrer"
              >
                Cox Proportional Hazards Model
              </a>
              <br />
              <Button
                color="link"
                onClick={() =>
                  toggleAlgorithmDetails(SURVIVAL_ALGORITHMS.COX_MODEL)
                }
              >
                <small>+ Parameters</small>
              </Button>
            </ListGroupItem>
            <ListGroupItem>
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.CoxnetSurvivalAnalysis.html"
                target="_blank"
                rel="noreferrer"
              >
                Cox Proportional Hazards Model with Elastic Net Penalty
              </a>
              <br />
              <Button
                color="link"
                onClick={() =>
                  toggleAlgorithmDetails(SURVIVAL_ALGORITHMS.COX_MODEL_ELASTIC)
                }
              >
                <small>+ Parameters</small>
              </Button>
            </ListGroupItem>
            <ListGroupItem>
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.IPCRidge.html"
                target="_blank"
                rel="noreferrer"
              >
                Accelerated failure time model with inverse probability of
                censoring weights
              </a>
              <br />
              <Button
                color="link"
                onClick={() => toggleAlgorithmDetails(SURVIVAL_ALGORITHMS.IPC)}
              >
                <small>+ Parameters</small>
              </Button>
            </ListGroupItem>
          </ListGroup>
        </>
      )}
      <h5 className="mt-3">Data Normalization Algorithms</h5>
      <div>The following data standardization techniques will be explored</div>
      <ListGroup horizontal={true} className="justify-content-center">
        <ListGroupItem>
          <a
            href="https://en.wikipedia.org/wiki/Standard_score"
            target="_blank"
            rel="noreferrer"
          >
            Standardization
          </a>
        </ListGroupItem>
        <ListGroupItem>
          <a
            href="https://en.wikipedia.org/wiki/Norm_(mathematics)#p-norm"
            target="_blank"
            rel="noreferrer"
          >
            L2 Normalization
          </a>
        </ListGroupItem>
      </ListGroup>
      <hr />
      <div>
        <h4>Model Validation</h4>
        <div>
          {dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET ? (
            <p>
              All the available features & patients will be used to train the
              model. A stratified K-fold cross-validation is used to estimate
              the generalization performance.
            </p>
          ) : (
            <p>
              Only the training data will be used for the creation of the model,
              which uses a stratified K-fold cross-validation method to select
              the model with the best AUC metric. Subsequently, this model is
              then applied on the test data, using the Bootstrap method to give
              a range of performance metrics.
            </p>
          )}
        </div>
      </div>
      <MyModal
        isOpen={algorithmDetailsOpen}
        toggle={toggleAlgorithmDetails}
        title={<span>Algorithm Parameters explored</span>}
      >
        {generateDetails(currentAlgorithm)}
      </MyModal>

      {albumExtraction && (
        <>
          <h3>Train Model</h3>
          {trainingButton()}
          {trainingError && (
            <Alert color="danger" className="mt-3">
              Model Training failed. Error message returned is :{' '}
              <strong>
                <code>{trainingError}</code>
              </strong>
            </Alert>
          )}
        </>
      )}
    </div>
  );

  const generateDetails = (algorithm) => {
    switch (algorithm) {
      case CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION:
        return (
          <div className="algorithm-details">
            <h5>Solver</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>lbgfs</ListGroupItem>
              <ListGroupItem>saga</ListGroupItem>
            </ListGroup>
            <h5 className="mt-3">Penalty</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>L1 (saga solver only)</ListGroupItem>
              <ListGroupItem>L2</ListGroupItem>
              <ListGroupItem>ElasticNet (saga solver only)</ListGroupItem>
            </ListGroup>
            <h5 className="mt-3">L1 Ratio (for ElasticNet penalty)</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>0.5</ListGroupItem>
            </ListGroup>
            <h5 className="mt-3">Maximum Iterations</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>1000</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      case CLASSIFICATION_ALGORITHMS.SVM:
        return (
          <div className="algorithm-details">
            <h5>C</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>0.01</ListGroupItem>
              <ListGroupItem>0.1</ListGroupItem>
              <ListGroupItem>1</ListGroupItem>
              <ListGroupItem>10</ListGroupItem>
              <ListGroupItem>100</ListGroupItem>
            </ListGroup>
            <h5 className="mt-3">Gamma</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>scale</ListGroupItem>
              <ListGroupItem>auto</ListGroupItem>
              <ListGroupItem>1</ListGroupItem>
              <ListGroupItem>0.1</ListGroupItem>
              <ListGroupItem>0.01</ListGroupItem>
              <ListGroupItem>0.001</ListGroupItem>
            </ListGroup>
            <h5 className="mt-3">Kernel</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>Linear</ListGroupItem>
              <ListGroupItem>RBF</ListGroupItem>
              <ListGroupItem>Poly</ListGroupItem>
              <ListGroupItem>Sigmoid</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-learn.org/stable/modules/generated/sklearn.svm.SVC.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      case CLASSIFICATION_ALGORITHMS.RANDOM_FOREST:
        return (
          <div className="algorithm-details">
            <h5>Maximum Tree Depth</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>10</ListGroupItem>
              <ListGroupItem>100</ListGroupItem>
              <ListGroupItem>∞</ListGroupItem>
            </ListGroup>
            <h5>Number of Estimators</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>10</ListGroupItem>
              <ListGroupItem>100</ListGroupItem>
              <ListGroupItem>1000</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      case SURVIVAL_ALGORITHMS.COX_MODEL:
        return (
          <div className="algorithm-details">
            <h5>Alpha</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>0.1</ListGroupItem>
            </ListGroup>
            <h5>Max Number of Iterations</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>100</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.CoxPHSurvivalAnalysis.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      case SURVIVAL_ALGORITHMS.COX_MODEL_ELASTIC:
        return (
          <div className="algorithm-details">
            <h5>Number of Alphas</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>100</ListGroupItem>
            </ListGroup>
            <h5>L1 Ratio</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>0.5</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.CoxnetSurvivalAnalysis.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      case SURVIVAL_ALGORITHMS.IPC:
        return (
          <div className="algorithm-details">
            <h5>Alpha</h5>
            <ListGroup horizontal={true} className="justify-content-center">
              <ListGroupItem>1</ListGroupItem>
            </ListGroup>
            <hr />
            <p>
              More information{' '}
              <a
                href="https://scikit-survival.readthedocs.io/en/stable/api/generated/sksurv.linear_model.IPCRidge.html"
                target="_blank"
                rel="noreferrer"
              >
                here
              </a>
            </p>
          </div>
        );
      default:
        return 'Unsupported Algorithm';
    }
  };

  const modelsList = (
    <>
      {albumExtraction && (
        <>
          <ModelsTable
            title="Classification Models"
            columns={columnsClassification}
            data={models.filter((m) => m.type === MODEL_TYPES.CLASSIFICATION)}
            handleDeleteModelClick={handleDeleteModelClick}
          />
          <ModelsTable
            title="Survival Models"
            columns={columnsSurvival}
            data={models.filter((m) => m.type === MODEL_TYPES.SURVIVAL)}
            handleDeleteModelClick={handleDeleteModelClick}
          />
        </>
      )}
    </>
  );

  if (labelCategories.length === 0) {
    return (
      <Alert color="info">
        You have not created any outcomes yet.
        <ol>
          <li>
            Go to the "Outcomes" tab and create a new outcome using the "Create
            New Outcome" button
          </li>
          <li>Input or upload the patient labels for that outcome</li>
          <li>Set an outcome as "current" by selecting it in the list</li>
        </ol>
      </Alert>
    );
  }

  if (!selectedLabelCategory) {
    return (
      <Alert color="info">
        You have not defined a current outcome yet. Go to the "Outcomes" tab and
        set an outcome as "current" using the "Set As Current" button.
      </Alert>
    );
  }

  if (models.length === 0) {
    return newModelForm();
  } else {
    if (showNewModel)
      return (
        <>
          <div>
            <Button color="primary" onClick={handleBackToModelsClick}>
              <FontAwesomeIcon icon="arrow-left"></FontAwesomeIcon>{' '}
              <span>Back to existing models</span>
            </Button>
          </div>
          <p> </p>
          {newModelForm()}
        </>
      );
    else
      return (
        <>
          <h2>
            Existing models for album {album.name}{' '}
            {collectionInfos ? (
              <span>, collection "{collectionInfos.collection.name}"</span>
            ) : null}
          </h2>
          <div>
            <Button
              color="primary"
              onClick={handleShowNewModelClick}
              disabled={unlabelledDataPoints === dataPoints.length}
            >
              <FontAwesomeIcon icon="plus"></FontAwesomeIcon>{' '}
              <span>
                Train a new <strong>{selectedLabelCategory.label_type}</strong>{' '}
                model using current outcome{' '}
                <strong>"{selectedLabelCategory.name}"</strong>
              </span>
            </Button>
          </div>
          {modelsList}
        </>
      );
  }
}
