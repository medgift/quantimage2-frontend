import React, { useCallback, useState, useEffect, useContext } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  Collapse,
  ListGroupItem
} from 'reactstrap';
import { DB_DATE_FORMAT, FEATURE_STATUS } from '../config/constants';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import Backend from '../services/backend';
import downloadFeature from '../utils/featureDownload';
import FeaturesModal from '../FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from '../context/SocketContext';
import { cloneDeep } from 'lodash';

export default function FeaturesList({ studyUID }) {
  let [keycloak] = useKeycloak();

  let [features, setFeatures] = useState([]);
  let [currentFeature, setCurrentFeature] = useState(null);
  let [settingsCollapse, setSettingsCollapse] = useState({});
  let [backendError, setBackendError] = useState(null);
  let [backendErrorVisible, setBackendErrorVisible] = useState(false);
  let [modal, setModal] = useState(false);

  let socket = useContext(SocketContext);

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
            feature_family: featureFamily
            //config: studyFeature.config
          });
        } else {
          features.push({
            updated_at: null,
            status: FEATURE_STATUS.NOT_COMPUTED,
            status_message: null,
            payload: null,
            feature_family: featureFamily,
            config: cloneDeep(featureFamily.config)
          });
        }
      }

      setFeatures(features);
    }

    getFeatures();
  }, [studyUID, keycloak]);

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
        feature.feature_family.name,
        feature.config
      );

      updateFeature(feature, {
        id: featureInProgress.id,
        status: FEATURE_STATUS.STARTED,
        status_message: FEATURE_STATUS.properties[FEATURE_STATUS.STARTED].name
      });
    } catch (err) {
      updateFeature(feature, {
        status: FEATURE_STATUS.FAILURE
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

  let updateFeatureConfig = (e, feature, backend, featureName) => {
    const checked = e.target.checked;

    let updatedFeatures = [...features];
    let featureToUpdate = updatedFeatures.find(
      f => f.feature_family.name === feature.feature_family.name
    );

    let featureConfig = featureToUpdate.config;

    if (!checked) {
      let currentFeatures = featureConfig.backends[backend].features;

      let newFeatures = currentFeatures.filter(fName => fName !== featureName);

      featureConfig.backends[backend].features = newFeatures;
    } else {
      featureConfig.backends[backend].features = [
        ...featureConfig.backends[backend].features,
        featureName
      ];
    }

    setFeatures(updatedFeatures);
  };

  return (
    <>
      <ListGroup className="features-list">
        {features &&
          features.map(feature => (
            <ListGroupItem key={feature.feature_family.name}>
              <div className="feature-summary d-flex justify-content-between align-items-center">
                <div
                  className={
                    `mr-2 text-left` +
                    (feature.status === FEATURE_STATUS.IN_PROGRESS
                      ? ' text-muted'
                      : '')
                  }
                >
                  <span>
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
                  </span>
                  <div className="feature-description">
                    {Object.keys(feature.config.backends)
                      .reduce(
                        (featureNames, backend) => [
                          ...featureNames,
                          ...feature.config.backends[backend].features
                        ],
                        []
                      )
                      .sort((f1, f2) =>
                        f1.localeCompare(f2, undefined, { sensitivity: 'base' })
                      )
                      .join(', ')
                      .toLowerCase()}
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
                            disabled={
                              Object.keys(feature.config.backends).reduce(
                                (acc, backend) =>
                                  (acc +=
                                    feature.config.backends[backend].features
                                      .length),
                                0
                              ) === 0
                            }
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
                              Object.keys(feature.config.backends).reduce(
                                (acc, backend) =>
                                  (acc +=
                                    feature.config.backends[backend].features
                                      .length),
                                0
                              ) === 0
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
                {Object.keys(feature.feature_family.config.backends).map(
                  backend => (
                    <div key={backend}>
                      <div>{backend}</div>
                      <ListGroup>
                        {feature.feature_family.config.backends[
                          backend
                        ].features.map(featureName => (
                          <ListGroupItem
                            className="text-left"
                            key={`${featureName}-${feature.id}`}
                            disabled={
                              feature.status === FEATURE_STATUS.IN_PROGRESS ||
                              feature.status === FEATURE_STATUS.STARTED
                            }
                          >
                            <div className="custom-control custom-checkbox">
                              <input
                                type="checkbox"
                                className="custom-control-input"
                                checked={feature.config.backends[
                                  backend
                                ].features.includes(featureName)}
                                onChange={e =>
                                  updateFeatureConfig(
                                    e,
                                    feature,
                                    backend,
                                    featureName
                                  )
                                }
                                id={`${featureName}-${feature.id}`}
                              />
                              <label
                                className="custom-control-label d-block"
                                htmlFor={`${featureName}-${feature.id}`}
                              >
                                {featureName.toLowerCase()}
                              </label>
                            </div>
                          </ListGroupItem>
                        ))}
                      </ListGroup>
                    </div>
                  )
                )}
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
    </>
  );
}
