import React, {
  useEffect,
  useState,
  useMemo,
  useContext,
  useCallback
} from 'react';
import { Link } from 'react-router-dom';
import Kheops from './services/kheops';
import Backend from './services/backend';
import {
  Alert,
  Button,
  ButtonGroup,
  Collapse,
  ListGroupItem,
  Spinner,
  Table
} from 'reactstrap';
import moment from 'moment';
import YAML from 'yaml';
import DicomFields from './dicom/fields';
import {
  DICOM_DATE_FORMAT,
  DB_DATE_FORMAT,
  FEATURE_STATUS
} from './config/constants';

import './Study.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import SocketContext from './context/SocketContext';
import FeaturesModal from './FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import downloadFeature from './utils/featureDownload';

function Study({ match, kheopsError }) {
  let {
    params: { studyUID }
  } = match;

  let socket = useContext(SocketContext);

  let [keycloak] = useKeycloak();
  let [studyMetadata, setStudyMetadata] = useState(null);
  let [features, setFeatures] = useState([]);
  let [currentFeature, setCurrentFeature] = useState(null);
  let [modal, setModal] = useState(false);
  let [backendError, setBackendError] = useState(null);
  let [backendErrorVisible, setBackendErrorVisible] = useState(false);

  let [settingsCollapse, setSettingsCollapse] = useState({});

  let series = useMemo(() => parseMetadata(studyMetadata), [studyMetadata]);

  let toggleModal = () => {
    setModal(!modal);
  };

  let hideBackendError = () => {
    setBackendErrorVisible(false);
  };

  let handleComputeFeaturesClick = async feature => {
    try {
      updateFeature(feature, {
        id: feature.id,
        status: FEATURE_STATUS.STARTED,
        status_message: FEATURE_STATUS.properties[FEATURE_STATUS.STARTED].name
      });

      let featureInProgress = await Backend.extract(
        keycloak.token,
        studyUID,
        feature.feature_family.name
      );

      updateFeature(feature, {
        id: featureInProgress.id,
        status: FEATURE_STATUS.STARTED,
        status_message: FEATURE_STATUS.properties[FEATURE_STATUS.STARTED].name
      });
    } catch (err) {
      updateFeature(feature, {
        status: FEATURE_STATUS.NOT_COMPUTED
      });

      setBackendError(err.message);
      setBackendErrorVisible(true);
    }
  };

  let handleViewFeaturesClick = feature => {
    setCurrentFeature(feature);
    toggleModal();
  };

  let handleDownloadFeaturesClick = feature => {
    downloadFeature(feature);
  };

  let handleToggleSettingsClick = family => {
    setSettingsCollapse(prevState => ({
      ...prevState,
      [family]: !prevState[family]
    }));
  };

  let updateFeatureConfig = (e, feature, featureClass) => {
    const checked = e.target.checked;

    let updatedFeatures = [...features];
    let featureToUpdate = updatedFeatures.find(
      f => f.feature_family.name === feature.feature_family.name
    );

    let featureConfig = parseFeatureFamilyConfig(featureToUpdate.config);

    if (!checked) {
      let {
        [featureClass]: removedFeature,
        ...updatedConfig
      } = featureConfig.featureClass;

      featureConfig.featureClass = updatedConfig;
    } else {
      featureConfig.featureClass = {
        ...featureConfig.featureClass,
        [featureClass]: null
      };
    }

    featureToUpdate.config = YAML.stringify(featureConfig, {
      simpleKeys: true
    });

    setFeatures(updatedFeatures);
  };

  const updateFeature = useCallback(
    (feature, { ...rest }) => {
      // Update element in feature
      setFeatures(
        features.map(f => {
          if (feature.feature_family.id === f.feature_family.id) {
            return { ...f, ...rest };
          } else {
            return f;
          }
        })
      );
    },
    [features]
  );

  /* Fetch initial data */
  useEffect(() => {
    async function getFeatures() {
      const featureFamilies = await Backend.featureFamilies(keycloak.token);
      const studyFeatures = await Backend.features(keycloak.token, studyUID);

      let featureFamilyNames = featureFamilies.map(family => family.name);
      let settingsCollapse = {};
      for (let familyName of featureFamilyNames) {
        settingsCollapse[familyName] = false;
      }

      setSettingsCollapse(settingsCollapse);

      let features = [];

      for (let featureFamily of featureFamilies) {
        let studyFeature = studyFeatures.find(
          studyFeature => studyFeature.feature_family.id === featureFamily.id
        );

        if (studyFeature) {
          features.push({
            ...studyFeature,
            feature_family: featureFamily,
            config: featureFamily.config
          });
        } else {
          features.push({
            updated_at: null,
            status: FEATURE_STATUS.NOT_COMPUTED,
            status_message: null,
            payload: null,
            feature_family: featureFamily,
            config: featureFamily.config
          });
        }
      }

      setFeatures(features);
    }

    async function getStudyMetadata() {
      const studyMetadata = await Kheops.studyMetadata(
        keycloak.token,
        studyUID
      );
      setStudyMetadata(studyMetadata);
    }

    getFeatures();
    getStudyMetadata();
  }, [studyUID, keycloak.token]);

  /* Manage Socket.IO events */
  useEffect(() => {
    socket.on('feature-status', featureStatus => {
      console.log('GOT FEATURE STATUS!!!', featureStatus);

      if (featureStatus.status === FEATURE_STATUS.FAILURE) {
        setBackendError(featureStatus.status_message);
        setBackendErrorVisible(true);
      }

      if (features !== null) {
        let foundFeature = features.find(
          f => f.id && f.id === featureStatus.feature_id
        );

        if (foundFeature) {
          let updatedFeature = {
            status: featureStatus.status,
            status_message: featureStatus.status_message
              ? featureStatus.status_message
              : FEATURE_STATUS.properties[featureStatus.status].name
          };

          // Set the updated date if the feature extraction has been completed
          if (featureStatus.status === FEATURE_STATUS.COMPLETE) {
            updatedFeature.updated_at = moment.utc(featureStatus.updated_at);
            updatedFeature.payload = featureStatus.payload;
          }

          updateFeature(foundFeature, updatedFeature);
        }
      }
    });

    return () => {
      socket.off('feature-status');
    };
  }, [features, socket, updateFeature]);

  return (
    <section id="study">
      <h2>Study Details</h2>
      {kheopsError ? (
        <Alert color="danger">Error fetching data from Kheops</Alert>
      ) : !studyMetadata ? (
        <Spinner />
      ) : (
        <>
          <Table borderless size="sm" className="w-auto table-light">
            <tbody>
              <tr>
                <th scope="row">Patient</th>
                <td>
                  {
                    studyMetadata[0][DicomFields.PATIENT_NAME][
                      DicomFields.VALUE
                    ][0][DicomFields.ALPHABETIC]
                  }
                </td>
              </tr>
              <tr>
                <th scope="row">Date</th>
                <td>
                  {moment(
                    studyMetadata[0][DicomFields.DATE][DicomFields.VALUE][0],
                    DicomFields.DATE_FORMAT
                  ).format(DICOM_DATE_FORMAT)}
                </td>
              </tr>
              {Object.keys(series)
                .sort()
                .map((dataset, index) => (
                  <tr key={index}>
                    <th scope="row">{dataset}</th>
                    <td>
                      {series[dataset].length}{' '}
                      {dataset === 'RTSTRUCT' || dataset === 'RWV'
                        ? series[dataset].length > 1
                          ? 'files'
                          : 'file'
                        : series[dataset].length > 1
                        ? 'images'
                        : 'image'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </>
      )}
      <h2>Features</h2>
      <ListGroup className="features-list">
        {features &&
          features.map(feature => (
            <ListGroupItem key={feature.feature_family.name}>
              <div className="feature-summary d-flex justify-content-between align-items-center">
                <div
                  className={
                    `mr-2` + feature.status === FEATURE_STATUS.IN_PROGRESS
                      ? ' text-muted'
                      : ''
                  }
                >
                  {feature.feature_family.name}{' '}
                  <small>
                    {feature.status === FEATURE_STATUS.NOT_COMPUTED && (
                      <>(never computed)</>
                    )}
                    {feature.status === FEATURE_STATUS.FAILURE && (
                      <>(extraction failed, please try again)</>
                    )}
                    {(feature.status === FEATURE_STATUS.IN_PROGRESS ||
                      feature.status === FEATURE_STATUS.STARTED) && (
                      <>({feature.status_message}...)</>
                    )}
                    {feature.status === FEATURE_STATUS.COMPLETE && (
                      <>
                        (computed on{' '}
                        {moment
                          .utc(feature.updated_at, DB_DATE_FORMAT)
                          .local()
                          .format(DB_DATE_FORMAT)}
                        )
                      </>
                    )}
                  </small>
                  <div className="feature-description text-left">
                    {Object.keys(
                      parseFeatureFamilyConfig(feature.config).featureClass
                    )
                      .sort()
                      .join(', ')}
                  </div>
                </div>
                <ButtonGroup className="ml-1">
                  {(() => {
                    switch (feature.status) {
                      case FEATURE_STATUS.NOT_COMPUTED:
                      case FEATURE_STATUS.FAILURE:
                        return (
                          <Button
                            color="success"
                            onClick={() => {
                              handleComputeFeaturesClick(feature);
                            }}
                            title="Compute Features"
                          >
                            <FontAwesomeIcon icon="cog"></FontAwesomeIcon>
                          </Button>
                        );
                      case FEATURE_STATUS.STARTED:
                      case FEATURE_STATUS.IN_PROGRESS:
                        return (
                          <Button
                            color="secondary"
                            disabled
                            title="Computation in Progress"
                          >
                            <FontAwesomeIcon icon="sync" spin></FontAwesomeIcon>
                          </Button>
                        );
                      case FEATURE_STATUS.COMPLETE:
                        return (
                          <Button
                            color="success"
                            onClick={() => {
                              handleComputeFeaturesClick(feature);
                            }}
                            title="Recompute Features"
                            disabled={
                              Object.keys(
                                parseFeatureFamilyConfig(feature.config)
                                  .featureClass
                              ).length === 0
                            }
                          >
                            <FontAwesomeIcon icon="redo"></FontAwesomeIcon>
                          </Button>
                        );
                      default:
                        return null;
                    }
                  })()}
                  <Button
                    color="primary"
                    disabled={
                      feature.status === FEATURE_STATUS.IN_PROGRESS ||
                      feature.status === FEATURE_STATUS.STARTED
                    }
                    title="Configure feature extraction"
                    onClick={() => {
                      handleToggleSettingsClick(feature.feature_family.name);
                    }}
                  >
                    <FontAwesomeIcon icon="tasks"></FontAwesomeIcon>
                  </Button>
                  {feature.status !== FEATURE_STATUS.NOT_COMPUTED &&
                    feature.status !== FEATURE_STATUS.FAILURE && (
                      <>
                        <Button
                          color="info"
                          disabled={
                            feature.status === FEATURE_STATUS.IN_PROGRESS ||
                            feature.status === FEATURE_STATUS.STARTED
                          }
                          onClick={() => {
                            handleViewFeaturesClick(feature);
                          }}
                          title="View Features"
                        >
                          <FontAwesomeIcon icon="search"></FontAwesomeIcon>
                        </Button>
                        <Button
                          color="secondary"
                          disabled={
                            feature.status === FEATURE_STATUS.IN_PROGRESS ||
                            feature.status === FEATURE_STATUS.STARTED
                          }
                          onClick={() => {
                            handleDownloadFeaturesClick(feature);
                          }}
                          title="Download Features"
                        >
                          <FontAwesomeIcon icon="download"></FontAwesomeIcon>
                        </Button>
                      </>
                    )}
                </ButtonGroup>
              </div>
              <Collapse
                isOpen={settingsCollapse[feature.feature_family.name]}
                className="mt-2"
                id={`settings-${feature.feature_family.name}`}
              >
                <ListGroup>
                  {Object.keys(
                    parseFeatureFamilyConfig(feature.feature_family.config)
                      .featureClass
                  ).map(featureClass => (
                    <ListGroupItem
                      className="text-left"
                      key={`${featureClass}-${feature.id}`}
                    >
                      <div className="custom-control custom-checkbox">
                        <input
                          type="checkbox"
                          className="custom-control-input"
                          checked={Object.keys(
                            parseFeatureFamilyConfig(feature.config)
                              .featureClass
                          ).includes(featureClass)}
                          onChange={e =>
                            updateFeatureConfig(e, feature, featureClass)
                          }
                          id={`${featureClass}-${feature.id}`}
                        />
                        <label
                          className="custom-control-label d-block"
                          htmlFor={`${featureClass}-${feature.id}`}
                        >
                          {featureClass}
                        </label>
                      </div>
                    </ListGroupItem>
                  ))}
                </ListGroup>
              </Collapse>
            </ListGroupItem>
          ))}
      </ListGroup>
      <Alert
        color="danger"
        className="mt-3 compute-error"
        isOpen={backendErrorVisible}
        toggle={hideBackendError}
      >
        Error from the backend: {backendError}
      </Alert>
      {currentFeature && (
        <FeaturesModal
          isOpen={modal}
          toggle={toggleModal}
          feature={currentFeature}
        />
      )}
      <Link to="/">Back to Home</Link>
    </section>
  );
}

export default Study;

function parseMetadata(metadata) {
  if (metadata) {
    let series = {};
    for (let entry of metadata) {
      let modality = entry[DicomFields.MODALITY][DicomFields.VALUE][0];
      if (!series[modality]) series[modality] = [];

      series[modality].push(entry);
    }
    return series;
  } else {
    return null;
  }
}

function parseFeatureFamilyConfig(config) {
  let yamlConfig = YAML.parse(config);

  let featureClass = yamlConfig.featureClass ? yamlConfig.featureClass : null;

  let imageType = yamlConfig.imageType ? yamlConfig.imageType : null;

  let setting = yamlConfig.setting ? yamlConfig.setting : null;

  return {
    featureClass: featureClass,
    imageType: imageType,
    setting: setting
  };
}
