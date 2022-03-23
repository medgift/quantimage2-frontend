import React, { useEffect, useState } from 'react';
import {
  Alert,
  Table,
  Button,
  Tooltip,
  ListGroup,
  ListGroupItem
} from 'reactstrap';

import { DateTime } from 'luxon';

import './Train.css';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';

import _ from 'lodash';
import Kheops from './services/kheops';
import { trainModel } from './utils/feature-utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import MyModal from './components/MyModal';
import ListValues from './components/ListValues';
import { MODEL_TYPES, DATA_SPLITTING_TYPES } from './config/constants';
import ModelsTable from './components/ModelsTable';

export const PATIENT_ID_FIELD = 'PatientID';
export const ROI_FIELD = 'ROI';
export const MODALITY_FIELD = 'Modality';
export const NON_FEATURE_FIELDS = [PATIENT_ID_FIELD, MODALITY_FIELD, ROI_FIELD];

const CLASSIFICATION_ALGORITHMS = {
  LOGISTIC_REGRESSION: 'logistic_regression',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm'
};

const SURVIVAL_ALGORITHMS = {
  COX_MODEL: 'cox'
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
  testPatients
}) {
  let { keycloak } = useKeycloak();

  const maxAUCModelTraining = _.maxBy(
    models.filter(m => m.type === MODEL_TYPES.CLASSIFICATION),
    model => {
      return _.isPlainObject(model.training_metrics.auc)
        ? model.training_metrics.auc.mean
        : model.training_metrics.auc;
    }
  );

  const maxCIndexModel = _.maxBy(
    models.filter(m => m.type === MODEL_TYPES.SURVIVAL),
    'metrics.concordance_index'
  );

  let [currentAlgorithm, setCurrentAlgorithm] = useState(null);
  let [algorithmDetailsOpen, setAlgorithmDetailsOpen] = useState(false);

  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [patientIDs, setPatientIDs] = useState(null);
  let [patientIDsOpen, setPatientIDsOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);

  let [trainingError, setTrainingError] = useState(null);

  let [showNewModel, setShowNewModel] = useState(false);

  let [ciTooltipOpen, setCITooltipOpen] = useState(false);

  // Model table header
  const columnsClassification = React.useMemo(
    () => [
      {
        Header: 'Date created',
        accessor: r =>
          DateTime.fromJSDate(new Date(r.created_at)).toFormat(
            'yyyy-MM-dd HH:mm:ss'
          ),
        sortDescFirst: true,
        id: 'created_at'
      },
      { Header: 'Outcome', accessor: 'label_category' },
      { Header: 'Best Algorithm', accessor: 'best_algorithm' },
      {
        Header: 'Best Data Normalization',
        accessor: 'best_data_normalization'
      },
      {
        Header: 'Model Validation',
        accessor: r => {
          let isTrainTest =
            r.data_splitting_type === DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT;

          if (isTrainTest) {
            let trainingProportion =
              (r.training_patient_ids.length /
                (r.training_patient_ids.length + r.test_patient_ids.length)) *
              100;
            let testProportion = 100 - trainingProportion;

            return `Training/Test split (${Math.round(
              trainingProportion
            )}%/${Math.round(testProportion)}%)`;
          } else {
            return 'Cross-validation (Full Dataset)';
          }
        }
      },
      {
        Header: 'Training AUC (cross-validation)',
        accessor: r =>
          `${r.training_metrics.auc.mean.toFixed(
            4
          )} (${r.training_metrics.auc.inf_value.toFixed(
            4
          )}-${r.training_metrics.auc.sup_value.toFixed(4)})`,
        sortDescFirst: true,
        sortType: (r1, r2) =>
          +r1.original.training_metrics.auc.mean -
          +r2.original.training_metrics.auc.mean
      },
      {
        Header: 'Test AUC (bootstrap)',
        accessor: r =>
          r.test_metrics
            ? _.isPlainObject(r.test_metrics.auc)
              ? `${r.test_metrics.auc.mean.toFixed(
                  4
                )} (${r.test_metrics.auc.inf_value.toFixed(
                  4
                )}-${r.test_metrics.auc.sup_value.toFixed(4)})`
              : r.test_metrics.auc.toFixed(4)
            : 'N/A',
        sortDescFirst: true,
        sortType: (r1, r2) => {
          if (!r1.original.test_metrics || !r2.original.test_metrics) return 1;

          return (
            +r1.original.test_metrics.auc.mean -
            +r2.original.test_metrics.auc.mean
          );
        }
      }
    ],
    []
  );

  const columnsSurvival = React.useMemo(
    () => [
      {
        Header: 'Date created',
        accessor: r =>
          DateTime.fromJSDate(new Date(r.created_at)).toFormat(
            'yyyy-MM-dd HH:mm:ss'
          ),
        sortDescFirst: true,
        id: 'created_at'
      },
      { Header: 'Outcome', accessor: 'label_category' },
      { Header: 'Best Algorithm', accessor: 'best_algorithm' },
      {
        Header: 'Best Data Normalization',
        accessor: 'best_data_normalization'
      },
      {
        Header: 'c-index (green is highest)',
        accessor: 'metrics.concordance_index',
        sortDescFirst: true,
        sortType: 'number'
      }
    ],
    []
  );

  const toggleCITooltip = () => setCITooltipOpen(open => !open);

  const toggleAlgorithmDetails = algorithm => {
    setAlgorithmDetailsOpen(o => !o);
    if (!algorithm) setCurrentAlgorithm(null);
    else setCurrentAlgorithm(algorithm);
  };

  const toggleFeatureNames = () => {
    setFeatureNamesOpen(open => !open);
  };

  const togglePatientIDs = () => {
    setPatientIDsOpen(open => !open);
  };

  const transformLabelsToTabular = outcomes => {
    let tabularLabels = [];

    for (let outcome of outcomes) {
      let tabularLabel = [
        outcome.patient_id,
        ...Object.values(outcome.label_content)
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

      let model = await trainModel(
        featureExtractionID,
        collectionInfos ? collectionInfos.collection.id : null,
        selectedLabelCategory.id,
        albumStudies,
        album,
        labels,
        dataSplittingType,
        trainTestSplitType,
        trainingPatients,
        testPatients,
        metadataColumns[MODALITY_FIELD],
        metadataColumns[ROI_FIELD],
        keycloak.token
      );

      setIsTraining(false);
      setModels([model, ...models]);
      setShowNewModel(false);
    } catch (e) {
      setIsTraining(false);
      setTrainingError(e.message);
    }
  };

  const handleDeleteModelClick = async id => {
    await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter(model => model.id !== id));
  };

  const handleShowNewModelClick = () => {
    setShowNewModel(true);
  };

  const handleBackToModelsClick = () => {
    setShowNewModel(false);
  };

  const handleShowFeatureNames = names => {
    setFeatureNames(names);
    toggleFeatureNames();
  };

  const handleShowPatientIDs = ids => {
    setPatientIDs(ids);
    togglePatientIDs();
  };

  if (!album) return <span>Loading...</span>;

  //let album = albums.find((a) => a.album_id === albumID);

  let trainingButton = () => {
    let buttonText = isTraining
      ? dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET
        ? 'Training Model...'
        : 'Training & Testing Model...'
      : dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET
      ? 'Train Model'
      : 'Train & Test Model';

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

      {selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION && (
        <>
          <h4>Model Parameters</h4>
          <h5>Classification Algorithms</h5>
          <div>The following classification algorithms will be used</div>
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
                  <small>+ Parameters used</small>
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
            </ListGroupItem>
            <ListGroupItem>
              <a
                href="https://en.wikipedia.org/wiki/Random_forest"
                target="_blank"
                rel="noreferrer"
              >
                Random Forest
              </a>
            </ListGroupItem>
          </ListGroup>
          <h5 className="mt-3">Data Normalization Algorithms</h5>
          <div>The following data standardization techniques will be used</div>
          <ListGroup horizontal={true} className="justify-content-center">
            <ListGroupItem>None</ListGroupItem>
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
                  All the available features & patients will be used to train
                  the model. A 5-fold stratified cross-validation is used to
                  estimate the generalization performance.
                </p>
              ) : (
                <p>
                  Only the training data will be used for the creation of the
                  model, which uses a stratified cross-validation method to
                  select the model with the best AUC metric. Subsequently, this
                  model is then applied on the test data, using the Bootstrap
                  method to give a range of performance metrics.
                </p>
              )}
            </div>
          </div>
          <MyModal
            isOpen={algorithmDetailsOpen}
            toggle={toggleAlgorithmDetails}
            title={<span>Algorithm Parameters used</span>}
          >
            {generateDetails(currentAlgorithm)}
          </MyModal>
        </>
      )}
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

  const formatMetrics = metrics => {
    let formattedOtherMetrics = Object.keys(metrics).map(metricName => (
      <tr key={metricName}>
        <td>
          <strong>{metricName}</strong>
        </td>
        <td>{formatMetric(metrics[metricName])}</td>
      </tr>
    ));

    return (
      <>
        <Table className="metrics-table">
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>
                Metric Value{' '}
                {_.isPlainObject(Object.values(metrics)[0]) && (
                  <>
                    <FontAwesomeIcon icon="question-circle" id="ciTooltip" />
                    <Tooltip
                      placement="right"
                      isOpen={ciTooltipOpen}
                      target="ciTooltip"
                      toggle={toggleCITooltip}
                    >
                      Shows the mean value & 95% confidence interval
                    </Tooltip>
                  </>
                )}
              </th>
            </tr>
          </thead>
          <tbody>{formattedOtherMetrics}</tbody>
        </Table>
      </>
    );
  };

  const generateDetails = algorithm => {
    switch (algorithm) {
      case CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION:
        return (
          <div>
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
            data={models.filter(m => m.type === MODEL_TYPES.CLASSIFICATION)}
            dataPoints={dataPoints}
            handleDeleteModelClick={handleDeleteModelClick}
            handleShowFeatureNames={handleShowFeatureNames}
            handleShowPatientIDs={handleShowPatientIDs}
            formatMetrics={formatMetrics}
          />
          <ModelsTable
            title="Survival Models"
            columns={columnsSurvival}
            data={models.filter(m => m.type === MODEL_TYPES.SURVIVAL)}
            dataPoints={dataPoints}
            handleDeleteModelClick={handleDeleteModelClick}
            handleShowFeatureNames={handleShowFeatureNames}
            handleShowPatientIDs={handleShowPatientIDs}
            formatMetrics={formatMetrics}
          />
        </>
      )}
      <MyModal
        isOpen={featureNamesOpen}
        toggle={toggleFeatureNames}
        title={<span>Feature Names</span>}
      >
        <ListValues values={featureNames} />
      </MyModal>
      <MyModal
        isOpen={patientIDsOpen}
        toggle={togglePatientIDs}
        title={<span>Patient IDs</span>}
      >
        <ListValues values={patientIDs} />
      </MyModal>
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

function formatMetric(metric) {
  if (!_.isPlainObject(metric)) return metric;

  return (
    <>
      {_.isNumber(metric['mean']) ? metric['mean'].toFixed(3) : metric['mean']}{' '}
      (
      {_.isNumber(metric['inf_value'])
        ? metric['inf_value'].toFixed(3)
        : metric['inf_value']}{' '}
      -{' '}
      {_.isNumber(metric['sup_value'])
        ? metric['sup_value'].toFixed(3)
        : metric['sup_value']}
      )
    </>
  );
}
