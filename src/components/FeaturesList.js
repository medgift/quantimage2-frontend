import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  FormGroup,
  Input,
  Label,
  ListGroupItem,
} from 'reactstrap';
import { FEATURE_STATUS, SOCKETIO_MESSAGES } from '../config/constants';

import yaml from 'js-yaml';

import { v4 as uuidv4 } from 'uuid';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';
import SocketContext from '../context/SocketContext';

import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import _ from 'lodash';

import './FeaturesList.css';
import { ConfigEditor } from './ConfigEditor';
import ConfigImport from './ConfigImport';
import { FEATURE_ID_SEPARATOR } from '../Visualisation';

const EXTRACTION_CONFIG_TREE_TITLE = 'Extraction Configuration';

export default function FeaturesList({
  albumID,
  studyDate,
  patientID,
  setMinWidth,
  extractionCallback,
  nbStudies,
}) {
  let { keycloak } = useKeycloak();

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

  // Configuration
  let [showEditor, setShowEditor] = useState(false);
  let [showImport, setShowImport] = useState(false);
  let [customConfig, setCustomConfig] = useState(null);

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
      const albumROIs = await Backend.albumROIs(keycloak.token, albumID);

      setAlbumROIs(albumROIs);

      setSelectedROIs(
        Object.keys(albumROIs).filter((r) => albumROIs[r] === nbStudies)
      );
    }

    getAlbumROIs();
  }, [albumID, keycloak, nbStudies]);

  /* Manage Socket.IO events */
  useEffect(() => {
    console.log('Configure Socket Listeners');

    socket.on(SOCKETIO_MESSAGES.FEATURE_STATUS, handleFeatureStatus);
    socket.on(SOCKETIO_MESSAGES.EXTRACTION_STATUS, handleExtractionStatus);

    return () => {
      socket.off(SOCKETIO_MESSAGES.FEATURE_STATUS, handleFeatureStatus);
      socket.off(SOCKETIO_MESSAGES.EXTRACTION_STATUS, handleExtractionStatus);
    };
  }, [socket]);

  let hideBackendError = () => {
    setBackendErrorVisible(false);
  };

  let handleExtractFeaturesClick = async () => {
    try {
      let featureExtraction = await Backend.extract(
        keycloak.token,
        albumID,
        showEditor && !parsedCustomConfig.error
          ? parsedCustomConfig
          : selectedPreset.config,
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
    setShowEditor(false);
    setCustomConfig(null);
    setSelectedPreset(featurePresets.find((p) => p.id === +e.target.value));
  };

  let handleEditConfigClick = () => {
    setShowEditor((s) => {
      if (s === true) {
        setCustomConfig(null);
      }
      if (s === false) {
        setShowImport(false);
      }
      return !s;
    });
  };

  let handleImportClick = () => {
    setShowImport((s) => {
      if (s === true) {
        setCustomConfig(null);
      }
      if (s === false) {
        setShowEditor(false);
      }
      return !s;
    });
  };

  const parsedCustomConfig = useMemo(() => {
    try {
      return yaml.load(customConfig);
    } catch (e) {
      return { error: e.message.substr(0, e.message.indexOf('\n')) };
    }
  }, [customConfig]);

  const selectAllROIs = () => {
    setSelectedROIs(Object.keys(albumROIs));
  };

  const selectNoROIs = () => {
    setSelectedROIs([]);
  };

  const refreshROIs = async () => {
    setAlbumROIs(null);
    setSelectedROIs(null);

    const albumROIs = await Backend.albumROIs(keycloak.token, albumID, true);

    setAlbumROIs(albumROIs);

    setSelectedROIs(
      Object.keys(albumROIs).filter((r) => albumROIs[r] === nbStudies)
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
            {showEditor && (
              <FormGroup check inline key="custom">
                <Label check>
                  <Input
                    type="radio"
                    name="selectedPreset"
                    checked={true}
                    value="custom"
                    onChange={handlePresetClick}
                  />{' '}
                  <strong>Custom</strong>
                </Label>
              </FormGroup>
            )}
            {featurePresets.map((preset) => (
              <FormGroup check inline key={preset.id}>
                <Label check>
                  <Input
                    type="radio"
                    name="selectedPreset"
                    checked={!showEditor && selectedPreset.id === preset.id}
                    value={preset.id}
                    onChange={handlePresetClick}
                  />{' '}
                  {preset.name}
                </Label>
              </FormGroup>
            ))}

            {customConfig && parsedCustomConfig.error ? (
              <Alert color="danger">
                Invalid YAML configuration : {parsedCustomConfig.error}
              </Alert>
            ) : (
              <RecursiveTreeView
                data={{
                  [EXTRACTION_CONFIG_TREE_TITLE]: !customConfig
                    ? selectedPreset.config
                    : parsedCustomConfig,
                }}
              />
            )}
            <Button color="primary" onClick={handleEditConfigClick} size="sm">
              <FontAwesomeIcon icon="pencil-alt" /> Edit Configuration
              (Advanced)
            </Button>
            <Button
              color="primary"
              onClick={handleImportClick}
              size="sm"
              className="ml-3"
            >
              <FontAwesomeIcon icon="file-import" /> Import Configuration
              (Expert)
            </Button>
            {showEditor && (
              <ConfigEditor
                config={customConfig || selectedPreset['config-raw']}
                setCustomConfig={setCustomConfig}
                error={parsedCustomConfig?.error}
              />
            )}
            {showImport && (
              <ConfigImport
                setCustomConfig={setCustomConfig}
                setShowImport={setShowImport}
                setShowEditor={setShowEditor}
              />
            )}
          </ListGroupItem>
        )}
        <ListGroupItem>
          <div>
            Select ROIs to extract{' '}
            <Button color="link" onClick={selectAllROIs}>
              All
            </Button>
            |
            <Button color="link" onClick={selectNoROIs}>
              None
            </Button>
            <Button
              style={{ position: 'absolute', right: 0 }}
              color="link"
              onClick={refreshROIs}
              title="Click here if ROIs are missing or otherwise inconsistent"
            >
              <FontAwesomeIcon icon="sync" /> Refresh ROIs
            </Button>
          </div>
        </ListGroupItem>
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
                  disabled={albumROIs === null || parsedCustomConfig?.error}
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
    </>
  );
}

function formatTreeData(object, prefix = '') {
  return Object.entries(object).map(([key, value]) => {
    let fullKey = `${prefix}${prefix && FEATURE_ID_SEPARATOR}${key}`;

    return value && _.isPlainObject(value)
      ? {
          id: fullKey,
          name: isNaN(key) ? key : `Item #${key}`,
          children: formatTreeData(value, fullKey),
        }
      : value && _.isArray(value) && !_.isObject(value[0])
      ? {
          id: fullKey,
          name: key,
          children: value.map((v, i) => ({
            id: `${fullKey}-${v}-${i}`,
            name: v,
          })),
        }
      : value && _.isArray(value) && _.isObject(value[0])
      ? {
          id: fullKey,
          name: key,
          children: formatTreeData(value, fullKey),
        }
      : {
          id: uuidv4(),
          name: value !== null ? `${key} : ${value}` : `${key}`,
        };
  });
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
      defaultExpanded={[EXTRACTION_CONFIG_TREE_TITLE]}
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
    <div className="d-flex flex-wrap ROIList">
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
