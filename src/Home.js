import React, { useCallback, useContext, useEffect, useState } from 'react';
import DicomFields from './dicom/fields';
import moment from 'moment';
import './Home.css';
import Backend from './services/backend';
import Kheops from './services/kheops';
import { Alert, Button, ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { DICOM_DATE_FORMAT } from './config/constants';
import { Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FeaturesList from './components/FeaturesList';
import MyModal from './components/MyModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from './context/SocketContext';
import { downloadFeature } from './utils/feature-utils';

function Home({ albums, studies, dataFetched, kheopsError }) {
  let [modal, setModal] = useState(false);
  let [currentAlbum, setCurrentAlbum] = useState(null);
  let [extractions, setExtractions] = useState([]);
  let [keycloak] = useKeycloak();

  let socket = useContext(SocketContext);

  let handleExtractAlbumClick = album => {
    setModal(true);
    setCurrentAlbum(album);
  };

  let handleDownloadAlbumClick = async album => {
    let albumExtraction = extractions.find(
      extraction => extraction.album_id === album.album_id
    );

    let albumStudies = await Kheops.studies(keycloak.token, album.album_id);

    downloadFeature(albumExtraction, albumStudies, album);
  };

  let toggleModal = () => {
    setModal(!modal);
  };

  let updateExtraction = (featureExtractionID, updatedContent) => {
    setExtractions(extractions => {
      let updatedExtractions = [...extractions];
      let extractionToUpdate = updatedExtractions.find(
        extraction => extraction.id === featureExtractionID
      );

      if (extractionToUpdate) {
        Object.assign(extractionToUpdate, {
          ...extractionToUpdate,
          ...updatedContent
        });
      }

      return updatedExtractions;
    });
  };

  let replaceExtraction = (albumID, newExtraction) => {
    setExtractions(extractions => {
      let updatedExtractions = [...extractions];
      let extractionToReplace = updatedExtractions.find(
        extraction => extraction.album_id === albumID
      );

      if (extractionToReplace) {
        Object.assign(extractionToReplace, { ...newExtraction });
      } else {
        updatedExtractions.push(newExtraction);
      }

      return updatedExtractions;
    });
  };

  let showAlbumButtons = album => {
    let extractionButton = (
      <Button color="link" onClick={() => handleExtractAlbumClick(album)}>
        <FontAwesomeIcon icon="cog" /> <span>Extract Features for Album</span>
      </Button>
    );

    let downloadButton = (
      <Button color="link" onClick={() => handleDownloadAlbumClick(album)}>
        <FontAwesomeIcon icon="download" />{' '}
        <span>Download Features for Album</span>
      </Button>
    );

    if (extractions) {
      let albumExtraction = extractions.find(
        extraction => extraction.album_id === album.album_id
      );

      if (!albumExtraction) {
        return <div>{extractionButton}</div>;
      } else if (!albumExtraction.status.successful) {
        return (
          <div className="text-muted">
            <FontAwesomeIcon icon="sync" spin />{' '}
            {featureExtractionStatusText(albumExtraction)}
          </div>
        );
      } else {
        return (
          <div>
            {extractionButton}
            {downloadButton}
          </div>
        );
      }
    } else {
      return null;
    }
  };

  const featureExtractionStatusText = albumExtraction => {
    if (
      albumExtraction.status.pending_tasks ===
      albumExtraction.status.total_tasks
    ) {
      return <span>Extraction Pending...</span>;
    }

    if (
      albumExtraction.status.total_steps !== 0 &&
      albumExtraction.status.completed_steps > 0
    ) {
      return (
        <span>
          Extraction In Progress (
          {(
            (albumExtraction.status.completed_steps /
              albumExtraction.status.total_steps) *
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

  const handleExtractionStatus = useCallback(extractionStatus => {
    console.log(
      `STATUS for Extraction ${extractionStatus.feature_extraction_id} !!!`,
      extractionStatus
    );

    // If full extraction object
    if (extractionStatus.id) {
      console.log('Updating full object');
      updateExtraction(extractionStatus.id, {
        ...extractionStatus
      });
    } else {
      updateExtraction(extractionStatus.feature_extraction_id, {
        status: extractionStatus.status
      });
    }
  }, []);

  useEffect(() => {
    socket.on('extraction-status', handleExtractionStatus);

    return () => {
      socket.off('extraction-status', handleExtractionStatus);
    };
  }, [socket, handleExtractionStatus]);

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

      setExtractions(extractions => latestExtractions);
    }

    if (albums && albums.length > 0) getAlbumExtractions();
  }, [keycloak, albums]);

  return (
    <>
      <div>
        <header className="App-header">
          <h1 data-testid="welcome-page-header">QuantImage v2</h1>
        </header>
        <section id="extract-features">
          <h2>Extract features</h2>
          <p>
            This page allows you to extract features from studies that were
            added to your albums in the Kheops platform.
          </p>
          <p>
            <a
              href={`${process.env.REACT_APP_KHEOPS_URL}/albums`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon="external-link-alt"></FontAwesomeIcon>{' '}
              Manage Studies in Kheops
            </a>
          </p>
          <h2>Your albums/studies</h2>
          <div>
            {kheopsError ? (
              <Alert color="danger">Error fetching data from Kheops</Alert>
            ) : !dataFetched ? (
              <Spinner />
            ) : albums.length > 0 && Object.keys(studies).length > 0 ? (
              <ListGroup className="albums">
                {albums
                  .filter(
                    album =>
                      studies[album.album_id] &&
                      studies[album.album_id].length > 0
                  )
                  .map(album => (
                    <ListGroupItem key={album.album_id}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 style={{ margin: 0 }}>{album.name}</h5>
                        {showAlbumButtons(album)}
                      </div>
                      {studies[album.album_id] && (
                        <>
                          <ListGroup>
                            {studies[album.album_id].map(study => (
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
                                  className="btn btn-link"
                                  href="#"
                                  title={
                                    study[DicomFields.STUDY_UID][
                                      DicomFields.VALUE
                                    ][0]
                                  }
                                >
                                  {
                                    study[DicomFields.PATIENT_NAME][
                                      DicomFields.VALUE
                                    ][0][DicomFields.ALPHABETIC]
                                  }{' '}
                                  (
                                  {moment(
                                    study[DicomFields.DATE][
                                      DicomFields.VALUE
                                    ][0],
                                    DicomFields.DATE_FORMAT
                                  ).format(DICOM_DATE_FORMAT)}
                                  )
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
                        </>
                      )}
                    </ListGroupItem>
                  ))}
              </ListGroup>
            ) : (
              <span>No albums found.</span>
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
            extractionCallback={newExtraction => {
              toggleModal();
              replaceExtraction(newExtraction.album_id, newExtraction);
            }}
          />
        </MyModal>
      )}
    </>
  );
}

export default Home;
