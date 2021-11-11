import React, { useEffect, useState } from 'react';
import {
  Alert,
  Input,
  Form,
  Table,
  Button,
  Collapse,
  Label,
  FormGroup,
  Badge,
  Tooltip,
} from 'reactstrap';

import { useTable, useSortBy } from 'react-table';

import { DateTime } from 'luxon';

import './Train.css';
import Backend from './services/backend';
import { useKeycloak } from 'react-keycloak';

import _ from 'lodash';
import Kheops from './services/kheops';
import { trainModel } from './utils/feature-utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import MyModal from './components/MyModal';
import ListValues from './components/ListValues';
import { MODEL_TYPES } from './Features';
import { CLASSIFICATION_OUTCOMES, SURVIVAL_OUTCOMES } from './Outcomes';

export const PATIENT_ID_FIELD = 'PatientID';
export const ROI_FIELD = 'ROI';
export const MODALITY_FIELD = 'Modality';
export const NON_FEATURE_FIELDS = [PATIENT_ID_FIELD, MODALITY_FIELD, ROI_FIELD];

const CLASSIFICATION_ALGORITHMS = {
  LOGISTIC_REGRESSION: 'logistic_regression',
  LASSO_REGRESSION: 'lasso_regression',
  ELASTIC_NET: 'elastic_net',
  RANDOM_FOREST: 'random_forest',
  SVM: 'svm',
};

const SURVIVAL_ALGORITHMS = {
  COX_MODEL: 'cox',
};

