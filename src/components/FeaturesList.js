import React, { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  FormGroup,
  Input,
  Label,
  ListGroupItem,
} from 'reactstrap';
import { FEATURE_STATUS } from '../config/constants';

import { v4 as uuidv4 } from 'uuid';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import Backend from '../services/backend';
import FeaturesModal from '../FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from '../context/SocketContext';

import TreeView from '@material-ui/lab/TreeView';
import TreeItem from '@material-ui/lab/TreeItem';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import _ from 'lodash';

import './FeaturesList.css';

export default function FeaturesList({
  albumID,
  studyDate,
  patientID,
  setMinWidth,
  extractionCallback,
  forceUpdate,
  nbStudies,
}) {
  let [keycloak] = useKeycloak();

  // Data
  let [featurePresets, setFeaturePresets] = useState([]);
  let [extraction, setExtraction] = useState(null);
  let [albumROIs, setAlbumROIs] = useState(null);

  // Selections
  let [selectedPreset, setSelectedPreset] = useState(null);
  let [selectedROIs, setSelectedROIs] = useState(null);

  // Errors
  let [backendError, setBackendError] = useState(null);
  let [backendErrorVisible, setBackendErrorVisible] = useState(false);

  // Misc
  let [modal, setModal] = useState(false);

  let socket = useContext(SocketContext);

  const handleFeatureStatus = (featureStatus) => {
    console.log('GOT TASK STATUS!!!', featureStatus);

    if (featureStatus.status === FEATURE_STATUS.FAILURE) {
      setBackendError(featureStatus.status_message);
      setBackendErrorVisible(true);
    }
  };

  const handleExtractionStatus = (extractionStatus) => {
    console.log('GOT EXTRACTION STATUS!!!', extractionStatus);

    setExtraction((extraction) => {
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
            status: extractionStatus.status,
          };
        } else {
          return extraction;
        }
      }
    });
  };

  /* Fetch initial data */
  useEffect(() => {
    async function getFeaturePresets() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      if (latestExtraction) {
        setExtraction(latestExtraction);
      }

      const featurePresets = await Backend.presets(keycloak.token);
      featurePresets.sort((fp1, fp2) => fp1.name.localeCompare(fp2.name));
      setFeaturePresets(featurePresets);

      setSelectedPreset(featurePresets[0]);
    }

    getFeaturePresets();
  }, [albumID, keycloak]);

  useEffect(() => {
    async function getAlbumROIs() {
      const albumROIs = await Backend.albumROIs(
        keycloak.token,
        albumID,
        forceUpdate
      );

      setAlbumROIs(albumROIs);

      setSelectedROIs(
        Object.keys(albumROIs).filter((r) => albumROIs[r] === nbStudies)
      );
    }

    getAlbumROIs();
  }, [albumID, keycloak, forceUpdate, nbStudies]);

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
      let featureExtraction = await Backend.extract(
        keycloak.token,
        albumID,
        selectedPreset.config,
        selectedROIs
      );

      console.log(
        'Setting feature extraction! With ' +
          featureExtraction.tasks.length +
          ' tasks!'
      );
      setExtraction(featureExtraction);

      if (extractionCallback) {
        extractionCallback(featureExtraction);
      }
    } catch (err) {
      setBackendError(err.message);
      setBackendErrorVisible(true);
    }
  };

  const handlePresetClick = (e) => {
    setSelectedPreset(featurePresets.find((p) => p.id === +e.target.value));
  };

  let handleViewFeaturesClick = () => {
    toggleModal();
  };

  let handleDownloadFeaturesClick = async (e) => {
    window.location.href = Backend.downloadExtractionURL(
      extraction.id,
      patientID,
      studyDate
    );
  };

  return (
    <>
      <ListGroup
        className={`features-list ${setMinWidth ? 'min-width-510' : ''}`}
      >
        <ListGroupItem>
          <span>Select Configuration Preset</span>
        </ListGroupItem>
        {featurePresets && selectedPreset && (
          <ListGroupItem>
            {featurePresets.map((preset) => (
              <FormGroup check inline key={preset.id}>
                <Label check>
                  <Input
                    type="radio"
                    name="selectedPreset"
                    checked={selectedPreset.id === preset.id}
                    value={preset.id}
                    onChange={handlePresetClick}
                  />{' '}
                  {preset.name}
                </Label>
              </FormGroup>
            ))}
            <RecursiveTreeView
              data={{ 'Show configuration options': selectedPreset.config }}
            />
          </ListGroupItem>
        )}
        <ListGroupItem>Select ROIs to extract</ListGroupItem>
        <ListGroupItem>
          {albumROIs !== null && selectedROIs !== null ? (
            <ROIsList
              rois={albumROIs}
              selectedROIs={selectedROIs}
              setSelectedROIs={setSelectedROIs}
              nbStudies={nbStudies}
            />
          ) : (
            <span>
              <FontAwesomeIcon icon="sync" spin className="mr-2" /> Loading
              album ROIs...
            </span>
          )}
        </ListGroupItem>
        {(!extraction ||
          (extraction &&
            (extraction.status.successful || extraction.status.failed))) && (
          <>
            <ListGroupItem>
              <span>Actions</span>
            </ListGroupItem>

            <ListGroupItem>
              <ButtonGroup>
                <Button
                  color="success"
                  onClick={handleExtractFeaturesClick}
                  disabled={albumROIs === null}
                >
                  <FontAwesomeIcon icon="cog"></FontAwesomeIcon>{' '}
                  <span>Extract Features</span>
                </Button>
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
        className="mt-3"
        isOpen={backendErrorVisible}
        toggle={hideBackendError}
      >
        Error from the backend: {backendError}
      </Alert>
      {extraction && !albumID && (
        <FeaturesModal
          isOpen={modal}
          toggle={toggleModal}
          extractionID={extraction.id}
        />
      )}
    </>
  );
}

function formatTreeData(object) {
  return Object.entries(object).map(([key, value]) =>
    value && _.isPlainObject(value)
      ? {
          id: uuidv4(),
          name: isNaN(key) ? key : `Item #${key}`,
          children: formatTreeData(value),
        }
      : value && _.isArray(value) && !_.isObject(value[0])
      ? {
          id: uuidv4(),
          name: key,
          children: value.map((v, i) => ({ id: `${v}-${i}`, name: v })),
        }
      : value && _.isArray(value) && _.isObject(value[0])
      ? {
          id: uuidv4(),
          name: key,
          children: formatTreeData(value),
        }
      : {
          id: uuidv4(),
          name: value !== null ? `${key} : ${value}` : `${key}`,
        }
  );
}

function RecursiveTreeView({ data }) {
  const renderTree = (nodes) => {
    return (
      <TreeItem key={nodes.id} nodeId={nodes.id} label={nodes.name}>
        {Array.isArray(nodes.children)
          ? nodes.children.map((node) => renderTree(node))
          : null}
      </TreeItem>
    );
  };

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpanded={['root']}
      defaultExpandIcon={<ChevronRightIcon />}
      className="text-left m-2 FeatureConfig-tree"
    >
      {renderTree(formatTreeData(data)[0])}
    </TreeView>
  );
}

