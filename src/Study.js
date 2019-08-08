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
  ListGroupItem,
  Modal,
  Spinner,
  Table
} from 'reactstrap';
import moment from 'moment';
import DicomFields from './dicom/fields';
import {
  DICOM_DATE_FORMAT,
  DB_DATE_FORMAT,
  FEATURE_STATUS
} from './config/constants';

import './Study.css';
import ButtonGroup from 'reactstrap/es/ButtonGroup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';
import SocketContext from './context/SocketContext';
import ModalHeader from 'reactstrap/es/ModalHeader';
import ModalBody from 'reactstrap/es/ModalBody';
import Card from 'reactstrap/es/Card';
import CardTitle from 'reactstrap/es/CardTitle';
import CardBody from 'reactstrap/es/CardBody';
import CardText from 'reactstrap/es/CardText';

function Study({ match, kheopsError }) {
  let {
    params: { studyUID }
  } = match;

  let socket = useContext(SocketContext);

  let [studyMetadata, setStudyMetadata] = useState(null);
  let [features, setFeatures] = useState([]);
  let [currentFeature, setCurrentFeature] = useState(null);
  let [modal, setModal] = useState(false);

  let series = useMemo(() => parseMetadata(studyMetadata), [studyMetadata]);

  let toggleModal = () => {
    setModal(!modal);
  };

  let handleComputeFeaturesClick = async feature => {
    let featureInProgress = await Backend.extract(studyUID, feature.name);

    updateFeature(feature, {
      id: featureInProgress.id,
      status: featureInProgress.status,
      status_message: 'Starting'
    });
  };

  let handleViewFeaturesClick = feature => {
    console.log(feature.payload);
    setCurrentFeature(feature);
    toggleModal();
  };

  const updateFeature = useCallback(
    (feature, { ...rest }) => {
      // Update element in feature
      setFeatures(
        features.map(f => {
          if (feature.name === f.name) {
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
      const featureTypes = await Backend.featureTypes();
      const studyFeatures = await Backend.features(studyUID);

      let features = [];

      for (let featureType of featureTypes) {
        let studyFeature = studyFeatures.find(
          studyFeature => studyFeature.name === featureType
        );

        if (studyFeature) {
          features.push(studyFeature);
        } else {
          features.push({
            name: featureType,
            updated_at: null,
            status: FEATURE_STATUS.NOT_COMPUTED,
            status_message: null,
            payload: null
          });
        }
      }

      setFeatures(features);
    }

    async function getStudyMetadata() {
      const studyMetadata = await Kheops.studyMetadata(studyUID);
      setStudyMetadata(studyMetadata);
    }

    getFeatures();
    getStudyMetadata();
  }, [studyUID]);

  /* Manage Socket.IO events */
  useEffect(() => {
    socket.on('feature-status', featureStatus => {
      console.log('GOT FEATURE STATUS!!!', featureStatus);

      if (features !== null) {
        let foundFeature = features.find(
          f => f.id && f.id === featureStatus.feature_id
        );

        if (foundFeature) {
          let updatedFeature = {
            status: featureStatus.status,
            status_message: featureStatus.status_message
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
                      {series[dataset].length > 1 ? 'images' : 'image'}
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
            <ListGroupItem
              key={feature.name}
              className="d-flex justify-content-between align-items-center"
            >
              <div
                className={
                  `mr-2` + feature.status === FEATURE_STATUS.IN_PROGRESS
                    ? ' text-muted'
                    : ''
                }
              >
                {feature.name}{' '}
                <small>
                  {feature.status === FEATURE_STATUS.NOT_COMPUTED && (
                    <>(never computed)</>
                  )}
                  {feature.status === FEATURE_STATUS.IN_PROGRESS && (
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
              </div>
              <ButtonGroup className="ml-1">
                {(() => {
                  switch (feature.status) {
                    case FEATURE_STATUS.NOT_COMPUTED:
                      return (
                        <Button
                          color="success"
                          onClick={() => {
                            handleComputeFeaturesClick(feature);
                          }}
                        >
                          <FontAwesomeIcon
                            icon="cog"
                            title="Compute Features"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    case FEATURE_STATUS.IN_PROGRESS:
                      return (
                        <Button color="secondary" disabled>
                          <FontAwesomeIcon
                            icon="sync"
                            spin
                            title="Computation in Progress"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    case FEATURE_STATUS.COMPLETE:
                      return (
                        <Button
                          color="primary"
                          onClick={() => {
                            handleComputeFeaturesClick(feature);
                          }}
                        >
                          <FontAwesomeIcon
                            icon="redo"
                            title="Recompute Features"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    default:
                      return null;
                  }
                })()}
                {feature.status !== FEATURE_STATUS.NOT_COMPUTED && (
                  <Button
                    color="info"
                    disabled={feature.status === FEATURE_STATUS.IN_PROGRESS}
                    onClick={() => {
                      handleViewFeaturesClick(feature);
                    }}
                  >
                    <FontAwesomeIcon
                      icon="search"
                      title="View Features"
                    ></FontAwesomeIcon>
                  </Button>
                )}
              </ButtonGroup>
            </ListGroupItem>
          ))}
      </ListGroup>
      {currentFeature && (
        <Modal
          isOpen={modal}
          toggle={toggleModal}
          size="lg"
          className="feature-modal"
        >
          <ModalHeader toggle={toggleModal}>
            Computed "{currentFeature.name}" Features
          </ModalHeader>
          <ModalBody>
            {Object.keys(currentFeature.payload).map((key, index) => (
              <Card key={index}>
                <CardBody>
                  <CardTitle>{key}</CardTitle>
                  <CardText className="text-muted">
                    {JSON.stringify(currentFeature.payload[key], null, 1)}
                  </CardText>
                </CardBody>
              </Card>
            ))}
          </ModalBody>
        </Modal>
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
