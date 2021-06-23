import React, { useCallback, useContext, useEffect, useState } from 'react';
import DicomFields from './dicom/fields';
import moment from 'moment';
import './Dashboard.css';
import Backend from './services/backend';
import Kheops from './services/kheops';
import { useHistory } from 'react-router-dom';
import {
  Alert,
  Button,
  Collapse,
  Jumbotron,
  ListGroup,
  ListGroupItem,
  Spinner,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import { DICOM_DATE_FORMAT } from './config/constants';
import { Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FeaturesList from './components/FeaturesList';
import MyModal from './components/MyModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from './context/SocketContext';
import { trainModel } from './utils/feature-utils';

function Dashboard({ albums, studies, dataFetched, kheopsError }) {
  let [modal, setModal] = useState(false);
  let [currentAlbum, setCurrentAlbum] = useState(null);
  let [extractions, setExtractions] = useState(null);
  let [models, setModels] = useState(null);
  let [keycloak] = useKeycloak();
  let history = useHistory();

  let socket = useContext(SocketContext);

  let handleExtractAlbumClick = (album) => {
    setModal(true);
    setCurrentAlbum(album);
  };

  let handleDownloadAlbumClick = async (album) => {
    let albumExtraction = extractions.find(
      (extraction) => extraction.album_id === album.album_id
    );

    window.location.href = Backend.downloadExtractionURL(
      albumExtraction.id,
      null,
      null,
      null,
      keycloak.tokenParsed.sub
    );
  };

  let handleEditAlbumClick = async (album) => {
    // Redirect to feature table route here
    history.push(`/features/${album.album_id}/overview`);
  };

  let handleVisualizeAlbumClick = async (album) => {
    // Redirect to visualization page here
    history.push(`/visualize/${album.album_id}`);
  };

  let toggleModal = () => {
    setModal(!modal);
  };

  let updateExtraction = (featureExtractionID, updatedContent) => {
    setExtractions((extractions) => {
      let updatedExtractions = [...extractions];
      let extractionToUpdate = updatedExtractions.find(
        (extraction) => extraction.id === featureExtractionID
      );

      if (extractionToUpdate) {
        Object.assign(extractionToUpdate, {
          ...extractionToUpdate,
          ...updatedContent,
        });
      }

      return updatedExtractions;
    });
  };

  let replaceExtraction = (albumID, newExtraction) => {
    setExtractions((extractions) => {
      let updatedExtractions = [...extractions];
      let extractionToReplace = updatedExtractions.find(
        (extraction) => extraction.album_id === albumID
      );

      if (extractionToReplace) {
        Object.assign(extractionToReplace, { ...newExtraction });
      } else {
        updatedExtractions.push(newExtraction);
      }

      return updatedExtractions;
    });
  };

  let showAlbumButtons = (album) => {
    let extractionButton = (
      <Button color="link" onClick={() => handleExtractAlbumClick(album)}>
        <FontAwesomeIcon icon="cog" /> <span>Extract Features</span>
      </Button>
    );

    let editButton = (
      <Button color="link success" onClick={() => handleEditAlbumClick(album)}>
        <FontAwesomeIcon icon="search-plus" /> <span>Explore Features</span>
      </Button>
    );

    let visualizeButton = (
      <Button color="link" onClick={() => handleVisualizeAlbumClick(album)}>
        <FontAwesomeIcon icon="chart-bar" /> <span>Visualize Features</span>
      </Button>
    );

    let downloadButton = (
      <Button color="link" onClick={() => handleDownloadAlbumClick(album)}>
        <FontAwesomeIcon icon="download" /> <span>Download Features</span>
      </Button>
    );

    let analyzeButton = (album, models) => (
      <Link
        to={`/models/${album.album_id}`}
        className="btn btn-link"
        href="#"
        title={album.name}
      >
        <FontAwesomeIcon icon="graduation-cap" />{' '}
        <span>{!models ? 'Train a Model' : 'Manage Models'}</span>
      </Link>
    );

    if (extractions && models) {
      let albumExtraction = extractions.find(
        (extraction) => extraction.album_id === album.album_id
      );

      let albumModels = models.find(
        (model) => model.album_id === album.album_id
      );

      if (!albumExtraction) {
        return <div>{extractionButton}</div>;
      } else if (
        !albumExtraction.status.successful &&
        !albumExtraction.status.failed
      ) {
        return (
          <div className="text-muted">
            <FontAwesomeIcon icon="sync" spin />{' '}
            {featureExtractionStatusText(albumExtraction)}
          </div>
        );
      } else if (albumExtraction.status.successful) {
        return (
          <div>
            {editButton}
            {/*downloadButton*/}
            {extractionButton}
            {/*visualizeButton*/}
            {/*analyzeButton(album, albumModels)*/}
          </div>
        );
      } else {
        return (
          <div>
            {albumExtraction.status.completed_tasks +
              albumExtraction.status.failed_tasks <
              albumExtraction.status.total_tasks && (
              <>
                <FontAwesomeIcon icon="sync" className="text-danger" spin />{' '}
              </>
            )}
            <span className="text-danger">
              {featureExtractionStatusText(albumExtraction)}
            </span>
            {albumExtraction.status.completed_tasks +
              albumExtraction.status.failed_tasks ===
              albumExtraction.status.total_tasks && extractionButton}
          </div>
        );
      }
    } else {
      return <span>Loading...</span>;
    }
  };

  const featureExtractionStatusText = (albumExtraction) => {
    if (
      albumExtraction.status.failed &&
      albumExtraction.status.completed_tasks +
        albumExtraction.status.failed_tasks ==
        albumExtraction.status.total_tasks
    ) {
      return (
        <span>
          Failed! ({albumExtraction.status.completed_tasks}/
          {albumExtraction.status.total_tasks} tasks successful)
        </span>
      );
    }

    if (
      albumExtraction.status.pending_tasks ===
      albumExtraction.status.total_tasks
    ) {
      return <span>Extraction Pending...</span>;
    }

    if (
      albumExtraction.status.total_tasks !== 0 &&
      (albumExtraction.status.completed_tasks > 0 ||
        albumExtraction.status.failed_tasks > 0)
    ) {
      return (
        <span>
          Extraction In Progress (
          {(
            ((albumExtraction.status.completed_tasks +
              albumExtraction.status.failed_tasks) /
              albumExtraction.status.total_tasks) *
            100
          ).toFixed()}
          %)
        </span>
      );
    } else {
      if (albumExtraction.status.pending_tasks !== 0) {
        return <span>Extraction Starting...</span>;
      } else {
        return <span>Fetching Data...</span>;
      }
    }
  };

  const getPatientNameForStudy = (study) => {
    if (
      study?.[DicomFields.PATIENT_NAME]?.[DicomFields.VALUE]?.[0]?.[
        DicomFields.ALPHABETIC
      ]
    ) {
      return study[DicomFields.PATIENT_NAME][DicomFields.VALUE][0][
        DicomFields.ALPHABETIC
      ];
    } else if (study?.[DicomFields.PATIENT_ID]?.[DicomFields.VALUE]?.[0]) {
      return `(ID) ${study[DicomFields.PATIENT_ID][DicomFields.VALUE][0]}`;
    } else {
      return 'UNNAMED';
    }
  };

  const [studyToggles, setStudyToggles] = useState({});

  const handleStudyToggle = (albumID) => {
    const updatedStudyToggles = { ...studyToggles };
    updatedStudyToggles[albumID] = !updatedStudyToggles[albumID];
    setStudyToggles(updatedStudyToggles);
  };

  const handleExtractionStatus = useCallback((extractionStatus) => {
    console.log(
      `STATUS for Extraction ${extractionStatus.feature_extraction_id} !!!`,
      extractionStatus
    );

    // If full extraction object
    if (extractionStatus.id) {
      console.log('Updating full object');
      updateExtraction(extractionStatus.id, {
        ...extractionStatus,
      });
    } else {
      updateExtraction(extractionStatus.feature_extraction_id, {
        status: extractionStatus.status,
      });
    }
  }, []);

  // Initialize all albums to NOT show the studies
  useEffect(() => {
    if (albums && albums.length > 0 && Object.keys(studyToggles).length === 0) {
      setStudyToggles(
        albums.reduce((acc, album) => {
          acc[album.album_id] = false;
          return acc;
        }, {})
      );
    }
  }, [albums]);

  // Subscribe to Socket messages
  useEffect(() => {
    socket.on('extraction-status', handleExtractionStatus);

    return () => {
      socket.off('extraction-status', handleExtractionStatus);
    };
  }, [socket, handleExtractionStatus]);

  // Load extractions & models
  useEffect(() => {
    async function getAlbumExtractions() {
      let latestExtractions = [];
      for (let album of albums) {
        let latestExtraction = await Backend.extractions(
          keycloak.token,
          album.album_id
        );

        if (latestExtraction) latestExtractions.push(latestExtraction);
      }

      setExtractions((extractions) => latestExtractions);
    }

    async function getAlbumModels() {
      let models = [];
      for (let album of albums) {
        let albumModels = await Backend.models(keycloak.token, album.album_id);
        if (albumModels) models.push(...albumModels);
      }
      setModels(models);
    }

    if (albums && albums.length > 0) {
      getAlbumExtractions();
      getAlbumModels();
    }
  }, [keycloak, albums]);

  const getStudyStatusClass = (albumID, studyUID) => {
    if (!extractions) return '';

    let albumExtraction = extractions.find(
      (extraction) => extraction.album_id === albumID
    );

    if (!albumExtraction) {
      return '';
    } else {
      if (
        albumExtraction.status.errors &&
        albumExtraction.status.errors[studyUID]
      )
        return 'text-danger';
      else return '';
    }
  };

  const getStudyErrors = (albumID, studyUID) => {
    if (!extractions) return null;

    let albumExtraction = extractions.find(
      (extraction) => extraction.album_id === albumID
    );

    if (!albumExtraction) {
      return null;
    } else {
      if (
        albumExtraction.status.errors &&
        albumExtraction.status.errors[studyUID]
      )
        return (
          <FontAwesomeIcon
            icon="bug"
            title={albumExtraction.status.errors[studyUID].join('&#013;')}
          />
        );
      else return null;
    }
  };

  return (
    <>
      <div>
        <header className="App-header">
          <h1 data-testid="welcome-page-header">QuantImage v2</h1>
        </header>
        <section id="extract-features">
          <h2>Dashboard</h2>
          <p>
            This page allows you to extract features from studies that were
            added to your albums in the Kheops platform. You can then download
            the extracted features or train a machine learning model with them.
          </p>
          <h2>
            Your albums -{' '}
            <a
              href={`${process.env.REACT_APP_KHEOPS_URL}/albums`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon="external-link-alt"></FontAwesomeIcon>{' '}
              Manage in Kheops
            </a>
          </h2>
          <div>
            {!kheopsError && !dataFetched ? (
              <Spinner />
            ) : kheopsError || albums.length === 0 ? (
              <Jumbotron>
                <h1>No albums in Kheops</h1>
                <p className="lead">
                  It seems you have not yet created any albums in Kheops.
                </p>
                <hr className="my-2" />
                <p>
                  The first step to begin extracting features is to create an
                  album in Kheops and upload your patient cohort. Once this is
                  done, your album(s) will appear here and you can proceed with
                  extracting features, training machine learning models, etc.
                </p>
                <p>
                  <Button
                    color="primary"
                    href={`${process.env.REACT_APP_KHEOPS_URL}/albums`}
                    target="_blank"
                  >
                    Go to Kheops and get started
                  </Button>
                </p>
                <p className="lead"></p>
              </Jumbotron>
            ) : (
              albums.length > 0 &&
              Object.keys(studies).length > 0 && (
                <ListGroup className="albums">
                  {albums
                    .filter(
                      (album) =>
                        studies[album.album_id] &&
                        studies[album.album_id].length > 0
                    )
                    .map((album) => (
                      <ListGroupItem key={album.album_id}>
                        <div className="d-flex justify-content-between align-items-center">
                          <h5 style={{ margin: 0 }}>
                            {album.name}{' '}
                            <Badge pill>
                              {studies[album.album_id].length} studies
                            </Badge>
                          </h5>
                          {showAlbumButtons(album)}
                        </div>
                        {studies[album.album_id] && (
                          <>
                            <a
                              href="#"
                              onClick={() => {
                                handleStudyToggle(album.album_id);
                              }}
                            >
                              {studyToggles && studyToggles[album.album_id]
                                ? 'Hide studies'
                                : 'Show studies'}
                            </a>
                            <Collapse
                              isOpen={
                                studyToggles
                                  ? studyToggles[album.album_id]
                                  : false
                              }
                            >
                              <ListGroup>
                                {studies[album.album_id].map((study) => (
                                  <ListGroupItem
                                    key={
                                      study[DicomFields.STUDY_UID][
                                        DicomFields.VALUE
                                      ][0]
                                    }
                                    className="d-flex justify-content-between align-items-center"
                                  >
                                    <Link
                                      to={`/study/${
                                        study[DicomFields.STUDY_UID][
                                          DicomFields.VALUE
                                        ][0]
                                      }`}
                                      className={`btn btn-link ${getStudyStatusClass(
                                        album.album_id,
                                        study[DicomFields.STUDY_UID][
                                          DicomFields.VALUE
                                        ][0]
                                      )}`}
                                      href="#"
                                      title={
                                        study[DicomFields.STUDY_UID][
                                          DicomFields.VALUE
                                        ][0]
                                      }
                                    >
                                      {getPatientNameForStudy(study)} (
                                      {moment(
                                        study[DicomFields.DATE][
                                          DicomFields.VALUE
                                        ][0],
                                        DicomFields.DATE_FORMAT
                                      ).format(DICOM_DATE_FORMAT)}
                                      ){' '}
                                      {getStudyErrors(
                                        album.album_id,
                                        study[DicomFields.STUDY_UID][
                                          DicomFields.VALUE
                                        ][0]
                                      )}
                                    </Link>
                                    <div>
                                      {(() => {
                                        let modalities = [];

                                        // Determine if the modality types field is already an array or needs to be split
                                        let modalityArray = !study[
                                          DicomFields.MODALITIES
                                        ][DicomFields.VALUE][0].includes(',')
                                          ? study[DicomFields.MODALITIES][
                                              DicomFields.VALUE
                                            ]
                                          : study[DicomFields.MODALITIES][
                                              DicomFields.VALUE
                                            ][0].split(',');

                                        for (let modality of modalityArray) {
                                          modalities.push(
                                            <Badge
                                              color="primary"
                                              className="mr-1"
                                              key={modality}
                                            >
                                              {modality}
                                            </Badge>
                                          );
                                        }
                                        return modalities;
                                      })()}
                                    </div>
                                  </ListGroupItem>
                                ))}
                              </ListGroup>
                            </Collapse>
                          </>
                        )}
                      </ListGroupItem>
                    ))}
                </ListGroup>
              )
            )}
          </div>
        </section>
      </div>
      {currentAlbum && (
        <MyModal
          isOpen={modal}
          toggle={toggleModal}
          album={currentAlbum}
          title={
            <span>
              Feature Extraction for Album <strong>{currentAlbum.name}</strong>
            </span>
          }
        >
          <FeaturesList
            albumID={currentAlbum.album_id}
            extractionCallback={(newExtraction) => {
              toggleModal();
              replaceExtraction(newExtraction.album_id, newExtraction);
            }}
          />
        </MyModal>
      )}
    </>
  );
}

export default Dashboard;
