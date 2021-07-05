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

function Dashboard({ albums, dataFetched, kheopsError }) {
  let [modal, setModal] = useState(false);
  let [studies, setStudies] = useState({});
  let [currentAlbum, setCurrentAlbum] = useState(null);
  let [forceUpdate, setForceUpdate] = useState(false);
  let [extractions, setExtractions] = useState(null);
  let [models, setModels] = useState(null);
  let [keycloak] = useKeycloak();
  let history = useHistory();

  let socket = useContext(SocketContext);

  let handleExtractAlbumClick = (album, force) => {
    setModal(true);
    if (force) setForceUpdate(true);
    setCurrentAlbum(album);
  };

  let handleExploreAlbumClick = async (album) => {
    // Redirect to feature table route here
    history.push(`/features/${album.album_id}/overview`);
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

    let reextractionButton = (
      <Button color="link" onClick={() => handleExtractAlbumClick(album)}>
        <FontAwesomeIcon icon="cog" /> <span>Re-Extract Features</span>
      </Button>
    );

    let updateButton = (
      <Button color="link" onClick={() => handleExtractAlbumClick(album, true)}>
        <FontAwesomeIcon icon="cog" />{' '}
        <span>Data Change Detected - Update Features</span>
      </Button>
    );

    let exploreButton = (
      <Button
        color="link success"
        onClick={() => handleExploreAlbumClick(album)}
      >
        <FontAwesomeIcon icon="search-plus" /> <span>Explore Features</span>
      </Button>
    );

    if (extractions && models) {
      let albumExtraction = extractions.find(
        (extraction) => extraction.album_id === album.album_id
      );

      let albumModels = models.find(
        (model) => model.album_id === album.album_id
      );

      if (!albumExtraction) {
        // No extraction available
        return <div>{extractionButton}</div>;
      } else if (!albumExtraction.status.ready) {
        // Extraction in progress
        return (
          <div
            className={
              albumExtraction.status.failed_tasks > 0
                ? 'text-danger'
                : 'text-muted'
            }
          >
            <FontAwesomeIcon icon="sync" spin />{' '}
            {featureExtractionStatusText(albumExtraction)}
          </div>
        );
      } else if (albumExtraction.status.completed_tasks > 0) {
        // Successful (or partially so?)
        if (album.number_of_studies === albumExtraction.tasks.length) {
          return (
            <div>
              <span className="text-danger">
                {featureExtractionStatusText(albumExtraction)}
              </span>
              {exploreButton}
              {/*downloadButton*/}
              {reextractionButton}
              {/*visualizeButton*/}
              {/*analyzeButton(album, albumModels)*/}
            </div>
          );
        } else {
          return <div>{updateButton}</div>;
        }
      }
    } else {
      // Loading
      return <span>Loading...</span>;
    }
  };

  const featureExtractionStatusText = (albumExtraction) => {
    // Completely successful extraction
    if (albumExtraction.status.successful) return null;

    // Partially failed extraction
    if (
      albumExtraction.status.ready &&
      albumExtraction.status.failed_tasks > 0
    ) {
      return (
        <span>
          Partially Failed! ({albumExtraction.status.completed_tasks}/
          {albumExtraction.status.total_tasks} tasks successful)
        </span>
      );
    }

    // Not started yet
    if (
      albumExtraction.status.pending_tasks ===
      albumExtraction.status.total_tasks
    ) {
      return <span>Extraction Pending...</span>;
    }

    if (
      albumExtraction.status.total_tasks !== 0 &&
      !albumExtraction.status.ready
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

  const fetchStudiesFromAlbum = async (albumID) => {
    let albumStudies = await Kheops.studies(keycloak.token, albumID);
    setStudies((s) => ({ ...s, [albumID]: albumStudies }));
  };

  const handleStudyToggle = async (albumID) => {
    const updatedStudyToggles = { ...studyToggles };
    updatedStudyToggles[albumID] = !updatedStudyToggles[albumID];
    setStudyToggles(updatedStudyToggles);
    await fetchStudiesFromAlbum(albumID);
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
              albums.length > 0 && (
                <ListGroup className="albums">
                  {albums
                    .filter((album) => album.number_of_studies > 0)
                    .map((album) => (
                      <ListGroupItem key={album.album_id}>
                        <div className="d-flex justify-content-between align-items-center">
                          <h5 style={{ margin: 0 }}>
                            {album.name}{' '}
                            <Badge pill>
                              {album.number_of_studies} studies
                            </Badge>
                          </h5>
                          {showAlbumButtons(album)}
                        </div>

                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleStudyToggle(album.album_id);
                          }}
                        >
                          {studyToggles && studyToggles[album.album_id]
                            ? 'Hide studies'
                            : 'Show studies'}
                        </a>
                        <Collapse
                          isOpen={
                            studyToggles ? studyToggles[album.album_id] : false
                          }
                        >
                          {album.album_id in studies ? (
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
                          ) : (
                            <div className="text-center">
                              <FontAwesomeIcon icon="sync" spin /> Loading...
                            </div>
                          )}
                        </Collapse>
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
            forceUpdate={forceUpdate}
            nbStudies={currentAlbum.number_of_studies}
          />
        </MyModal>
      )}
    </>
  );
}

export default Dashboard;
