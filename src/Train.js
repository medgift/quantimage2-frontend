import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Input,
  Form,
  Table,
  Button,
  Collapse,
  Label,
  FormText,
  FormGroup,
  ListGroup,
  ListGroupItem,
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
import CheckboxGroup from 'react-checkbox-group';
import MyModal from './components/MyModal';
import FeatureNames from './components/FeatureNames';
import DataLabels from './components/DataLabels';
import { MODEL_TYPES } from './Features';

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

function ModelsTable({
  columns,
  data,
  dataPoints,
  collectionInfos,
  handleDeleteModelClick,
  handleShowFeatureNames,
  formatMetrics,
  maxAUCModel,
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

  return (
    <>
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
                    row.original.id == maxAUCModel.id && 'text-success'
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
                                  {row.validation_strategy
                                    ? row.validation_strategy
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
                                    : row.original['feature-number']}
                                  {' - '}
                                  <a
                                    href="#"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      handleShowFeatureNames(
                                        collectionInfos
                                          ? collectionInfos.features
                                          : row.original['feature-names']
                                      );
                                    }}
                                  >
                                    Show details
                                  </a>
                                </td>
                              </tr>
                              <tr>
                                <td>Number of Observations</td>
                                <td>
                                  {isNaN(dataPoints)
                                    ? dataPoints.length
                                    : dataPoints}
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
  tabularClassificationLabels,
  tabularSurvivalLabels,
  featureExtractionID,
  unlabelledDataPoints,
  dataPoints,
  models,
  setModels,
}) {
  let [keycloak] = useKeycloak();

  let [modelType, setModelType] = useState(MODEL_TYPES.CLASSIFICATION);

  const maxAUCModel = _.maxBy(models, 'metrics.auc.mean');

  let [algorithmType, setAlgorithmType] = useState(
    CLASSIFICATION_ALGORITHMS.LOGISTIC_REGRESSION
  );

  let [featureNames, setFeatureNames] = useState(null);
  let [featureNamesOpen, setFeatureNamesOpen] = useState(false);

  let [isTraining, setIsTraining] = useState(false);

  let [showNewModel, setShowNewModel] = useState(false);

  let [ciTooltipOpen, setCITooltipOpen] = useState(false);

  let [isAdvancedConfigOpen, setIsAdvancedConfigOpen] = useState(true);

  // Advanced configuration parameters
  let [dataNormalization, setDataNormalization] = useState('none');
  let [featureSelection, setFeatureSelection] = useState('none');

  // Model table header
  const columns = React.useMemo(
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
      { Header: 'Algorithm', accessor: 'algorithm' },
      { Header: 'Data Normalization', accessor: 'data_normalization' },
      {
        Header: 'Mean AUC (green is highest)',
        accessor: 'metrics.auc.mean',
        sortDescFirst: true,
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

  const handleFeatureSelectionChange = (e) => {
    setFeatureSelection(e.target.value);
  };

  const handleModelTypeChange = (e) => {
    setModelType(e.target.value);
  };

  const handleAlgorithmTypeChange = (e) => {
    setAlgorithmType(e.target.value);
  };

  const toggleFeatureNames = () => {
    setFeatureNamesOpen((open) => !open);
  };

  // Handle model train click
  const handleTrainModelClick = async () => {
    setIsTraining(true);

    let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

    let labels =
      modelType === MODEL_TYPES.CLASSIFICATION
        ? tabularClassificationLabels
        : tabularSurvivalLabels;

    let model = await trainModel(
      featureExtractionID,
      collectionInfos ? collectionInfos.collection.id : null,
      albumStudies,
      album,
      labels,
      modelType,
      algorithmType,
      dataNormalization,
      metadataColumns[MODALITY_FIELD],
      metadataColumns[ROI_FIELD],
      keycloak.token
    );

    setIsTraining(false);
    setModels([model, ...models]);
    setShowNewModel(false);
  };

  const handleDeleteModelClick = async (id) => {
    const deletedModel = await Backend.deleteModel(keycloak.token, id);
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

  if (!album) return <span>Loading...</span>;

  //let album = albums.find((a) => a.album_id === albumID);

  let newModelForm = (
    <div>
      <h2>
        Train a new model on album "{album.name}"
        {collectionInfos ? (
          <span>, collection "{collectionInfos.collection.name}"</span>
        ) : null}
      </h2>

      <h3>Model configuration</h3>
      <div>Choose the type of model to train</div>
      <div className="form-container">
        <Form>
          <Input
            type="select"
            id="model-type"
            name="model-type"
            value={modelType}
            onChange={handleModelTypeChange}
          >
            {Object.keys(MODEL_TYPES).map((key) => (
              <option key={key} value={MODEL_TYPES[key]}>
                {MODEL_TYPES[key]}
              </option>
            ))}
          </Input>
        </Form>
      </div>
      {modelType === MODEL_TYPES.CLASSIFICATION && (
        <>
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
          {unlabelledDataPoints > 0 ? (
            <p>
              There are still {unlabelledDataPoints} unlabelled PatientIDs,
              assign an outcome to them first in the "Outcomes" tab!
              {/*/ROI pairs, assign an outcome to them first!*/}
            </p>
          ) : (
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
        <td>
          {metrics[metricName]['mean'].toFixed(3)} (
          {metrics[metricName]['inf_value'].toFixed(3)} -{' '}
          {metrics[metricName]['sup_value'].toFixed(3)})
        </td>
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
                <FontAwesomeIcon icon="question-circle" id="ciTooltip" />
                <Tooltip
                  placement="right"
                  isOpen={ciTooltipOpen}
                  target="ciTooltip"
                  toggle={toggleCITooltip}
                >
                  Shows the mean value & 95% confidence interval
                </Tooltip>
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
      <h4 className="mt-3">Classification Models</h4>
      {albumExtraction && (
        <ModelsTable
          columns={columns}
          data={models}
          dataPoints={dataPoints}
          collectionInfos={collectionInfos}
          handleDeleteModelClick={handleDeleteModelClick}
          handleShowFeatureNames={handleShowFeatureNames}
          formatMetrics={formatMetrics}
          maxAUCModel={maxAUCModel}
        />
      )}
      <MyModal
        isOpen={featureNamesOpen}
        toggle={toggleFeatureNames}
        title={<span>Feature Names</span>}
      >
        <FeatureNames names={featureNames} />
      </MyModal>
    </>
  );

  if (models.length === 0) {
    return newModelForm;
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
          {newModelForm}
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
              <span>Train a new model</span>
            </Button>
          </div>
          {modelsList}
        </>
      );
  }
}