function ROIsList({ rois, selectedROIs, setSelectedROIs, nbStudies }) {
  const toggleValue = (roi, checked) => {
    let newSelections = [...selectedROIs];

    if (checked) {
      newSelections.push(roi);
    } else {
      newSelections = newSelections.filter((r) => r !== roi);
    }

    setSelectedROIs(newSelections);
  };

  let sortedROIs = Object.keys(rois).sort((r1, r2) => {
    if (rois[r1] === rois[r2]) return r1.localeCompare(r2);
    else return rois[r2] - rois[r1];
  });

  const getStudiesLabel = (roi) => {
    let color = rois[roi] === nbStudies ? 'text-success' : null;

    return (
      <span className={color}>
        {roi} ({rois[roi]}/{nbStudies})
      </span>
    );
  };

  return (
    <div className="d-flex justify-content-center flex-wrap ROIList">
      {sortedROIs.map((roi) => (
        <div key={roi} className="ROIList-Item text-left">
          {/*<MyCheckbox
            id={`roi-${roi}`}
            checked={selectedROIs.includes(roi)}
            onChange={(e) => {
              toggleValue(roi, e.target.checked);
            }}
          />*/}
          <input
            type="checkbox"
            id={`roi-${roi}`}
            checked={selectedROIs.includes(roi)}
            onChange={(e) => {
              toggleValue(roi, e.target.checked);
            }}
          />{' '}
          <label htmlFor={`roi-${roi}`}>{getStudiesLabel(roi)}</label>
        </div>
      ))}
    </div>
  );
}