function ModelsTable({
  title,
  columns,
  data,
  dataPoints,
  albumExtraction,
  collectionInfos,
  handleDeleteModelClick,
  handleShowFeatureNames,
  handleShowPatientIDs,
  formatMetrics,
  bestModel,
}) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
      initialState: {
        sortBy: [{ id: 'created_at', desc: true }],
      },
    },
    useSortBy
  );

  const [openModelID, setOpenModelID] = useState(-1);

  const toggleModel = (modelID) => {
    setOpenModelID((m) => (m !== modelID ? modelID : -1));
  };

  if (data.length === 0) return null;

  return (
    <>
      <h4 className="mt-3">{title}</h4>
      <Table {...getTableProps()} className="m-3 models-summary">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              <th> </th>
              {headerGroup.headers.map((column) => (
                // Add the sorting props to control sorting. For this example
                // we can add them into the header props
                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render('Header')}
                  {/* Add a sort direction indicator */}
                  <span>
                    {column.isSorted ? (
                      column.isSortedDesc ? (
                        <>
                          {' '}
                          <FontAwesomeIcon
                            style={{ color: 'grey' }}
                            icon="caret-up"
                          />
                          <FontAwesomeIcon icon="caret-down" />
                        </>
                      ) : (
                        <>
                          {' '}
                          <FontAwesomeIcon icon="caret-up" />
                          <FontAwesomeIcon
                            style={{ color: 'grey' }}
                            icon="caret-down"
                          />
                        </>
                      )
                    ) : (
                      <>
                        {' '}
                        <FontAwesomeIcon
                          style={{ color: 'grey' }}
                          icon="caret-up"
                        />
                        <FontAwesomeIcon
                          style={{ color: 'grey' }}
                          icon="caret-down"
                        />
                      </>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {rows.map((row, i) => {
            prepareRow(row);
            return (
              <React.Fragment key={row.getRowProps().key}>
                <tr
                  {...row.getRowProps()}
                  className={`model-row ${
                    row.original.id === bestModel.id && 'text-success'
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleModel(row.original.id)}
                >
                  <td style={{ width: '40px' }} className="model-row-icon">
                    <FontAwesomeIcon
                      icon={
                        openModelID === row.original.id
                          ? 'minus-circle'
                          : 'plus-circle'
                      }
                    />
                  </td>
                  {row.cells.map((cell) => {
                    return (
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 0 }}>
                    <Collapse isOpen={openModelID === row.original.id}>
                      <div key={row.original.id} className="model-entry">
                        <h3>{row.name}</h3>
                        <div className="model-details-container">
                          <Table bordered className="model-details-table">
                            <tbody>
                              <tr>
                                <td>Created at</td>
                                <td>{row.original.created_at}</td>
                              </tr>
                              <tr>
                                <td>Model type</td>
                                <td>{row.original.type}</td>
                              </tr>
                              <tr>
                                <td>Algorithm Used</td>
                                <td>{row.original.algorithm}</td>
                              </tr>
                              <tr>
                                <td>Validation Strategy</td>
                                <td>
                                  {row.original.validation_strategy
                                    ? row.original.validation_strategy
                                    : 'None'}
                                </td>
                              </tr>
                              <tr>
                                <td>Data Normalization</td>
                                <td>
                                  {row.data_normalization
                                    ? row.data_normalization
                                    : 'None'}
                                </td>
                              </tr>
                              {/* TODO - Put this back once it's implemented */}
                              {/*
                              <tr>
                                <td>Feature Selection</td>
                                <td>
                                  {row.feature_selection
                                    ? row.feature_selection
                                    : 'None'}
                                </td>
                              </tr>
                              */}
                              <tr>
                                <td>Modalities Used</td>
                                <td>
                                  {row.original.modalities.map((modality) => (
                                    <Badge
                                      style={{ marginRight: '0.5em' }}
                                      color="primary"
                                      key={modality}
                                    >
                                      {modality}
                                    </Badge>
                                  ))}
                                </td>
                              </tr>
                              <tr>
                                <td>ROIs Used</td>
                                <td>
                                  {row.original.rois.map((roi) => (
                                    <Badge
                                      style={{ marginRight: '0.5em' }}
                                      color="primary"
                                      key={roi}
                                    >
                                      {roi}
                                    </Badge>
                                  ))}
                                </td>
                              </tr>
                              <tr>
                                <td>Number of Features</td>
                                <td>
                                  {collectionInfos
                                    ? collectionInfos.features.length
                                    : albumExtraction.feature_definitions
                                        .length}
                                  {' - '}
                                  <Button
                                    color="link"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      handleShowFeatureNames(
                                        collectionInfos
                                          ? collectionInfos.features
                                          : albumExtraction.feature_definitions
                                      );
                                    }}
                                  >
                                    Show details
                                  </Button>
                                </td>
                              </tr>
                              <tr>
                                <td>Number of Observations</td>
                                <td>
                                  {row.original.patient_ids ? (
                                    <>
                                      {row.original.patient_ids.length}
                                      {' - '}
                                      <Button
                                        color="link"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          handleShowPatientIDs(
                                            row.original.patient_ids
                                          );
                                        }}
                                      >
                                        Show details
                                      </Button>
                                    </>
                                  ) : isNaN(dataPoints) ? (
                                    dataPoints.length
                                  ) : (
                                    dataPoints
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </Table>
                        </div>
                        <hr />
                        <div>
                          <strong>Model Metrics</strong>
                          {formatMetrics(row.original.metrics)}
                        </div>
                        <br />
                        <p>
                          <Button
                            color="danger"
                            onClick={() =>
                              handleDeleteModelClick(row.original.id)
                            }
                          >
                            Delete Model
                          </Button>
                        </p>
                      </div>
                    </Collapse>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}

export default function Train({
  album,
  albumExtraction,
  collectionInfos,
  metadataColumns,
  featureExtractionID,
  dataPoints,
  formattedDataLabels,
  selectedLabelCategory,
  labelCategories,
  models,
  setModels,
}) {
  let [keycloak] = useKeycloak();

  const maxAUCModel = _.maxBy(
    models.filter((m) => m.type === MODEL_TYPES.CLASSIFICATION),
    'metrics.auc.mean'
  );

  const maxCIndexModel = _.maxBy(
    models.filter((m) => m.type === MODEL_TYPES.SURVIVAL),
    'metrics.concordance_index'
  );

  let [algorithmType, setAlgorithmType] = useState(
    CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION
  );

  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [patientIDs, setPatientIDs] = useState(null);
  let [patientIDsOpen, setPatientIDsOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);

  let [trainingError, setTrainingError] = useState(null);

  let [showNewModel, setShowNewModel] = useState(false);

  let [ciTooltipOpen, setCITooltipOpen] = useState(false);

  let [isAdvancedConfigOpen, setIsAdvancedConfigOpen] = useState(true);

  // Advanced configuration parameters
  let [dataNormalization, setDataNormalization] = useState('none');
  //let [featureSelection, setFeatureSelection] = useState('none');

  // Modify algorithm type on label category switch
  useEffect(() => {
    if (!selectedLabelCategory) return;

    if (selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION)
      setAlgorithmType(CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION);

    if (selectedLabelCategory.label_type === MODEL_TYPES.SURVIVAL)
      setAlgorithmType(SURVIVAL_ALGORITHMS.COX_MODEL);
  }, [selectedLabelCategory]);

  // Model table header
  const columnsClassification = React.useMemo(
    () => [
      {
        Header: 'Date created',
        accessor: (r) =>
          DateTime.fromJSDate(new Date(r.created_at)).toFormat(
            'yyyy-MM-dd HH:mm:ss'
          ),
        sortDescFirst: true,
        id: 'created_at',
      },
      { Header: 'Outcome', accessor: 'label_category' },
      { Header: 'Algorithm', accessor: 'algorithm' },
      { Header: 'Data Normalization', accessor: 'data_normalization' },
      {
        Header: 'Mean AUC (green is highest)',
        accessor: 'metrics.auc.mean',
        sortDescFirst: true,
        sortType: 'number',
      },
    ],
    []
  );

  const columnsSurvival = React.useMemo(
    () => [
      {
        Header: 'Date created',
        accessor: (r) =>
          DateTime.fromJSDate(new Date(r.created_at)).toFormat(
            'yyyy-MM-dd HH:mm:ss'
          ),
        sortDescFirst: true,
        id: 'created_at',
      },
      { Header: 'Outcome', accessor: 'label_category' },
      { Header: 'Algorithm', accessor: 'algorithm' },
      { Header: 'Data Normalization', accessor: 'data_normalization' },
      {
        Header: 'c-index (green is highest)',
        accessor: 'metrics.concordance_index',
        sortDescFirst: true,
        sortType: 'number',
      },
    ],
    []
  );

  const toggleCITooltip = () => setCITooltipOpen((open) => !open);

  const toggleAdvancedConfig = () => {
    setIsAdvancedConfigOpen((o) => !o);
  };

  const handleNormalizationChange = (e) => {
    setDataNormalization(e.target.value);
  };

  const handleAlgorithmTypeChange = (e) => {
    setAlgorithmType(e.target.value);
  };

  const toggleFeatureNames = () => {
    setFeatureNamesOpen((open) => !open);
  };

  const togglePatientIDs = () => {
    setPatientIDsOpen((open) => !open);
  };

  const transformLabelsToTabular = (formattedDataLabels) => {
    let tabularLabels = [];

    for (let patientID in formattedDataLabels) {
      let tabularLabel = [patientID];
      let outcomeFields =
        selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION
          ? CLASSIFICATION_OUTCOMES
          : SURVIVAL_OUTCOMES;

      for (let field of outcomeFields) {
        tabularLabel = [...tabularLabel, formattedDataLabels[patientID][field]];
      }

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
      let labels = transformLabelsToTabular(formattedDataLabels);

      let model = await trainModel(
        featureExtractionID,
        collectionInfos ? collectionInfos.collection.id : null,
        selectedLabelCategory.id,
        albumStudies,
        album,
        labels,
        algorithmType,
        dataNormalization,
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

  const handleShowFeatureNames = (names) => {
    setFeatureNames(names);
    toggleFeatureNames();
  };

  const handleShowPatientIDs = (ids) => {
    setPatientIDs(ids);
    togglePatientIDs();
  };

  if (!album) return <span>Loading...</span>;

  //let album = albums.find((a) => a.album_id === albumID);

  let newModelForm = () => (
    <div>
      <h2>
        Train a new <strong>{selectedLabelCategory.label_type}</strong> model on
        album "{album.name}"
        {collectionInfos ? (
          <span>, collection "{collectionInfos.collection.name}"</span>
        ) : null}{' '}
        using current outcome "{selectedLabelCategory.name}"
      </h2>

      {selectedLabelCategory.label_type === MODEL_TYPES.CLASSIFICATION && (
        <>
          <h4>Model configuration</h4>
          <div>Choose the classification algorithm</div>
          <div className="form-container">
            <Form>
              <Input
                type="select"
                id="algorithm-type"
                name="algorithm-type"
                value={algorithmType}
                onChange={handleAlgorithmTypeChange}
              >
                {Object.keys(CLASSIFICATION_ALGORITHMS).map((key) => (
                  <option key={key} value={CLASSIFICATION_ALGORITHMS[key]}>
                    {_.startCase(
                      CLASSIFICATION_ALGORITHMS[key].replace('_', ' ')
                    )}
                  </option>
                ))}
              </Input>
            </Form>
          </div>
          <div>
            <Button color="link" onClick={toggleAdvancedConfig}>
              {isAdvancedConfigOpen ? '-' : '+'} Advanced Parameters
            </Button>
            <Collapse isOpen={isAdvancedConfigOpen}>
              <Form>
                <h4>Data normalization</h4>
                <FormGroup tag="fieldset">
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="data-normalization"
                        value="none"
                        checked={dataNormalization === 'none'}
                        onChange={handleNormalizationChange}
                      />{' '}
                      None
                    </Label>
                  </FormGroup>
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="data-normalization"
                        value="l2norm"
                        checked={dataNormalization === 'l2norm'}
                        onChange={handleNormalizationChange}
                      />{' '}
                      L2 Normalization
                    </Label>
                  </FormGroup>
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="data-normalization"
                        value="standardization"
                        checked={dataNormalization === 'standardization'}
                        onChange={handleNormalizationChange}
                      />{' '}
                      Standardization
                    </Label>
                  </FormGroup>
                </FormGroup>
                {/* TODO - Put this back once it's implemented */}
                {/*<h4>Feature selection</h4>
                <FormGroup tag="fieldset">
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="feature-selection"
                        value="none"
                        checked={featureSelection === 'none'}
                        onChange={handleFeatureSelectionChange}
                      />{' '}
                      None
                    </Label>
                  </FormGroup>
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="feature-selection"
                        value="drop-correlated"
                        checked={featureSelection === 'drop-correlated'}
                        onChange={handleFeatureSelectionChange}
                      />{' '}
                      Drop highly correlated features
                    </Label>
                  </FormGroup>
                  <FormGroup check inline>
                    <Label check>
                      <Input
                        type="radio"
                        name="feature-selection"
                        value="rfe"
                        checked={featureSelection === 'rfe'}
                        onChange={handleFeatureSelectionChange}
                      />{' '}
                      Recursive Feature Elimination (RFE)
                    </Label>
                  </FormGroup>
                </FormGroup>*/}
              </Form>
            </Collapse>
          </div>
        </>
      )}
      {albumExtraction && (
        <>
          <h3>Train Model</h3>
          <Button color="info" onClick={handleTrainModelClick}>
            {isTraining ? (
              <>
                <FontAwesomeIcon icon="spinner" spin />{' '}
                <span>Training Model...</span>
              </>
            ) : (
              <span>Train Model</span>
            )}
          </Button>
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

  const formatMetrics = (metrics) => {
    let formattedOtherMetrics = Object.keys(metrics).map((metricName) => (
      <tr key={metricName}>
        <td>
          <strong>{metricName}</strong>
        </td>
        <td>{formatMetric(metrics[metricName])}</td>
      </tr>
    ));

    /*let confusionMatrix = (
      <>
        <tr>
          <td>
            <span>
              <strong>True Positives</strong>
            </span>
            <br />
            <span>{true_pos}</span>
          </td>
          <td>
            <span>
              <strong>False Positives</strong>
            </span>
            <br />
            <span>{false_pos}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span>
              <strong>False Negatives</strong>
            </span>
            <br />
            <span>{false_neg}</span>
          </td>
          <td>
            <span>
              <strong>True Negatives</strong>
            </span>
            <br />
            <span>{true_neg}</span>
          </td>
        </tr>
      </>
    );*/

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
        {/* Remove confusion matrix for now, focus on having confidence intervals}
        {true_pos !== undefined && (
          <>
            <strong>Confusion Matrix</strong>
            <Table className="confusion-matrix">
              <tbody>{confusionMatrix}</tbody>
            </Table>
          </>*/}
      </>
    );
  };

  const modelsList = (
    <>
      {albumExtraction && (
        <>
          <ModelsTable
            title="Classification Models"
            columns={columnsClassification}
            data={models.filter((m) => m.type === MODEL_TYPES.CLASSIFICATION)}
            dataPoints={dataPoints}
            albumExtraction={albumExtraction}
            collectionInfos={collectionInfos}
            handleDeleteModelClick={handleDeleteModelClick}
            handleShowFeatureNames={handleShowFeatureNames}
            handleShowPatientIDs={handleShowPatientIDs}
            formatMetrics={formatMetrics}
            bestModel={maxAUCModel}
          />
          <ModelsTable
            title="Survival Models"
            columns={columnsSurvival}
            data={models.filter((m) => m.type === MODEL_TYPES.SURVIVAL)}
            dataPoints={dataPoints}
            albumExtraction={albumExtraction}
            collectionInfos={collectionInfos}
            handleDeleteModelClick={handleDeleteModelClick}
            handleShowFeatureNames={handleShowFeatureNames}
            handleShowPatientIDs={handleShowPatientIDs}
            formatMetrics={formatMetrics}
            bestModel={maxCIndexModel}
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
            <Button color="primary" onClick={handleShowNewModelClick}>
              <FontAwesomeIcon icon="plus"></FontAwesomeIcon>{' '}
              <span>
                Train a new <strong>{selectedLabelCategory.label_type}</strong>{' '}
                model using current outcome "{selectedLabelCategory.name}"
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
