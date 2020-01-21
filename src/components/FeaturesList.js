import React, { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  Collapse,
  ListGroupItem
} from 'reactstrap';
import { FEATURE_STATUS } from '../config/constants';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import Backend from '../services/backend';
import FeaturesModal from '../FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from '../context/SocketContext';
import { cloneDeep } from 'lodash';
import { downloadFeature } from '../utils/feature-utils';
import Kheops from '../services/kheops';

export default function FeaturesList({
  albumID,
  studyUID,
  setMinWidth,
  extractionCallback
}) {
  let [keycloak] = useKeycloak();

  // Data
  let [featureFamiles, setFeatureFamilies] = useState([]);
  let [featureConfigs, setFeatureConfigs] = useState({});
  let [extraction, setExtraction] = useState(null);
  let [tasks, setTasks] = useState([]);

  // Selections
  let [selectedFamilies, setSelectedFamilies] = useState({});
  let [settingsCollapse, setSettingsCollapse] = useState({});

  // Errors
  let [backendError, setBackendError] = useState(null);
  let [backendErrorVisible, setBackendErrorVisible] = useState(false);

  // Misc
  let [modal, setModal] = useState(false);

  let socket = useContext(SocketContext);

  const handleFeatureStatus = featureStatus => {
    console.log('GOT TASK STATUS!!!', featureStatus);

    if (featureStatus.status === FEATURE_STATUS.FAILURE) {
      setBackendError(featureStatus.status_message);
      setBackendErrorVisible(true);
    }

    setTasks(tasks =>
      tasks.map(task => {
        if (task.id === featureStatus.feature_extraction_task_id) {
          return {
            ...task,
            status: featureStatus.status,
            status_message: featureStatus.status_message
          };
        }

        return task;
      })
    );
  };

  const handleExtractionStatus = extractionStatus => {
    console.log('GOT EXTRACTION STATUS!!!', extractionStatus);

    setExtraction(extraction => {
      if (extractionStatus.id) {
        if (extraction && extractionStatus.id === extraction.id) {
          return { ...extractionStatus };
        } else {
          return extraction;
        }
      } else {
        if (
          extraction &&
          extractionStatus.feature_extraction_id === extraction.id
        ) {
          return {
            ...extraction,
            status: extractionStatus.status
          };
        } else {
          return extraction;
        }
      }
    });
  };

  /* Fetch initial data */
  useEffect(() => {
    async function getFeatureFamiliesAndConfigs() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID,
        studyUID
      );

      if (latestExtraction) {
        setExtraction(latestExtraction);
        setTasks(latestExtraction.tasks);
      }

      const featureFamilies = await Backend.families(keycloak.token);

      setFeatureFamilies(featureFamilies);

      let settingsCollapse = {};

      for (let featureFamily of featureFamilies) {
        settingsCollapse[featureFamily.id] = false;
      }

      setSettingsCollapse(settingsCollapse);

      let selectedFamilies = {};
      let featureConfigs = {};

      for (let featureFamily of featureFamilies) {
        // Select all families by default if there is no extraction, otherwise restore config of previous extraction
        if (!latestExtraction) {
          selectedFamilies[featureFamily.id] = true;
          featureConfigs[featureFamily.id] = cloneDeep(featureFamily.config);
        } else {
          let familyInExtraction = latestExtraction.families.find(
            family => family.feature_family.id === featureFamily.id
          );

          selectedFamilies[featureFamily.id] = familyInExtraction !== undefined;

          if (familyInExtraction) {
            featureConfigs[featureFamily.id] = cloneDeep(
              familyInExtraction.config
            );
          } else {
            featureConfigs[featureFamily.id] = cloneDeep(featureFamily.config);
          }
        }
      }

      setSelectedFamilies(selectedFamilies);
      setFeatureConfigs(featureConfigs);
    }

    getFeatureFamiliesAndConfigs();
  }, [albumID, studyUID, keycloak]);

  /* Manage Socket.IO events */
  useEffect(() => {
    console.log('Configure Socket Listeners');

    socket.on('feature-status', handleFeatureStatus);
    socket.on('extraction-status', handleExtractionStatus);

    return () => {
      socket.off('feature-status', handleFeatureStatus);
      socket.off('extraction-status', handleExtractionStatus);
    };
  }, [socket]);

  let toggleModal = () => {
    setModal(!modal);
  };

  let hideBackendError = () => {
    setBackendErrorVisible(false);
  };

  let handleExtractFeaturesClick = async () => {
    try {
      let featureFamiliesMap = makeFeatureFamiliesMap(
        selectedFamilies,
        featureConfigs
      );

      let featureExtraction = await Backend.extract(
        keycloak.token,
        albumID,
        featureFamiliesMap,
        studyUID
      );

      console.log(
        'Setting feature extraction! With ' +
          featureExtraction.tasks.length +
          ' tasks!'
      );
      setExtraction(featureExtraction);
      setTasks(featureExtraction.tasks);

      if (extractionCallback) {
        extractionCallback(featureExtraction);
      }
    } catch (err) {
      setBackendError(err.message);
      setBackendErrorVisible(true);
    }
  };

  let makeFeatureFamiliesMap = (selectedFamilies, featureConfigs) => {
    let featureFamiliesMap = {};

    for (let selectedFamilyID in selectedFamilies) {
      if (selectedFamilies[selectedFamilyID] === true) {
        featureFamiliesMap[selectedFamilyID] =
          featureConfigs[+selectedFamilyID];
      }
    }

    return featureFamiliesMap;
  };

  let handleViewFeaturesClick = () => {
    toggleModal();
  };

  let handleDownloadFeaturesClick = async e => {
    let study = await Kheops.study(keycloak.token, studyUID);
    await downloadFeature(extraction, study);
  };

  let handleToggleSettingsClick = familyID => {
    setSettingsCollapse(prevState => ({
      ...prevState,
      [familyID]: !prevState[familyID]
    }));
  };

  let updateFeatureConfig = (e, featureConfig, backend, featureName) => {
    const checked = e.target.checked;

    let updatedFeatureConfigs = { ...featureConfigs };

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

    setFeatureConfigs(updatedFeatureConfigs);
  };

  let handleFamilyCheck = (e, featureFamilyId) => {
    let checked = e.target.checked;

    setSelectedFamilies(selectedFamilies => ({
      ...selectedFamilies,
      [featureFamilyId]: checked
    }));
  };

  let getFeatureTaskStatus = featureFamilyID => {
    let task = tasks.find(task => task.feature_family.id === featureFamilyID);

    return (
      task &&
      task.status !== FEATURE_STATUS.COMPLETE &&
      (task.status !== FEATURE_STATUS.FAILURE ? (
        <span>
          <small>{task ? task.status_message : ''}...</small>
        </span>
      ) : (
        <span className="text-danger">
          <small>ERROR - {task ? task.status_message : ''}...</small>
        </span>
      ))
    );
  };

  return (
    <>
      <ListGroup
        className={`features-list ${setMinWidth ? 'min-width-510' : ''}`}
      >
        <ListGroupItem>
          <span>Feature Configuration</span>
        </ListGroupItem>
        {featureFamiles.length > 0 &&
          Object.keys(featureConfigs).length > 0 &&
          featureFamiles.map(featureFamily => (
            <ListGroupItem
              key={featureFamily.id}
              disabled={extraction && !extraction.status.ready}
            >
              <div className="d-flex flex-column">
                <div className="feature-summary d-flex align-items-center">
                  <div className={`custom-control custom-checkbox flex-grow-1`}>
                    <input
                      type="checkbox"
                      className="custom-control-input"
                      checked={selectedFamilies[featureFamily.id]}
                      onChange={e => {
                        handleFamilyCheck(e, featureFamily.id);
                      }}
                      id={`${featureFamily.id}-${featureFamily.name}`}
                      aria-label={`Extract ${featureFamily.name} features`}
                      disabled={extraction && !extraction.status.ready}
                    />
                    <label
                      className="custom-control-label d-block text-left"
                      htmlFor={`${featureFamily.id}-${featureFamily.name}`}
                    >
                      <span>{featureFamily.name} </span>
                      {getFeatureTaskStatus(featureFamily.id)}
                    </label>
                  </div>
                  <ButtonGroup className="ml-1">
                    <Button
                      color="primary"
                      title="Configure feature extraction"
                      onClick={() => {
                        handleToggleSettingsClick(featureFamily.id);
                      }}
                      disabled={extraction && !extraction.status.ready}
                    >
                      <FontAwesomeIcon icon="tasks"></FontAwesomeIcon>
                    </Button>
                  </ButtonGroup>
                </div>
                <div className="feature-description text-left">
                  {Object.keys(featureConfigs[featureFamily.id].backends)
                    .reduce(
                      (featureNames, backend) => [
                        ...featureNames,
                        ...featureConfigs[featureFamily.id].backends[backend]
                          .features
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
              <Collapse
                isOpen={settingsCollapse[featureFamily.id]}
                className="mt-2"
                id={`settings-${featureFamily.id}`}
              >
                {Object.keys(featureFamily.config.backends).map(backend => (
                  <div key={backend}>
                    <div>{backend}</div>
                    <ListGroup>
                      {featureFamily.config.backends[backend].features.map(
                        featureName => (
                          <ListGroupItem
                            className="text-left"
                            key={`${featureName}`}
                          >
                            <div className="custom-control custom-checkbox">
                              <input
                                type="checkbox"
                                className="custom-control-input"
                                checked={featureConfigs[
                                  featureFamily.id
                                ].backends[backend].features.includes(
                                  featureName
                                )}
                                onChange={e =>
                                  updateFeatureConfig(
                                    e,
                                    featureConfigs[featureFamily.id],
                                    backend,
                                    featureName
                                  )
                                }
                                id={`${featureName}`}
                                disabled={
                                  extraction && !extraction.status.ready
                                }
                              />
                              <label
                                className="custom-control-label d-block"
                                htmlFor={`${featureName}`}
                              >
                                {featureName.toLowerCase()}
                              </label>
                            </div>
                          </ListGroupItem>
                        )
                      )}
                    </ListGroup>
                  </div>
                ))}
              </Collapse>
            </ListGroupItem>
          ))}
        {(!extraction ||
          (extraction &&
            (extraction.status.successful || extraction.status.failed))) && (
          <>
            <ListGroupItem>
              <span>Actions</span>
            </ListGroupItem>

            <ListGroupItem>
              <ButtonGroup>
                <Button color="success" onClick={handleExtractFeaturesClick}>
                  <FontAwesomeIcon icon="cog"></FontAwesomeIcon>{' '}
                  <span>Extract Features</span>
                </Button>
                {extraction && (
                  <>
                    <Button
                      color="info"
                      disabled={false}
                      onClick={handleViewFeaturesClick}
                      title="View Features"
                    >
                      <FontAwesomeIcon icon="search"></FontAwesomeIcon>{' '}
                      <span>View Features</span>
                    </Button>
                    <Button
                      color="secondary"
                      disabled={false}
                      onClick={handleDownloadFeaturesClick}
                      title="Download Features"
                    >
                      <FontAwesomeIcon icon="download"></FontAwesomeIcon>{' '}
                      <span>Download Features</span>
                    </Button>
                  </>
                )}
              </ButtonGroup>
            </ListGroupItem>
          </>
        )}
        {extraction && !extraction.status.ready && (
          <>
            <ListGroupItem>
              <span>Status</span>
            </ListGroupItem>
            <ListGroupItem>
              <FontAwesomeIcon icon="sync" spin></FontAwesomeIcon>{' '}
              <span>Computing features...</span>
            </ListGroupItem>
          </>
        )}
      </ListGroup>

      <Alert
        color="danger"
        className="mt-3 compute-error"
        isOpen={backendErrorVisible}
        toggle={hideBackendError}
      >
        Error from the backend: {backendError}
      </Alert>
      {extraction && !albumID && (
        <FeaturesModal
          isOpen={modal}
          toggle={toggleModal}
          extraction={extraction}
          studyUID={studyUID}
        />
      )}
    </>
  );
}
